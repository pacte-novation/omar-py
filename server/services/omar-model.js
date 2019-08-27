import { exists, readFile } from 'fs';
import { resolve, join } from 'path';
import { promisify } from 'util';
const existSync = promisify(exists);
const readSync = promisify(readFile);

const updateFieldInOmarModel = async (req, kvObj) => {

    const { callWithRequest } = req.server.plugins.elasticsearch.getCluster('data');
    const index = await getIndexOmarName();
    const resp = await callWithRequest(req, 'update', { index: index, id: "model", body: { doc: kvObj } });

    return resp

}

const getModelParams = async (req) => {

    const MODEL_PATH = resolve(req.server.config().get('omar-py.modelPath'));
    const PARAMS_PATH = join(MODEL_PATH, 'params.json');

    const isParams = await existSync(PARAMS_PATH);
    if (isParams) {
        const params = JSON.parse((await readSync(PARAMS_PATH)).toString());
        return { currentModel: params }
    }

    return {}

}


export { updateFieldInOmarModel, getModelParams };

