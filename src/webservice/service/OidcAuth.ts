import type  { Request } from 'express'; 
import { Headers, Response } from 'node-fetch';
import * as jose from 'jose';

import type UserRepresentation from "../model/UserRepresentation.js";
import type KeycloakApiToken from "../model/KeycloakApiToken.js";
import AuthenticationError from "../error/AuthenticationError.js";
import type { SettingsWebService } from '../model/SettingsWebService.js';
import type UserAuthorization from '../model/UserAuthorization.js';
import EAuthorizationType from '../model/EAuthorizationType.js';
import Util from '../../common/Util.js';
import type LoggerService from './LoggerService.js';

interface KeycloakTokenPayload extends jose.JWTPayload {
  preferred_username?: string;
  email?: string;
  name?: string;

  realm_access?: {
    roles: string[];
  };

  resource_access?: {
    [clientId: string]: {
      roles: string[];
    };
  };

  scope?: string;
}


export default class OidcAuth {

    static RETRY_COUNT = 3;
    static RETRY_DELAY = 2000;

    protected appConf: SettingsWebService;
    protected realmUrl: string;
    protected introspectUrl: string;
    protected logger: LoggerService;
    // protected jwks: any;

    constructor(appConf: SettingsWebService, logger: LoggerService) {
        this.appConf = appConf;
        this.realmUrl = `${this.appConf.oidc.url}/realms/${this.appConf.oidc.realm}`
        this.introspectUrl = `${this.realmUrl}/protocol/openid-connect/token/introspect`;
        this.logger = logger;
    }

    public  async authenticateAndAuthorize(req: Request): Promise<string | null> {
      const userAuth: UserAuthorization =  this.getUserAuthorization(req);
      if (userAuth.type === EAuthorizationType.APITOKEN) {
        const ur: UserRepresentation = await this.auth(userAuth.token);
        const kapReq: KeycloakApiToken  | null = this.validateApiToken(userAuth.token,  ur);
        if (kapReq) {
          return ur.username;//ur.id;
        } else {
          return null;
        }

      } else if (userAuth.type === EAuthorizationType.BEARER) {
        const jwks = jose.createRemoteJWKSet(
            new URL(`${this.realmUrl}/protocol/openid-connect/certs`)

        );
        try {
            const { payload } = await jose.jwtVerify(userAuth.token, jwks, {
                issuer: this.realmUrl,
                audience: this.appConf.oidc.audiences[0] ?? "",
            });
            const kcPayload = payload as KeycloakTokenPayload;

            const username = typeof kcPayload.preferred_username === 'string'
                    ? kcPayload?.preferred_username
                    : null;//(kcPayload.sub ?? null);

            return username;
        } catch (e: any) {
            throw new AuthenticationError("Token validation error", e.message ?? "An unknown error has occured when validating your token", 401);
        }
        //const data: any = await this.introspectToken(userAuth.token);
        // this.verifyIntrospectToken(data);
        //return data["preferred_username"];
        // const headers: Headers = new Headers();
        // headers.set("Authorization", `Bearer ${userAuth.token}`);
        // const authR: Response = await fetch(
        // this.appConf.oidc.url + "/realms/" + this.appConf.oidc.realm + "/protocol/openid-connect/userinfo",
        //     {
        //       method: "GET",
        //       headers
        //     }
        //   );
        // if (authR.status === 200) {
        //   const info: any = await authR.json();
        //   return info["preferred_username"];//info["sub"];
        // } else {
        //   return null;
        // }
      } else {
        const msg = `Unsupported authorization with type '${userAuth.type}'`;
        throw  new AuthenticationError("Authorization error", msg, 401);
      }

    }

