import express from 'express';
import type OidcAuth from '../service/OidcAuth.js';
import type KubeManager from '../service/KubeManager.js';
import type { Request } from 'express';
import type { Response } from 'express';
import type { NextFunction } from 'express';
import commonRequest from './common';
import type QueueResultDisplay from '../../common/model/QueueResultDisplay.js';

const queueRouter = function(oidcAuth: OidcAuth, km: KubeManager) {
    let routerObj = express.Router();
    routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
        commonRequest<QueueResultDisplay | null>(req, res, next, oidcAuth, km.queue.bind(km));
    });

    return routerObj;
  
}

export default queueRouter;