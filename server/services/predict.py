import argparse
parser = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter)
parser.add_argument('--depsPath')
parser.add_argument('--esHost')
parser.add_argument('--esPort')
parser.add_argument('--modelPath')
args = parser.parse_args()

DEPS_PATH = args.depsPath
ES_HOST = args.esHost
ES_PORT = args.esPort
MODEL_PATH = args.modelPath

import sys
# add external deps path
sys.path.insert(0, DEPS_PATH)

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime
from elasticsearch import Elasticsearch
from keras.models import Sequential, load_model
from keras.layers import Dense, Dropout
from utils import print_and_flush, load


SCROLL_CHUNK_SIZE = 1000
DEFAULT_MODEL_NAME = 'model.h5'
OMAR_KIBANA_FIELD_NAME = 'omar_pred'


def load_model_Omar(name=DEFAULT_MODEL_NAME):
    model = load_model(os.path.join(MODEL_PATH, name))
    with open(os.path.join(MODEL_PATH, 'params.json')) as json_data:
        json_params = json.load(json_data)

    df_stats_min = pd.DataFrame.from_dict(json_params['dict_df_stats_min'], orient='index')
    df_stats_max = pd.DataFrame.from_dict(json_params['dict_df_stats_max'], orient='index')

    X_train_columns = json_params['train_columns']
    qualitatives = json_params['qualitatives']
    quantitatives = json_params['quantitatives']

    index = json_params['index']
    time_field = json_params['timeField']
    predict_field = json_params['predictField']
    feature_field = json_params['featureFields']
    time_step = json_params['TIME_STEP']
    return(model, df_stats_min, df_stats_max, X_train_columns, qualitatives, quantitatives, index, time_field, predict_field, feature_field, time_step)


def update_doc_elastic(index_elastic, id_doc_elastic, dict_nouvelles_valeurs, ES_HOST, ES_PORT):

    es = Elasticsearch([ES_HOST], port=ES_PORT)
    es.update(index=index_elastic, doc_type='_doc', id=id_doc_elastic,
              body=dict_nouvelles_valeurs)

    return()


def resample_and_normalize_chunk(df_to_predict, quantitatives, qualitatives, X_train_columns, df_stats_min, df_stats_max):
    df_to_predict_resampled = pd.DataFrame(index=[0])
    for c_quant in quantitatives:
        try:
            df_to_predict_resampled[c_quant + '_mean'] = df_to_predict[c_quant].mean()
            df_to_predict_resampled[c_quant + '_min'] = df_to_predict[c_quant].min()
            df_to_predict_resampled[c_quant + '_max'] = df_to_predict[c_quant].max()
            df_to_predict_resampled[c_quant + '_std'] = df_to_predict[c_quant].std()
        except:
            print('Could not compute stats for quantitative column: ' + c_quant)
            pass
    # Do stats for qualitatives columns
    for c_qual in qualitatives:
        dummies_tmp = pd.get_dummies(df_to_predict[c_qual], columns=c_qual, prefix=c_qual)
        for c_qual_modalite in list(dummies_tmp):
            df_to_predict_resampled[c_qual_modalite + '_mean'] = dummies_tmp[c_qual_modalite].mean()

    missing_cols = set(X_train_columns) - set(df_to_predict_resampled.columns)
    for c in missing_cols:
        df_to_predict_resampled[c] = 0

    for col in list(df_to_predict_resampled):
        df_to_predict_resampled[col] = (df_to_predict_resampled[col].values[0] - df_stats_min.loc[col].values[0]
                                        ) / (df_stats_max.loc[col].values[0] - df_stats_min.loc[col].values[0])
    return(df_to_predict_resampled[X_train_columns])


if __name__ == '__main__':
    model, df_stats_min, df_stats_max, X_train_columns, qualitatives, quantitatives, index, time_field, predict_field, feature_field, time_step = load_model_Omar()

    fields_to_extract = [*feature_field, time_field, predict_field, '_id']
    df_index = load(index, SCROLL_CHUNK_SIZE, fields_to_extract, time_field, ES_HOST, ES_PORT)
    df_index = df_index[feature_field + ['_id']]

    list_of_updated_id = []
    cpt = 0
    for idx_start in df_index.index:

        print_and_flush('predicting ' + str(cpt) + '/' + str(len(df_index)))
        cpt += 1

        time_start = np.datetime64(idx_start)
        time_stop = time_start + np.timedelta64(time_step, 'm')

        df_to_predict = df_index.loc[time_start:time_stop]
        if df_to_predict.shape[0] > 1:
            last_index = df_to_predict.index[df_to_predict.shape[0] - 1]

            try:
                # Normal case: no duplicated IDs
                last_index_id = df_index.loc[last_index].loc['_id']
            except:
                # If the ID is duplicated, we take the first one
                last_index_id = df_index.loc[last_index].iloc[0].loc['_id']

            if last_index_id not in list_of_updated_id:
                df_to_predict_resampled = resample_and_normalize_chunk(df_to_predict, quantitatives, qualitatives, X_train_columns, df_stats_min, df_stats_max)

                prediction = model.predict(df_to_predict_resampled.fillna(0))
                prediction = prediction[0][0]
                prediction = prediction * (df_stats_max.loc[predict_field].values[0]
                                           - df_stats_min.loc[predict_field].values[0]) + df_stats_min.loc[predict_field].values[0]
                dict_nouvelles_valeurs = {"doc": {OMAR_KIBANA_FIELD_NAME: prediction}}

                try:
                    update_doc_elastic(index, last_index_id, dict_nouvelles_valeurs, ES_HOST, ES_PORT)
                    list_of_updated_id.append(last_index_id)
                except:
                    sys.stderr.write(last_index_id + ' - Could not update for reasons : , ' + str(dict_nouvelles_valeurs))
