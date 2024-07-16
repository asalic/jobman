import type  { Request } from 'express'; 
import fetch, { Headers, Response } from 'node-fetch';
import type UserRepresentation from "../model/UserRepresentation.js";
import type KeycloakApiToken from "../model/KeycloakApiToken.js";
import AuthenticationError from "../error/AuthenticationError.js";
import type { SettingsWebService } from '../model/SettingsWebService.js';


export default class OidcAuth {

    protected appConf: SettingsWebService;

    constructor(appConf: SettingsWebService) {
        this.appConf = appConf;
    }

    public async auth(req: Request): Promise<UserRepresentation> {
        const reqKap: KeycloakApiToken | null = this.parseReqUserRepresentation(req);
        if (reqKap) {
          const headers: Headers = new Headers();
          //headers.set('client_id', this.appConf.oidc.clientId);
          //headers.set('client_secret', this.appConf.oidc.clientSecret);
          //headers.set('grant_type', "client_credentials");
          headers.set("Content-Type",  "application/x-www-form-urlencoded");
          //headers.set('request_uri', "http://localhost:5000");
          console.log("Obtain application token");
          const body = new URLSearchParams({
            'client_id': this.appConf.oidc.clientId,
            'client_secret': this.appConf.oidc.clientSecret,
            'grant_type': "client_credentials"});
  
          const authR: Response = await fetch(
                this.appConf.oidc.url + "/realms/" + this.appConf.oidc.realm + "/protocol/openid-connect/token",
                {
                  method: "POST",
                  headers,
                  body
                }
              );
          if (authR.status === 200) {
            const authRJson: {[k: string]: any} = await authR.json() as {[k: string]: any};
            if (authRJson["access_token"]) {
              console.log("Obtain user information for " + reqKap.userId);
              const headers: Headers = new Headers();
              headers.set("Authorization",  `Bearer ${authRJson["access_token"]}`);
              const getUserCredentialsR: Response = await fetch(
                this.appConf.oidc.url + "/admin/realms/" + this.appConf.oidc.realm + "/users/" + reqKap.userId,
                {
                  method: "GET",
                  headers
                }
              );
              if (getUserCredentialsR.status === 200) {
                const ur: UserRepresentation = this.userRepresentationKeycloak(await getUserCredentialsR.json());
                return ur;
              } else {
                throw new AuthenticationError("Unable to retrieve user information", await getUserCredentialsR.text(), getUserCredentialsR.status);
              }          
            } else {
              throw new AuthenticationError("Token missing", "The system was unable to obtain a user token", 500);
            }        
          } else {
            console.error(authR);
            throw new AuthenticationError(authR.statusText, await authR.text(), authR.status);
          }
        } else {
          throw new AuthenticationError("Token format invalid", "", 401);
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
  
      public validateApiToken(req:  Request,  ur: UserRepresentation): KeycloakApiToken | null {
      const kapReq: KeycloakApiToken | null = this.parseReqUserRepresentation(req);
      if (kapReq && kapReq.secret === ur.apiToken.secret) {
        return kapReq;
      } else {
        return null;
      }
    }
  
    public parseReqUserRepresentation(req: Request): KeycloakApiToken | null {
      const token: string | null | undefined = req.headers["authorization"];
      if (token) {
        const parts: string[] = token.split(" ");
        if (parts.length === 2 && parts[1] && parts[1].length > 0) {
          //console.log(Buffer.from(parts[1], 'base64').toString('utf-8'));
          return JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8')) as KeycloakApiToken;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }
}