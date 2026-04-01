import express from 'express';
import type OidcAuth from '../service/OidcAuth.js';
import type KubeManager from '../service/KubeManager.js';
import type { Request } from 'express';
import type { Response } from 'express';
import type { NextFunction } from 'express';
import { commonRequest } from './common.js';
import type QueueResultDisplay from '../../common/model/QueueResultDisplay.js';
import type LoggerService from '../service/LoggerService.js';

const queueRouter = function(oidcAuth: OidcAuth, km: KubeManager, logger: LoggerService) {
    let routerObj = express.Router();

    /**
    * @openapi
    *  /queue/:
    *    get:
    *      tags:
    *        - queue
    *      summary: Get the queue of all jobs and all users 
    *      operationId: getQueue
    *      responses:
    *        '200':
    *          description: Successful operation
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/QueueResultDisplay'
    *        '401':
    *          description: Unauthorized
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/ErrorResponse'
     */
    routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
        commonRequest<QueueResultDisplay | null>(req, res, next, oidcAuth, km.queue.bind(km), logger);
    });

    return routerObj;
  
}

export default queueRouter;