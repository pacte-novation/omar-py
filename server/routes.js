import Joi from 'joi';
import { predict } from './services/predict';
import { train } from './services/train';
import { getIndices } from './services/indices';
import { getFields } from './services/fields';
import { checkPythonEnv } from './services/check-python-env';
import { installUninstalledDeps } from './services/install-uninstalled-deps';
import { getModelParams } from './services/omar-model';
import { killProcess, logRequest } from './utils';
import { checkMemory } from './services/check-memory';

export default function (server, options) {

    server.route({
        path: '/api/omar-py/indices',
        method: 'GET',
        handler: async (req, reply) => {
            try {
                logRequest(req);
                const result = await getIndices(req);
                return reply.response(result).type('application/json');
            } catch (err) {
                reply(err);
            }
        }
    });

    server.route({
        path: '/api/omar-py/fields/{index}',
        config: {
            validate: {
                params: {
                    index: Joi.string().required(),
                },
            },
        },
        method: 'GET',
        handler: async (req, reply) => {
            try {
                logRequest(req);
                const result = await getFields(req);
                return reply.response(result).type('application/json');
            } catch (err) {
                reply(err);
            }
        }
    });

    server.route({
        path: '/api/omar-py/memory/{index}/{nFeatureFieldsSelected}',
        config: {
            validate: {
                params: {
                    index: Joi.string().required(),
                    nFeatureFieldsSelected: Joi.string().required()
                },
            },
        },
        method: 'GET',
        handler: async (req, reply) => {
            try {
                logRequest(req);
                const result = await checkMemory(req);
                return reply.response(result).type('application/json');
            } catch (err) {
                reply(err);
            }
        }
    });

    server.route({
        path: '/api/omar-py/train',
        config: {
            validate: {
                payload: {
                    index: Joi.string().required(),
                    timeField: Joi.string().required(),
                    predictField: Joi.string().required(),
                    featureFields: Joi.string().required(),
                    timeStep: Joi.number().required()
                },
            },
        },
        method: 'POST',
        handler: (req, reply) => {
            try {
                logRequest(req);
                req.io = options.io;
                train(req);
                return reply.response("Train has been launched").type('text/plain');
            } catch (err) {
                reply(err);
            }
        }
    });

    server.route({
        path: '/api/omar-py/kill-process/{pid}',
        config: {
            validate: {
                params: {
                    pid: Joi.string().required(),
                },
            },
        },
        method: 'GET',
        handler: async (req, reply) => {
            try {
                logRequest(req);
                const { pid } = req.params;
                const result = await killProcess(pid);
                return reply.response(result).type('application/json');
            } catch (err) {
                reply(err);
            }
        }
    });

    server.route({
        path: '/api/omar-py/predict',
        method: 'POST',
        handler: (req, reply) => {
            try {
                logRequest(req);
                req.io = options.io;
                predict(req);
                return reply.response("Predict has been launched").type('text/plain');
            } catch (err) {
                console.log(err);
                return
            }
        }
    });

    server.route({
        path: '/api/omar-py/check-python-env',
        method: 'GET',
        handler: async (req, reply) => {
            try {
                logRequest(req);
                const result = await checkPythonEnv(req);
                return reply.response(result).type('application/json');
            } catch (err) {
                reply(err);
            }
        }
    });

    server.route({
        path: '/api/omar-py/install-uninstalled-deps',
        config: {
            validate: {
                payload: {
                    uninstalledDeps: Joi.array().required()
                },
            },
        },
        method: 'POST',
        handler: (req, reply) => {
            try {
                logRequest(req);
                req.io = options.io;
                installUninstalledDeps(req);
                return reply.response("Le check de l'environnement python nécessaire au bon fonctionnement d'Omar-py a été lancé.").type('text/plain');
            } catch (error) {
                console.log(error);
                return
            }
        }
    });

    server.route({
        path: '/api/omar-py/omar-model',
        method: 'GET',
        handler: async (req, reply) => {
            try {
                logRequest(req);
                const result = await getModelParams(req);
                return reply.response(result).type('application/json');
            } catch (err) {
                console.log(err)
                reply(err);
            }
        }
    });

}
