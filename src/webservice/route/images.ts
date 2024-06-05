import express from "express";
import type { Request, Response, NextFunction } from "express";
import type KubeManager from "../service/KubeManager.js";
import type OidcAuth from "../service/OidcAuth.js";
import commonRequest from "./common.js";
import type ImageDetails from "../../common/model/ImageDetails.js";

const imagesRouter = function(oidcAuth: OidcAuth, km: KubeManager) {
    let routerObj = express.Router();
    
    routerObj.get('/', async (req: Request, res: Response, next: NextFunction) => {
      commonRequest<ImageDetails[]>(req, res, next, oidcAuth, km.images.bind(km));
    });
  
    routerObj.get('/:imageId', async (req: Request, res: Response, next: NextFunction) => {
      commonRequest<null>(req, res, next, oidcAuth, km.imageDetails.bind(km, { image: req.params["imageId"] ?? ""}));
    });

    return routerObj;
  
  }
  
  export default imagesRouter;