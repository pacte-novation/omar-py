import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
const execSync = promisify(exec);
import { getUninstalledDeps } from './get-deps';

const checkPythonEnv = async (req) => {

    const arch = os.arch();
    const platform = os.platform();

    let error = "";
    let pythonVar = "";
    let pipVar = "";

    if (platform == 'linux') {

        pythonVar = "python3";
        pipVar = "pip3";

    } else if (platform == 'win32') {

        pythonVar = "python";
        pipVar = "pip";

    } else if (platform == 'darwin') {

        pythonVar = "python3";
        pipVar = "pip3";

    } else {

        error = "Votre système n'est pas pris en charge par le plugin."
        return Object.assign(obj, { error: error });

    }

    let result = { arch: arch, platform: platform }

    const pythonCmd = await execSync(pythonVar + " --version");
    if (pythonCmd.stderr) {
        error = "It seems that python is not installed on your system or the environment variable 'python' is not set."
        return Object.assign(obj, { error: error });
    }
    const pythonVersion = pythonCmd.stdout.split(' ')[1].replace(os.EOL, '');
    if (pythonVersion.split('.')[0] != 3) {
        error = "The Python locally found is version " + pythonVersion + ".\n You need Python 3."
        return Object.assign(obj, { error: error });
    }
    result = Object.assign(result, { pythonVersion: pythonVersion })

    const pipCmd = await execSync(pipVar + " --version");
    if (pipCmd.stderr) {
        error = "It seems that pip is not installed on your system or the environment variable '" + pipVar + "' is not set."
        return Object.assign(obj, { error: error });
    }
    const pipVersion = pipCmd.stdout.split(' ')[1];
    const pipPath = pipCmd.stdout.split(' ')[3];
    result = Object.assign(result, { pipVersion: pipVersion, pipPath: pipPath })

    const uninstalledDeps = await getUninstalledDeps(req);
    result = Object.assign(result, { uninstalledDeps: uninstalledDeps })

    return result

}


export { checkPythonEnv }