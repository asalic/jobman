import type { Response, NextFunction, Request } from 'express';
import type UserRepresentation from '../model/UserRepresentation.js';
import type KeycloakApiToken from '../model/KeycloakApiToken.js';
import AuthenticationError from '../error/AuthenticationError.js';
import { KubeOpReturn, KubeOpReturnStatus } from '../../common/model/KubeOpReturn.js';
import type OidcAuth from '../service/OidcAuth.js';
import type AbstractDto from '../../common/model/AbstractDto.js';

async function commonRequest<T extends AbstractDto | null>(req: Request, res: Response, next: NextFunction, oidcAuth: OidcAuth, method: Function) {
    let payload: KubeOpReturn<T | null> | null = null;
    let sc: number = 501;
    try {
      const ur: UserRepresentation = await oidcAuth.auth(req);
      const kapReq: KeycloakApiToken  | null = oidcAuth.validateApiToken(req,  ur);
      if (kapReq) {
        payload = (await method(ur.username));//km[kmMethodName]();
        if (payload?.status === KubeOpReturnStatus.Error) {
          sc = 400;
        } else {
          sc = 200;
        }
      } else {
        sc = 401;
        payload = new KubeOpReturn(KubeOpReturnStatus.Error, "Invalid API token", null);
      }
    } catch(e) {
      if (e instanceof AuthenticationError) {
        sc = 401;
        payload = new KubeOpReturn(KubeOpReturnStatus.Error, `${e.getTitle()}: ${e.getMessage()}`, null);
      } else {
        console.error(e);
        sc = 500;
        payload = new KubeOpReturn(KubeOpReturnStatus.Error, "Something went wrong", null);
      }
    } finally {
      res.status(sc);
      res.send(payload);
      }
  
  }

export default commonRequest;