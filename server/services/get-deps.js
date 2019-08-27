import os from 'os';
import { resolve, join } from 'path';
import fs from 'fs';
import util from 'util';
import { exec } from 'child_process';
const execSync = util.promisify(exec);
const readFileSync = util.promisify(fs.readFile);

const getUninstalledDeps = async (req) => {

    const DEPS_PATH = resolve(req.server.config().get('omar-py.pythonModulesPath'));
    const pythonScriptPath = join(__dirname, 'get_deps.py');
    const platform = os.platform();
    let pythonVar = "";

    if (platform == "win32") {

        pythonVar = "python"

    } else if (platform == "linux") {

        pythonVar = "python3"

    } else if (platform == "darwin") {

        pythonVar = "python3"

    } else {

        console.error("Votre système n'est pas pris en charge par le plugin.");
        return

    }

    const pythonCmd = [pythonVar, pythonScriptPath, DEPS_PATH]
    console.log(pythonCmd.join(" "))
    let [installedDeps, expectedDeps] = await Promise.all([execSync(pythonCmd.join(" ")), readFileSync(resolve(__dirname, '../../server/requirements.txt'))]);
    installedDeps = installedDeps.stdout.split(os.EOL).sort();
    expectedDeps = expectedDeps.toString().replace(/\r/g, '').split('\n');
    const uninstalledDeps = expectedDeps.filter(dep => !installedDeps.includes(dep));
    return uninstalledDeps
}

export { getUninstalledDeps };
