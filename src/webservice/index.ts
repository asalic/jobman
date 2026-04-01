import HttpErrors from 'http-errors';
//import BodyParser from 'body-parser';
//import CookieParser from 'cookie-parser';
import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import type { ErrorRequestHandler } from "express";
//import path from "node:path";
//import 'dotenv/config';
//import fs from "node:fs";
import { parseArgs } from 'node:util';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';


import { exit } from 'node:process';
import type { SettingsWebService } from './model/SettingsWebService.js';
import AppConfLoader from './service/AppConfLoader.js';
import BaseError from "../common/error/BaseError.js";
import jobsRouter from './route/jobs.js';
import imagesRouter from './route/images.js';
import queueRouter from './route/queue.js';
import OidcAuth from './service/OidcAuth.js';
import KubeManager from './service/KubeManager.js';
import resourcesFlavorsRouter from './route/resources-flavors.js';
import HarborManager from './service/HarborManager.js';
import swaggerOptions from './swagger.js';
import LoggerService from './service/LoggerService.js';


//console.log(process.argv);
const { values } = parseArgs({ args: process.argv.slice(2, process.argv.length), options: {
        "settings": { type: "string", short: "s", "default": undefined }
        }
    });
if (!values.settings) {
    console.error("[ERROR] Please load a settings file using either -s or --settings.");
    exit(1);
}


const settingsPath = values.settings ?? "";
const appConf: SettingsWebService = AppConfLoader.getAppConf(settingsPath);//JSON.parse(fs.readFileSync(settingsPath, { encoding: 'utf8', flag: 'r' }));

const logger = new LoggerService(appConf.log); 

const oidcAuth = new OidcAuth(appConf, logger);
const km = new KubeManager(appConf, logger);
const hm = new HarborManager(appConf, logger);
// /const appConfig = AppConfig.get();
logger.info(`Jobman web service version '${process.env["npm_package_version"]}'`);
const app: Express = express();


const apiPath =  appConf.path.prefix + appConf.path.api;
swaggerOptions.definition?.["servers"].push(
     { url: apiPath, description: 'This server' }
)
const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.get('/swagger.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
app.use(
  `${appConf.path.prefix}/api-docs/`,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    swaggerOptions: {
      persistAuthorization: true
    }
  })
);
app.use(logger.middleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//app.use(express.static(path.join(__dirname, 'public')));
//app.use(CookieParser());
//app.use(BodyParser.json({ limit: appConfig.resultPostSize }));
//app.use(BodyParser.urlencoded({ extended: true }));
//app.use(upload.array());
app.use(apiPath + "/jobs", jobsRouter(oidcAuth, km, hm, logger));
app.use(apiPath + "/images", imagesRouter(oidcAuth, hm, logger));
app.use(apiPath + "/queue", queueRouter(oidcAuth, km, logger));
app.use(apiPath + "/resources-flavors", resourcesFlavorsRouter(oidcAuth, km, logger));
// 404 handler and pass to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
    next(HttpErrors(404, new BaseError("Not found", "Path " + req.path + " not found on the server", 404)));
});

const errorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
 // set locals, only providing error in development
    // res.locals.message = err.message;
    // res.locals.error = req.app.get('env') === 'development' ? err : {};
    //
    // // render the error page
    // res.status(err.status || 500);
    // res.render('error');
    logger.error(err);
    //res.error = err;
    res.status(err.status).json(err);
};
app.use(errorHandler);

//app.set('trust proxy', appConf.sharing.email.trustProxy ?? false);

logger.info(`Running on PORT ${appConf.port}`);

app.listen(appConf.port);