    protected async introspectToken(token: string, tokenTypeHint = 'access_token'): Promise<any> {
        const body = new URLSearchParams({ token });
        if (tokenTypeHint) {
            body.set('token_type_hint', tokenTypeHint);
        }

        const res = await Util.fetchRetry(this.introspectUrl, {
            method: 'POST',
            headers: {
            'Authorization': 'Basic ' + Buffer.from(`${this.appConf.oidc.clientId}:${this.appConf.oidc.clientSecret}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!res || !res.ok) {
            const text = await res?.text();
            const msg = `Token introspection request failed: ${text}`;
            throw new AuthenticationError(`Token error`, msg, res?.status ?? 500);
        }

        const data: any = await res.json();

        if (!data.active) {
            const msg = 'Token is inactive';
            throw new AuthenticationError(`Token error`, msg, 401);
        }

        return data;
    }

    // protected verifyIntrospectToken(introspectResult: any) {

    //     // Check audience
    //     let isAud = false;
    //     if (Array.isArray(introspectResult["aud"])) {
    //         for (const aud of introspectResult["aud"]) {
    //             if (this.appConf.oidc.audiences.includes(aud)) {
    //                 isAud = true;
    //                 break;
    //             }
    //         }
    //     } else {
    //         if (this.appConf.oidc.audiences.includes(introspectResult["aud"])) {
    //             isAud = true;
    //         }
    //     }
    //     if (!isAud)  {
    //         throw new AuthenticationError("Token error", "Missing audience.", 401);
    //     }

    //     // Check iss
    //     if (introspectResult["iss"]  !==  this.realmUrl) {
    //         throw new AuthenticationError("Token error", "Mismatched iss.", 401);
    //     }

    //     //Check resource access roles
    //     for (const r of this.appConf.oidc.resourceAccessRoles) {
    //         if (!introspectResult["resource_access"]?.[this.appConf.oidc.clientId]?.["roles"]?.includes(r)) {
    //             throw new AuthenticationError("Token error", "Missing resource access role.", 401);
    //         }
    //     }
    // }


    public async auth(token:  string): Promise<UserRepresentation> {
        const reqKap: KeycloakApiToken | null = this.parseReqUserRepresentation(token);
        if (reqKap) {
          const headers: Headers = new Headers();
          //headers.set('client_id', this.appConf.oidc.clientId);
          //headers.set('client_secret', this.appConf.oidc.clientSecret);
          //headers.set('grant_type', "client_credentials");
          headers.set("Content-Type",  "application/x-www-form-urlencoded");
          //headers.set('request_uri', "http://localhost:5000");
          this.logger.info("Obtaining application token");
          const body = new URLSearchParams({
            'client_id': this.appConf.oidc.clientId,
            'client_secret': this.appConf.oidc.clientSecret,
            'grant_type': "client_credentials"});
  
          const authR: Response | null  = await Util.fetchRetry(
                this.appConf.oidc.url + "/realms/" + this.appConf.oidc.realm + "/protocol/openid-connect/token",
                {
                  method: "POST",
                  headers,
                  body
                }
              );
          if (authR && authR.status === 200) {
            const authRJson: {[k: string]: any} = await authR.json() as {[k: string]: any};
            if (authRJson["access_token"]) {
              this.logger.info("Obtain user information for " + reqKap.userId);
              const headers: Headers = new Headers();
              headers.set("Authorization",  `Bearer ${authRJson["access_token"]}`);
              const getUserCredentialsR: Response |  null = await Util.fetchRetry(
                this.appConf.oidc.url + "/admin/realms/" + this.appConf.oidc.realm + "/users/" + reqKap.userId,
                {
                  method: "GET",
                  headers
                }
              );
              if (getUserCredentialsR && getUserCredentialsR.status === 200) {
                const ur: UserRepresentation = this.userRepresentationKeycloak(await getUserCredentialsR.json());
                return ur;
              } else {
                const msg = `Unable to retrieve user information: ${(await getUserCredentialsR?.text()) ?? ""}`;
                throw new AuthenticationError("User info error", msg, getUserCredentialsR?.status ?? 401);
              }          
            } else {
              throw new AuthenticationError("Token error", "The system was unable to obtain a user token", 500);
            }        
          } else {
            throw new AuthenticationError(authR?.statusText ?? "Authentication Error", 
                    (await authR?.text()) ?? "Authentication Error", authR?.status ?? 401);
          }
        } else {
          throw new AuthenticationError("Token error", "Token format invalid", 401);
        }
    }
  
      public userRepresentationKeycloak(resp: any): UserRepresentation {
        const result: {[k: string]: any} = Object.create(null);
        //const resp: any = JSON.parse(json);
        if (resp["id"]) { result["id"] = resp["id"]; }
        else throw new AuthenticationError("Missing field", "Missing field 'id' from Keycloak authentication response", 500);
        if (resp["username"]) { result["username"] = resp["username"]; }
        else throw new AuthenticationError("Missing field", "Missing field 'username' from Keycloak authentication response", 500);
        if (resp["enabled"]) { result["enabled"] = Boolean(resp["enabled"]); }
        else throw new AuthenticationError("Missing field", "Missing field 'enabled' from Keycloak authentication response", 500);
        if (resp["email"]) { result["email"] = resp["email"]; }
        else throw new AuthenticationError("Missing field", "Missing field 'email' from Keycloak authentication response", 500);
        if (resp["attributes"]?.[this.appConf.oidc.apiTokenAttributeName]) { 
          result["apiToken"] = JSON.parse(atob(resp["attributes"]?.[this.appConf.oidc.apiTokenAttributeName])) as KeycloakApiToken; 
        } else throw new AuthenticationError("Missing field", `Missing attribute '${this.appConf.oidc.apiTokenAttributeName}' from Keycloak authentication response`, 500);
        result["firstName"] = resp["firstName"] ?? "";
        result["lastName"] = resp["lastName"] ?? "";
        return result as UserRepresentation;
      }
  
      public validateApiToken(token: string,  ur: UserRepresentation): KeycloakApiToken | null {
      const kapReq: KeycloakApiToken | null = this.parseReqUserRepresentation(token);
      if (kapReq && kapReq.secret === ur.apiToken.secret) {
        return kapReq;
      } else {
        return null;
      }
    }

    public getUserAuthorization(req: Request): UserAuthorization {
      const token: string | null | undefined = req.headers["authorization"];
      if (token) {
        const parts: string[] = token.split(" ");
        if (parts.length === 2 && parts[0] && parts[1] && parts[1].length > 0) {
          const type: string = parts[0].toLowerCase();
          switch (type) {
            case EAuthorizationType.BEARER: return {type: EAuthorizationType.BEARER, token: parts[1] };
            case EAuthorizationType.APITOKEN: return {type: EAuthorizationType.APITOKEN, token: parts[1] };
            default: throw new Error(`Unsupported authroization type '${type}'`);
          }
        } else {
          throw new AuthenticationError(`Invalid authorization header.`, 
            `Cannot parse authorization header. It should be either 'Bearer' or 'ApiToken' followed by the actual token, split by a single space.`, 401);
        }
      } else {
        throw new AuthenticationError(`Missing authorization header.`, 
          `No value found for the authorization value. It should be either 'Bearer' or 'ApiToken' followed by the actual token, split by a single space.`, 401);
      }

    }
  
    public parseReqUserRepresentation(token: string): KeycloakApiToken | null {
          return JSON.parse(Buffer.from(token, 'base64').toString('utf-8')) as KeycloakApiToken;
    }
}