import os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';
const execSync = promisify(exec);
import { resolve } from 'path';

const installUninstalledDeps = async (req) => {

    req.io.emit('progressEnv', { progressEnv: 0, messageEnv: "", errorEnv: false })

    const { uninstalledDeps } = req.payload;
    const platform = os.platform();
    let pipVar;
    try {
        if (platform == 'linux') {

            pipVar = "sudo -H pip3";

        } else if (platform == 'win32') {

            pipVar = "pip";

        } else if (platform == 'darwin') {

            pipVar = "sudo -H pip3";

        } else {

            error = "Votre système n'est pas pris en charge par le plugin."
            return Object.assign(obj, { error: error });

        }

        const DEPS_PATH = resolve(req.server.config().get('omar-py.pythonModulesPath'));

        let nDep = 0;
        for (const dep of uninstalledDeps) {
            nDep++;
            const cmd = pipVar + " install --upgrade --target=" + DEPS_PATH + " " + dep;
            req.io.emit('progressEnv', { progressEnv: (nDep * 100) / (uninstalledDeps.length + 1), messageEnv: "Installation de " + dep + " en cours...(" + nDep + "/" + uninstalledDeps.length + ")" })
            console.log(cmd)
            const depCmd = await execSync(cmd);
            if (depCmd.stderr && !depCmd.stderr.startsWith("You are using pip version") && !depCmd.stderr.startsWith("requests") && !depCmd.stderr.startsWith("tensorflow")) {
                req.io.emit('progressEnv', { errorEnv: true, messageEnv: "!Fail: " + cmd + '\n' + JSON.stringify(depCmd.stderr) })
                return
            }
        }

    } catch (error) {
        req.io.emit('progressEnv', { errorEnv: true, messageEnv: JSON.stringify(error) });
        return
    }
    req.io.emit('progressEnv', { progressEnv: 100 });
}

export { installUninstalledDeps }