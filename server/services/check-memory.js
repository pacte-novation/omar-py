import os from 'os';

const checkMemory = async (req) => {

    const { index, nFeatureFieldsSelected } = req.params;
    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');
    const stats = await callWithRequest(req, 'indices.stats', { index: index });
    const resp = await callWithRequest(req, 'indices.getMapping', { index: index });
    const nFeatureFieldsTotal = Object.keys(resp[req.params.index].mappings.properties).length;
    const memoryIndex = stats._all.total.store.size_in_bytes;
    const memoryPandasDf = memoryIndex * nFeatureFieldsSelected / nFeatureFieldsTotal;
    const usedMemory = memoryPandasDf * 1.02;
    const memoryErr = (usedMemory > os.freemem());
    const result = { memoryErr: memoryErr, usedMemory: usedMemory, errorMess: '' };

    return result
}


export { checkMemory };