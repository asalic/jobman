import express from 'express';
import type OidcAuth from '../service/OidcAuth.js';
import type KubeManager from '../service/KubeManager.js';
import type { Request } from 'express';
import type { Response } from 'express';
import type { NextFunction } from 'express';
import commonRequest from './common.js';
import type KubeResourcesFlavorPage from '../../common/model/KubeResourcesFlavorPage.js';

const resourcesFlavorsRouter = function(oidcAuth: OidcAuth, km: KubeManager) {
    let routerObj = express.Router();
    routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
        commonRequest<KubeResourcesFlavorPage | null>(req, res, next, oidcAuth, km.resourcesFlavors.bind(km));
    });

    return routerObj;
  
}

export default resourcesFlavorsRouter;