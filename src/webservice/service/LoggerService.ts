import pino from "pino";
import type { Log } from "../model/SettingsWebService.js";
import path from "node:path";
import fs from "node:fs";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";


export default class LoggerService {

    static DEFAULT_LEVEL = "info";
    static DEFAULT_LOG_NAME = "jobman-webservice.log";

    protected logger: pino.Logger;

    constructor(logSettings: Log) {
        const level = logSettings.level ?? LoggerService.DEFAULT_LEVEL;
        const destination = path.join(logSettings.directory, logSettings.fileName ?? LoggerService.DEFAULT_LOG_NAME);
        fs.mkdirSync(logSettings.directory, {recursive: true});
        this.logger = pino({
            level: 'info',
            transport: {
                targets: [
                    {
                        target: 'pino/file',
                        options: { destination, mkdir: true },
                        level
                    },
                    {
                        target: 'pino-pretty',
                        options: { colorize: true },
                        level
                    }
                ]
            }
        });
    }

    debug(message: string) {
        this.logger?.debug(message);
    }

    trace(message: string) {
        this.logger?.trace(message);
    }

    info(message: string) {
        this.logger?.info(message);
    }

    warn(message: string) {
        this.logger?.warn(message);
    }

    error(message: string | Error | object) {
        this.logger?.error(message);
    }

    fatal(message: string | Error) {
        this.logger?.fatal(message);
    }

    get middleware(): any {
        return pinoHttp({
            logger: this.logger,
            genReqId: () => randomUUID(),
            customProps: (req) => {
                return { requestId: req.id };
            }
        });
    }
}