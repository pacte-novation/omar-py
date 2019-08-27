import { resolve } from 'path';
import { existsSync } from 'fs';
import serverRoute from './server/routes';
import SocketIo from 'socket.io';

export default function (kibana) {
  return new kibana.Plugin({
    require: ['elasticsearch'],
    name: 'omar-py',
    uiExports: {
      app: {
        title: 'Omar-py',
        description: 'Kibana Machine Learning App',
        main: 'plugins/omar-py/app',
        icon: 'plugins/omar-py/ressources/omar-py_logo.svg'
      },
      styleSheetPaths: [resolve(__dirname, 'public/app.scss'), resolve(__dirname, 'public/app.css')].find(p => existsSync(p)),
    },

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        //DEV
        //pythonModulesPath: Joi.string().default('../python_modules'),
        //modelPath: Joi.string().default('../omar-py/model'),
        pythonModulesPath: Joi.string().default(resolve(__dirname, 'python_modules')),
        modelPath: Joi.string().default(resolve(__dirname, 'model')),
        socketPort: Joi.number().integer().default(3000)
      }).default();
    },

    init(server, options) {
      const config = server.config();
      const socketPort = config.get('omar-py.socketPort');
      const ressourcesPath = resolve(__dirname, 'public/ressources');
      server.injectUiAppVars('omar-py', () => {
        return {
          envVars: {
            socketPort: socketPort,
            ressourcesPath: ressourcesPath
          }
        };
      });

      const io = SocketIo();


      io.on('connection', client => {
        server.log(['info', 'omar', 'socketio'], 'Connection! ' + client.handshake.headers.origin + " " + client.id + " port: " + socketPort);
        client.on("disconnect", () => {
          server.log(['info', 'omar', 'socketio'], 'Deconnection! ' + client.handshake.headers.origin + " " + client.id + " port: " + socketPort);
        });
      });
      io.listen(socketPort);

      options.io = io;


      serverRoute(server, options);

    }

  });
}
