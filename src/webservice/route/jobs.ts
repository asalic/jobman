import express from 'express';
import type OidcAuth from '../service/OidcAuth.js';
import type { IJobInfo } from '../../common/model/IJobInfo.js';
import type KubeManager from '../service/KubeManager.js';
import type { Request } from 'express';
import type { Response } from 'express';
import type { NextFunction } from 'express';
import commonRequest from './common';
import type SubmitProps from '../../common/model/args/SubmitProps.js';
import type { V1Job } from '@kubernetes/client-node';


const jobsRouter = function(oidcAuth: OidcAuth, km: KubeManager) {
  let routerObj = express.Router();
  
  routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<IJobInfo[] | null>(req, res, next, oidcAuth, km.list.bind(km));
  });

  routerObj.post('/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<null>(req, res, next, oidcAuth, km.submit.bind(km, req.body as SubmitProps));
  });

  routerObj.delete('/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<null>(req, res, next, oidcAuth, km.delete.bind(km, { all: true }));
  });

  routerObj.delete('/:jobName', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<null>(req, res, next, oidcAuth, km.delete.bind(km, { jobName: req.params["jobName"] ?? "" }));
  });


  routerObj.get('/:jobName/details', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<V1Job | null>(req, res, next, oidcAuth, km.details.bind(km, { jobName: req.params["jobName"] ?? "" }));
  });

  routerObj.get('/:jobName/logs', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<V1Job | null>(req, res, next, oidcAuth, km.log.bind(km, { jobName: req.params["jobName"] ?? ""}));
  });

  return routerObj;

}

export default jobsRouter;