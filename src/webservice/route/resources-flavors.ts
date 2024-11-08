import express from 'express';
import type OidcAuth from '../service/OidcAuth.js';
import type KubeManager from '../service/KubeManager.js';
import type { Request } from 'express';
import type { Response } from 'express';
import type { NextFunction } from 'express';
import commonRequest from './common.js';
import type Page from '../../common/model/Page.js';
import type KubeResourcesFlavor from '../../common/model/KubeResourcesFlavor.js';

const resourcesFlavorsRouter = function(oidcAuth: OidcAuth, km: KubeManager) {
    let routerObj = express.Router();
    routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
        commonRequest<Page<KubeResourcesFlavor> | null>(req, res, next, oidcAuth, km.resourcesFlavors.bind(km));
    });

    return routerObj;
  
}

export default resourcesFlavorsRouter;