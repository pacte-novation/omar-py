import { isFlat } from './is-flat';
import { enableFieldData } from './enable-fielddata';
import { isQuali } from './is-quali';
import { count } from './count';
import os from 'os';

const getFields = async (req) => {

  if (!(req.params && req.params.index)) { req.params = req.payload; }

  const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');
  const resp = await callWithRequest(req, 'indices.getMapping', { index: req.params.index });
  const oProps = resp[req.params.index].mappings.properties;
  const fArr = Object.keys(oProps);
  const firstCall = await callWithRequest(req, 'search', { index: req.params.index, body: { "size": 1, "query": { "exists": { "field": fArr[0] } } } });
  const fields = await Promise.all(
    fArr.map(async (key) => ({ field: key, type: oProps[key].type, isFlat: (await isFlat(req, req.params.index, key, firstCall.hits.hits[0]._source)) }))
  );

  const fNoDate = [];
  const fDate = [];
  for (let f of fields) {
    if (f.isFlat) {
      if (f.type === 'date') {
        fDate.push(f.field);
      } else {
        fNoDate.push(f.field);
      }
    }
  }
  fNoDate.sort();
  fDate.sort();

  //quanti quali
  let quantitative = [];
  let qualitative = [];
  const docCount = await count(req);
  for (const field of fNoDate) {
    try {
      await enableFieldData(req, field);
    } catch (e) {
      console.log(e)
    }
    const bIsQuali = await isQuali(req, field, docCount);
    bIsQuali ? qualitative.push(field) : quantitative.push(field);
  };


  const result = { fNoDate: fNoDate, fDate: fDate, quantitative: quantitative, qualitative: qualitative }

  return result
}


export { getFields };

