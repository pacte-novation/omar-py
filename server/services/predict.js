import os from 'os';
import { resolve, join } from 'path';
import { launchPythonProcess } from '../utils';

const predict = (req) => {

  const es = req.server.plugins.elasticsearch.getCluster('data').getHosts()[0].split(':');
  const ES_PORT = es.pop();
  const ES_HOST = es.pop().replace('//', '');
  const DEPS_PATH = resolve(req.server.config().get('omar-py.pythonModulesPath'));
  const MODEL_PATH = resolve(req.server.config().get('omar-py.modelPath'));

  let argsStr = '--depsPath=' + DEPS_PATH;
  argsStr += ' --esHost=' + ES_HOST;
  argsStr += ' --esPort=' + ES_PORT;
  argsStr += ' --modelPath=' + MODEL_PATH;

  const predictPyPath = join(__dirname, 'predict.py');
  const platform = os.platform();
  let cmd;

  if (platform == "win32") {

    cmd = ['python', predictPyPath, ...argsStr.split(' ')]

  } else if (platform == "linux") {

    cmd = ['python3', predictPyPath, ...argsStr.split(' ')]

  } else if (platform == "darwin") {

    cmd = ['python3', predictPyPath, ...argsStr.split(' ')]

  }

  req.io.emit('progressPredict', { progressPredict: 0, errorPredict: false, messPredict: "" })
  launchPythonProcess(req, cmd, 'predict');

  return

}

export { predict };

