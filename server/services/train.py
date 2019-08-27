
# IMPORT STANDARD LIBS
import os
import sys
import json
import argparse

parser = argparse.ArgumentParser(
    formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--index')
parser.add_argument('--timeField')
parser.add_argument('--predictField')
parser.add_argument('--featureFields')
parser.add_argument('--timeStep')
parser.add_argument('--depsPath')
parser.add_argument('--esHost')
parser.add_argument('--esPort')
parser.add_argument('--modelPath')
args = parser.parse_args()

DEPS_PATH = args.depsPath
INDEX = args.index
TIME_FIELD = args.timeField
PREDICT_FIELD = args.predictField
FEATURE_FIELDS = args.featureFields.split(',')
ES_HOST = args.esHost
ES_PORT = args.esPort
MODEL_PATH = args.modelPath
TIME_STEP = args.timeStep

# add external deps path
sys.path.insert(0, DEPS_PATH)

# IMPORT EXTERNAL DEPS
# the 2 lines below silence the 'Using tensorflow backend' message from keras
stderr = sys.stderr
sys.stderr = open(os.devnull, 'w')

from keras.layers import Dense, Dropout
from keras.models import Sequential
sys.stderr = stderr

import pandas as pd


# IMPORT LOCAL DEPS
from utils import print_and_flush, load

SCROLL_CHUNK_SIZE = 1000


def infer_quali_quanti(df_main):
    qualitatives = []
    quantitatives = []
    for col in list(df_main):
        infered_type = pd.api.types.infer_dtype(df_main[col], skipna=True)
        if infered_type in ['floating', 'integer', 'decimal']:
            row_counter = 0
            iterator_value_counts = 0
            value_counts = df_main[col].value_counts()
            nb_modalites = value_counts.shape[0]
            eighty_prcnt_rows = int(df_main[col].shape[0] * 0.8)
            while (row_counter < eighty_prcnt_rows):
                row_counter += value_counts.iloc[iterator_value_counts]
                iterator_value_counts += 1
            # Si 20% ou moins de 20% des modalités sont dans 80% de la donnée, c'est une feature qualitative, sinon c'est une feature quantitative.
            if iterator_value_counts <= int(0.2 * nb_modalites):
                qualitatives.append(col)
            else:
                quantitatives.append(col)
        else:
            qualitatives.append(col)
    return(quantitatives, qualitatives)


def resample_stats(df_main, time_step, only_mean=True):

    time_step_str = str(time_step) + 'T'
    prev_index = 0
    t_zero = df_main.index[0]

    df = pd.DataFrame()

    for index, s in df_main.iterrows():

        if (index >= t_zero + pd.Timedelta(time_step_str)):

            feature_stats = {}
            feature_stats['timestamp'] = str(t_zero)
            df_batch = df_main.loc[t_zero:prev_index]

            for feature in list(df_main):
                df_to_resample = df_batch[feature]
                feature_stats[str(feature) + '_mean'] = [df_to_resample.mean()]

                if not only_mean:
                    feature_stats[str(feature) + '_min'] = [df_to_resample.min()]
                    feature_stats[str(feature) + '_max'] = [df_to_resample.max()]
                    feature_stats[str(feature) + '_std'] = [df_to_resample.std()]

            del df_batch
            del df_to_resample

            df = df.append(pd.DataFrame.from_dict(feature_stats), ignore_index=True)

            t_zero = t_zero + pd.Timedelta(time_step_str)

        prev_index = index

    df = df.set_index('timestamp')

    return(df)


def print_resample_progress(n_progress, n):

    n_progress += 1
    print_and_flush('resample ' + str(float(n_progress)) + '/' + str(n))
    return n_progress


def resample(df_main, time_step, qualitatives, quantitatives, predict_field):

    df = pd.DataFrame()

    n_progress = -1
    n = len(qualitatives) + len(quantitatives) + 1
    n_progress = print_resample_progress(n_progress, n)

    df = pd.concat([df, resample_stats(df_main[predict_field].to_frame(), time_step)], axis=1)
    df.rename(columns={predict_field + '_mean': predict_field}, inplace=True)
    n_progress = print_resample_progress(n_progress, n)

    for feat in qualitatives:
        one_hot_columns = pd.get_dummies(df_main[feat], prefix=feat)
        df = pd.concat([df, resample_stats(one_hot_columns, time_step)], axis=1)
        n_progress = print_resample_progress(n_progress, n)

    for feat in quantitatives:
        df = pd.concat([df, resample_stats(df_main[feat].to_frame(), time_step, only_mean=False)], axis=1)
        n_progress = print_resample_progress(n_progress, n)

    return(df)


def get_Omar_model(x_shape, y_shape):

    model = Sequential()
    model.add(Dense(128, input_dim=x_shape[1], activation='relu'))
    model.add(Dropout(rate=0.2))

    model.add(Dense(256, activation='relu'))
    model.add(Dropout(rate=0.2))

    model.add(Dense(256, activation='relu'))
    model.add(Dropout(rate=0.2))

    model.add(Dense(32, activation='relu'))
    model.add(Dropout(rate=0.1))

    model.add(Dense(1, kernel_initializer='normal'))

    model.compile(optimizer='adam', loss='mse')

    return(model)


def save_config(model, df_stats_min, df_stats_max, X, qualitatives, quantitatives, model_name='model.h5'):
    if not os.path.exists(MODEL_PATH):
        os.makedirs(MODEL_PATH)

    model.save(os.path.join(MODEL_PATH, model_name))

    dict_df_stats_min = {}
    for col in list(df_stats_min.index):
        dict_df_stats_min[col] = df_stats_min.loc[col]

    dict_df_stats_max = {}
    for col in list(df_stats_max.index):
        dict_df_stats_max[col] = df_stats_max.loc[col]

    json_params = {}
    json_params['dict_df_stats_min'] = dict_df_stats_min
    json_params['dict_df_stats_max'] = dict_df_stats_max
    json_params['train_columns'] = list(X)
    json_params['qualitatives'] = qualitatives
    json_params['quantitatives'] = quantitatives

    json_params['index'] = INDEX
    json_params['timeField'] = TIME_FIELD
    json_params['predictField'] = PREDICT_FIELD
    json_params['featureFields'] = FEATURE_FIELDS
    json_params['TIME_STEP'] = TIME_STEP

    with open(os.path.join(MODEL_PATH, 'params.json'), 'w+') as fp:
        json.dump(json_params, fp, indent=4)

    return()


if __name__ == '__main__':

    fields_to_extract = [*FEATURE_FIELDS, TIME_FIELD, PREDICT_FIELD]

    # Dans df_main, l'index est un objet datetime64
    df_main = load(INDEX, SCROLL_CHUNK_SIZE, fields_to_extract, TIME_FIELD, ES_HOST, ES_PORT)

    quantitatives, qualitatives = infer_quali_quanti(df_main[FEATURE_FIELDS])

    # RESAMPLE
    resampled_stats = resample(df_main, TIME_STEP, qualitatives, quantitatives, PREDICT_FIELD)

    # SHIFT
    resampled_stats[PREDICT_FIELD] = resampled_stats[PREDICT_FIELD].shift(-1)
    resampled_stats.dropna(axis=0, inplace=True)

    # NORMALIZE
    df_stats_min = resampled_stats.min()
    df_stats_max = resampled_stats.max()
    normalized_resampled_stats = (resampled_stats - resampled_stats.min()) / (resampled_stats.max() - resampled_stats.min())
    del resampled_stats

    # ANN INPUT
    X = normalized_resampled_stats.drop(PREDICT_FIELD, axis=1)
    y = normalized_resampled_stats[PREDICT_FIELD]

    model = get_Omar_model(X.shape, y.shape)

    model.fit(X.fillna(0), y, epochs=10, verbose=1)

    save_config(model, df_stats_min, df_stats_max, X, qualitatives, quantitatives)
