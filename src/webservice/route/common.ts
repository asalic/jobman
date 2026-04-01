import type { Response, NextFunction, Request } from 'express';
import AuthenticationError from '../error/AuthenticationError.js';
import { KubeOpReturn, KubeOpReturnStatus } from '../../common/model/KubeOpReturn.js';
import type OidcAuth from '../service/OidcAuth.js';
import type AbstractDto from '../../common/model/AbstractDto.js';
import type ErrorResponse from '../../common/model/ErrorResponse.js';
import type LoggerService from '../service/LoggerService.js';
import Util from '../../common/Util.js';

export async function commonRequest<T extends AbstractDto | string | null>(req: Request, 
        res: Response, next: NextFunction, oidcAuth: OidcAuth, method: Function, 
        logger: LoggerService) {
    let payload: KubeOpReturn<T | null> | null = null;
    let respPayload: ErrorResponse | any = null;
    let sc: number = 501;
    try {
      const username: string  | null = await oidcAuth.authenticateAndAuthorize(req);
      if (username) {
        payload = (await method(username));//km[kmMethodName]();
        if (payload?.status === KubeOpReturnStatus.Error) {
          sc = 400;
          respPayload = {message: payload.message, status: sc };
        } else {
          if (payload?.payload){
            sc = 200;
          } else {
            sc = 201;
          }
          respPayload = payload?.payload;
        }
      } else {
        sc = 401;
        respPayload = {message: "Invalid token", status: sc };
        //payload = new KubeOpReturn(KubeOpReturnStatus.Error, "Invalid API token", null);
      }
    } catch(e: unknown) {
      if (e instanceof AuthenticationError) {
        sc = 401;
        const message = `${e.getTitle()}: ${e.getMessage()}`;
        logger.error(message);
        respPayload = {message, status: sc };
      } else {
        const message = "Something went wrong";
        logger.error(`Something went wrong: ${Util.getErrorMessage(e)}`);
        sc = 500;
        respPayload = {message, status: sc };
      }
    } finally {
      res.status(sc);
      res.send(respPayload);
    }
  
  }

export function pathParam(req: Request, param: string): string {
    const jn = req.params[param];
    let value = null;
    if (Array.isArray(jn)) {
        throw new Error(`Multiple values found for param '${param}': ${jn.join(", ")}`);
    } else {
        value = jn
    }
    if (value) {
        return value;
    } else {
        throw new Error(`Missing value for path param '${param}'`);
    }
}

