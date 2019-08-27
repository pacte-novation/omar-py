import sys
import pandas as pd
from elasticsearch import Elasticsearch


def print_and_flush(log):

    sys.stdout.write(log)
    sys.stdout.flush()

    return()


def to_pd_dataframe(chunk, time_field):

    df = pd.DataFrame()

    for doc in chunk:
        doc_dict = doc["_source"]
        doc_dict['_id'] = doc['_id']
        df = df.append([doc_dict])

    df[time_field] = pd.to_datetime(df[time_field], errors='coerce')
    df.index = df[time_field]
    df.drop(columns=time_field, inplace=True)
    df.dropna(inplace=True)

    return(df)


def load(index, batch_size, fields_to_extract, time_field, es_host, es_port):

    df_full_index = pd.DataFrame()

    es = Elasticsearch([es_host], port=es_port)
    n_docs = 0
    n_docs_total = es.count(index=index)['count']
    body = {"_source": fields_to_extract,
            "size": batch_size, "sort": {'time_pmc': 'asc'}}

    while True:
        resp = es.search(index=index, body=body)
        chunk = resp['hits']['hits']
        n_docs += len(chunk)
        body["search_after"] = (chunk[len(chunk) - 1])['sort']
        df_part_index = to_pd_dataframe(chunk, time_field)
        df_full_index = df_full_index.append(df_part_index, ignore_index=False)

        if (len(chunk) != batch_size):
            print_and_flush('scroll ' + str(n_docs_total) +
                            '/' + str(n_docs_total))
            break

        print_and_flush('scroll ' + str(n_docs) + '/' + str(n_docs_total))

    return(df_full_index)
