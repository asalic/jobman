import type { Response, NextFunction, Request } from 'express';
import type UserRepresentation from '../model/UserRepresentation.js';
import type KeycloakApiToken from '../model/KeycloakApiToken.js';
import AuthenticationError from '../error/AuthenticationError.js';
import { KubeOpReturn, KubeOpReturnStatus } from '../../common/model/KubeOpReturn.js';
import type OidcAuth from '../service/OidcAuth.js';
import type AbstractDto from '../../common/model/AbstractDto.js';
import type ErrorResponse from '../../common/model/ErrorResponse.js';

async function commonRequest<T extends AbstractDto | string | null>(req: Request, res: Response, next: NextFunction, oidcAuth: OidcAuth, method: Function) {
    let payload: KubeOpReturn<T | null> | null = null;
    let respPayload: ErrorResponse | any = null;
    let sc: number = 501;
    try {
      const ur: UserRepresentation = await oidcAuth.auth(req);
      const kapReq: KeycloakApiToken  | null = oidcAuth.validateApiToken(req,  ur);
      if (kapReq) {
        payload = (await method(ur.username));//km[kmMethodName]();
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
        respPayload = {message: "Invalid API token", status: sc };
        //payload = new KubeOpReturn(KubeOpReturnStatus.Error, "Invalid API token", null);
      }
    } catch(e) {
      if (e instanceof AuthenticationError) {
        sc = 401;
        respPayload = {message: `${e.getTitle()}: ${e.getMessage()}`, status: sc };
      } else {
        console.error(e);
        sc = 500;
        respPayload = {message: "Something went wrong", status: sc };
      }
    } finally {
      res.status(sc);
      res.send(respPayload);
    }
  
  }

export default commonRequest;