import express from 'express';
import type OidcAuth from '../service/OidcAuth.js';
import type KubeManager from '../service/KubeManager.js';
import type { Request } from 'express';
import type { Response } from 'express';
import type { NextFunction } from 'express';
import { commonRequest } from './common.js';
import type Page from '../../common/model/Page.js';
import type KubeResourcesFlavor from '../../common/model/KubeResourcesFlavor.js';
import type LoggerService from '../service/LoggerService.js';

const resourcesFlavorsRouter = function(oidcAuth: OidcAuth, km: KubeManager, logger: LoggerService) {
    let routerObj = express.Router();
    /**
    * @openapi
    *  /resources-flavors/:
    *    get:
    *      tags:
    *        - resources-flavors
    *      summary: Get a list of all predefined resources flavors available 
    *      operationId: getResourcesFlavors
    *      responses:
    *        '200':
    *          description: Successful operation
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/Page-KubeResourcesFlavor'
    *        '401':
    *          description: Unauthorized
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/ErrorResponse'
     */
    routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
        commonRequest<Page<KubeResourcesFlavor> | null>(req, res, next, oidcAuth, km.resourcesFlavors.bind(km), logger);
    });

    return routerObj;
  
}

export default resourcesFlavorsRouter;