import fs from 'fs';
import { promisify } from 'util';
import { spawn } from 'child_process';

const oneHot = (column) => {
    const columns = [];
    const mods = [...new Set(column.values)];
    mods.forEach((mod) => {
        columns.push({ header: column.header + "_" + mod, values: column.values.map(v => v == mod ? 1 : 0) });
    })
    return columns
}

const createFolderIfNotExist = async (folderPath) => {
    const existsAsync = promisify(fs.exists);
    const mkdirAsync = promisify(fs.mkdir);
    const arbo = folderPath.split('/');
    let pathToCreate = arbo[0];
    for (let i = 1; i < arbo.length - 1; i++) {
        const lvl = arbo[i];
        pathToCreate += '/' + lvl;
        if (!(await existsAsync(pathToCreate))) {
            await mkdirAsync(pathToCreate);
        }
    }
}

const getMean = (arr) => {
    return arr.reduce((acc, curr) => { return acc + curr }, 0) / arr.length
}

const launchPythonProcess = (req, cmd, mode) => {

    const startTime = new Date();

    let epoch, totalEpoch, stepLoadData, totalLoadData, stepPretreat, totalPretreat, stepPredict, totalPredict;
    const regexEpoch = /(?<=Epoch\s+)(\d+)(\/)(\d+)/;
    const regexStep = /(\d+)(\/)(\d+)\s+(?=[[])/;
    const regexLoadData = /scroll\s+(\d+)\/(\d+)/;
    const regexPretreat = /pretreat\s+(\d.+)\/(\d+)/;
    const regexPredict = /predicting\s+(\d+)\/(\d+)/;


    let onStdOut = () => { }, errorMess = "";
    if (mode === 'train') {
        req.io.emit('progressTrain', { progressTrain: 0, errorTrain: false, messTrain: 'Loading data from ElasticSearch...', lastStageOfTrain: false });

        onStdOut = (data) => {
            try {
                const txt = data.toString();
                console.log(txt)
                const resEpoch = regexEpoch.exec(txt);
                const resStep = regexStep.exec(txt);
                const resLoadData = regexLoadData.exec(txt);
                const resPretreat = regexPretreat.exec(txt);
                if (resStep !== null) {
                    const step = parseFloat(resStep[1]);
                    const totalStep = parseFloat(resStep[3]);
                    if (resEpoch !== null) {
                        epoch = parseFloat(resEpoch[1]);
                        totalEpoch = parseFloat(resEpoch[3]);
                    }
                    const progressTrain = ((((step + ((epoch - 1) * totalStep)) / (totalEpoch * totalStep)) * 100)).toFixed(0);
                    req.io.emit('progressTrain', { progressTrain: progressTrain, errorTrain: false, messTrain: 'Train in Progress...(' + progressTrain + ' %)', lastStageOfTrain: true })
                } else if (resLoadData !== null) {
                    stepLoadData = parseFloat(resLoadData[1]);
                    totalLoadData = parseFloat(resLoadData[2]);
                    const progressLoadData = (100 * stepLoadData / totalLoadData).toFixed(0);
                    req.io.emit('progressTrain', { progressTrain: progressLoadData, errorTrain: false, messTrain: 'Loading data from ElasticSearch...(' + progressLoadData + ' %)', lastStageOfTrain: false })
                } else if (resPretreat !== null) {
                    stepPretreat = parseFloat(resPretreat[1]);
                    totalPretreat = parseFloat(resPretreat[2]);
                    const progressPretreatData = (100 * stepPretreat / totalPretreat).toFixed(0);
                    req.io.emit('progressTrain', { progressTrain: progressPretreatData, errorTrain: false, messTrain: 'Pretreating data...(' + progressPretreatData + ' %)', lastStageOfTrain: false })
                }
            } catch (error) {
                const mess = JSON.stringify(error)
                req.io.emit('progressTrain', { errorTrain: true, messTrain: mess })

            }
        }
    } else if (mode === 'predict') {
        req.io.emit('progressPredict', { progressPredict: 0, errorPredict: false, messPredict: "Loading data from ElasticSearch...", lastStageOfPredict: false });
        onStdOut = (data) => {
            try {
                const txt = data.toString();
                const resLoadData = regexLoadData.exec(txt);
                const resPredict = regexPredict.exec(txt);
                if (resLoadData !== null) {
                    stepLoadData = parseFloat(resLoadData[1]);
                    totalLoadData = parseFloat(resLoadData[2]);
                    const progressLoadData = (100 * stepLoadData / totalLoadData).toFixed(0);
                    req.io.emit('progressPredict', { progressPredict: progressLoadData, errorPredict: false, messPredict: 'Loading data from ElasticSearch...(' + progressLoadData + ' %)', lastStageOfPredict: false })
                } else if (resPredict !== null) {
                    stepPredict = parseFloat(resPredict[1]);
                    totalPredict = parseFloat(resPredict[2]);
                    const progressPredict = (100 * stepPredict / totalPredict).toFixed(0);
                    req.io.emit('progressPredict', { progressPredict: progressPredict, errorPredict: false, messPredict: 'Predicting...(' + progressPredict + ' %)', lastStageOfPredict: true })
                }

            } catch (error) {
                console.error(error);
                const mess = JSON.stringify(error)
                req.io.emit('progressPredict', { errorPredict: true, messPredict: mess })
            }
        }
    } else {
        console.error('You should either train or predict');
        req.io.emit('progressPredict', { errorPredict: true, messPredict: 'You should either train or predict' })
    }

    console.log(cmd.join(" "));
    const wPython = spawn(cmd[0], cmd.slice(1));
    req.io.emit('PYTHON_PID', wPython.pid);
    wPython.stdout.on('data', onStdOut);
    wPython.stderr.on('data', (data) => {
        const txt = data.toString();
        console.error(txt);
        errorMess += txt;
    });
    wPython.on('exit', (exitCode) => {
        if (errorMess != '') {
            errorMess = errorMess.split('\n');
            errorMess = errorMess[errorMess.length - 2]
        }
        const endTime = new Date();
        const mess = "python " + mode + " process " + wPython.pid + ' ended with code ' + exitCode;
        let result = { pid: wPython.pid, exitCode: exitCode, mode: mode, elapsedTime: endTime - startTime, endTime: endTime, mess: mess }
        const modeSuffix = mode.charAt(0).toUpperCase() + mode.slice(1);
        result = (errorMess === "") ? Object.assign(result, { ['error' + modeSuffix]: false, ['mess' + modeSuffix]: errorMess }) : Object.assign(result, { ['error' + modeSuffix]: exitCode === 1, ['mess' + modeSuffix]: errorMess });
        req.io.emit('progress' + modeSuffix, result)
        console.log(result)
    });
}

const killProcess = (pid) => {
    try {
        process.kill(pid, 'SIGTERM');
        return { message: 'Process ' + pid + ' killed with success!' }
    } catch (error) {
        return { message: error }
    }
}

const logRequest = (req) => {
    req.server.log(['info', 'omar', 'http'], req.route.method.toUpperCase() + ' ' + req.route.path);
}



export { oneHot, createFolderIfNotExist, getMean, launchPythonProcess, killProcess, logRequest }