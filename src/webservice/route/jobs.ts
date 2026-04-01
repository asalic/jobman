import express from 'express';
import type OidcAuth from '../service/OidcAuth.js';
import type KubeManager from '../service/KubeManager.js';
import type { Request } from 'express';
import type { Response } from 'express';
import type { NextFunction } from 'express';
import { commonRequest, pathParam } from './common.js';
import type SubmitProps from '../../common/model/args/SubmitProps.js';
import type JobDetails from '../../common/model/JobDetails.js';
import type JobInfo from '../../common/model/JobInfo.js';
import type Page from '../../common/model/Page.js';
import type JobLog from '../../common/model/JobLog.js';
import type JobSubmiSuccess from '../../common/model/JobSubmitSuccess.js';
import type HarborManager from '../service/HarborManager.js';
import type LoggerService from '../service/LoggerService.js';


const jobsRouter = function(oidcAuth: OidcAuth, km: KubeManager, hm: HarborManager, logger: LoggerService) {
  let routerObj = express.Router();
  
  /**
   * @openapi
*  /jobs/:
*    get:
*      tags:
*        - jobs
*      summary: Get all your jobs
*      description: Get all your jobs
*      operationId: getJobs
*      responses:
*        '200':
*          description: Successful operation
*          content:
*            application/json:
*              schema:
*                $ref: '#/components/schemas/Page-JobInfo'
*        '401':
*          description: Unauthorized
*          content:
*            application/json:
*              schema:
*                $ref: '#/components/schemas/ErrorResponse'
   */
  routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<Page<JobInfo> | null>(req, res, next, oidcAuth, km.list.bind(km), logger);
  });

    /**
   * @openapi
*  /jobs/:
*    post:
*      tags:
*        - jobs
*      summary: Submit a new job
*      operationId: postJob
*      requestBody:
*        description: Information required for the submission of a new job for execution
*        content:
*          application/json:
*            schema:
*              $ref: '#/components/schemas/SubmitProps'
*      responses:
*        '200':
*          description: Successful operation
*          content:
*            application/json:
*              schema:
*                $ref: '#/components/schemas/JobSubmitSuccess'
*        '401':
*          description: Unauthorized
*          content:
*            application/json:
*              schema:
*                $ref: '#/components/schemas/ErrorResponse'
   */
  routerObj.post('/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<JobSubmiSuccess | string | null>(req, res, next, oidcAuth, km.submit.bind(km, hm, req.body as SubmitProps), logger);
  });

      /**
    * @openapi
    *  /jobs/:
    *    delete:
    *      tags:
    *        - jobs
    *      summary: Delete all jobs owned by the user identified by the API token
    *      operationId: deleteAllJobs
    *      responses:
    *        '201':
    *          description: Successful operation
    *        '401':
    *          description: Unauthorized
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/ErrorResponse'
   */
  routerObj.delete('/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<null>(req, res, next, oidcAuth, km.delete.bind(km, { all: true }), logger);
  });
  /**
    * @openapi
    *  /jobs/{jobName}/:    
    *    delete:
    *      tags:
    *        - jobs
    *      summary: Delete a job by name
    *      operationId: deleteJobByName
    *      parameters:
    *        - name: jobName
    *          in: path
    *          description: 'The name of the job you want to delete. It is always prefixed with the name of the user followed by adash followed by the name you used during submission or given automatically if none was specified'
    *          required: true
    *          schema:
    *            type: string
    *      responses:
    *        '201':
    *          description: Successful operation
    *        '401':
    *          description: Unauthorized
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/ErrorResponse'
   * 
   */
  routerObj.delete('/:jobName/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<null>(req, res, next, oidcAuth, km.delete.bind(km, { jobName: pathParam(req, "jobName") }), logger);
  });

  /**
    * @openapi
    *  /jobs/{jobName}/:
    *    get:
    *      tags:
    *        - jobs
    *      summary: Get a job by name
    *      operationId: getJobByName
    *      parameters:
    *        - name: jobName
    *          in: path
    *          description: 'The name of the job you want to delete. It is always prefixed with the name of the user followed by adash followed by the name you used during submission or given automatically if none was specified'
    *          required: true
    *          schema:
    *            type: string
    *      responses:
    *        '200':
    *          description: Successful operation
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/JobDetails'
    *        '401':
    *          description: Unauthorized
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/ErrorResponse'
   */
  routerObj.get('/:jobName/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<JobDetails | null>(req, res, next, oidcAuth, km.details.bind(km, { jobName: pathParam(req, "jobName") }), logger);
  });

  /**
   * @openapi
   *  /jobs/{jobName}/logs/:
    *    get:
    *      tags:
    *        - jobs
    *      summary: Get the logs of a job (its pod) using the name of the job
    *      operationId: getJobLogsByName
    *      parameters:
    *        - name: jobName
    *          in: path
    *          description: 'The name of the job you want to delete. It is always prefixed with the name of the user followed by adash followed by the name you used during submission or given automatically if none was specified'
    *          required: true
    *          schema:
    *            type: string
    *      responses:
    *        '200':
    *          description: Successful operation
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/JobLog'
    *        '401':
    *          description: Unauthorized
    *          content:
    *            application/json:
    *              schema:
    *                $ref: '#/components/schemas/ErrorResponse'
   */
  routerObj.get('/:jobName/logs/', async (req: Request, res: Response, next: NextFunction) => {
    commonRequest<JobLog | null>(req, res, next, oidcAuth, km.log.bind(km, { jobName: pathParam(req, "jobName") }), logger);
  });

  return routerObj;

}

export default jobsRouter;