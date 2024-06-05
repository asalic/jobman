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


import { exit } from 'node:process';
import type { SettingsWebService } from './model/SettingsWebService.js';
import AppConfLoader from './service/AppConfLoader.js';
import BaseError from "../common/error/BaseError.js";
import jobsRouter from './route/jobs.js';
import imagesRouter from './route/images.js';
import queueRouter from './route/queue.js';
import OidcAuth from './service/OidcAuth.js';
import KubeManager from './service/KubeManager.js';


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
const oidcAuth = new OidcAuth(appConf);
const km = new KubeManager(appConf);
// /const appConfig = AppConfig.get();
console.log(`Jobman web service version '${process.env["npm_package_version"]}'`);
const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
//app.use(express.static(path.join(__dirname, 'public')));
//app.use(CookieParser());
//app.use(BodyParser.json({ limit: appConfig.resultPostSize }));
//app.use(BodyParser.urlencoded({ extended: true }));
//app.use(upload.array());

app.use(appConf.path + "/jobs", jobsRouter(oidcAuth, km));
app.use(appConf.path + "/images", imagesRouter(oidcAuth, km));
app.use(appConf.path + "/queue", queueRouter(oidcAuth, km));
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
    console.log('error');
    //res.error = err;
    res.status(err.status).json(err);
};
app.use(errorHandler);

//app.set('trust proxy', appConf.sharing.email.trustProxy ?? false);

console.log(`Running on PORT ${appConf.port}`);

app.listen(appConf.port);