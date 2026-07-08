
import type ImageDetailsProps from "../../common/model/args/ImageDetailsProps.js";
import { KubeOpReturnStatus, KubeOpReturn } from "../../common/model/KubeOpReturn.js";
import type { SettingsWebService } from "../model/SettingsWebService.js";
import type HarborRepository from "../model/HarborRepository.js";
import type { HarborProject } from "../model/SettingsWebService.js";
import type Artifact from "../../common/model/Artifact.js";
import type Page from "../../common/model/Page.js";
import type { HarborRespositoryArtifact } from "../model/HarborRespositoryArtifact.js";
import type ImageRepo from "../../common/model/ImageRepo.js";
import type ImageInfo from "../model/ImageInfo.js";
import Util from "../../common/Util.js";
import type LoggerService from "./LoggerService.js";

export default class HarborManager {

    protected settings: SettingsWebService;
    protected logger: LoggerService;

    public constructor(settings: SettingsWebService,  logger: LoggerService) {
        // this.checkSettings(settings);
        this.settings = settings;
        this.logger = logger;
    }

    public async imageDetails(props: ImageDetailsProps, userId: string): Promise<KubeOpReturn<string | null>> {
        if (!props.image) {
            return new KubeOpReturn(KubeOpReturnStatus.Error, "Please specify an image name", null);
        }
        for (const hp of this.settings.harborProjects) {        
            const reposUrl = `${hp.baseUrl}/api/v2.0/projects/${hp.name}/repositories`;
            //this.logger.info(`Getting repos from ${reposUrl}`);
            // const agent = new https.Agent({
            //     rejectUnauthorized: false,
            // });
            const response: Response | null = await Util.fetchRetry(reposUrl, {
                // dispatcher: agent,
                ...hp.token && {headers: [["authorization", `Basic ${hp.token}`]]}
            });
            if (response?.ok) {
                const prjRepos: HarborRepository[] = await response.json() as HarborRepository[];
                for (const repo of prjRepos) {
                    // Get repo name, remove project name 
                    const name: string = repo.name.substring(repo.name.indexOf("/") + 1, repo.name.length);
                    if (name === props.image) {
                        return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, repo.description);
                    }
                }
            } else {
                this.logger.error(`Unable to load repositories from '${reposUrl}'`);
            }
        }
        return new KubeOpReturn(KubeOpReturnStatus.Error, `No image with name '${props.image}' found.`, null);
    }

    public async images(userId: string): Promise<KubeOpReturn<Page<ImageRepo> | null>> {
        const imageDetails: ImageRepo[] = [];
        for (const hp of this.settings.harborProjects) {
            const projImgs: KubeOpReturn<ImageRepo[]>  = await this.getHarborImages(hp);
            if (projImgs.isOk() && projImgs.payload) {
                imageDetails.push(...projImgs.payload);
            } else {
                this.logger.error(projImgs.message ?? `An error occured when loading Harbor images fron ${hp.baseUrl}/${hp.name}`);
            }    
        }
        return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, { data: imageDetails, size: imageDetails.length, 
            total: imageDetails.length, skip: 0} );
    }

    public async getHarborImages(hp: HarborProject): Promise<KubeOpReturn<ImageRepo[]>> {
        const projsUrl = `${hp.baseUrl}/api/v2.0/projects`
        const reposUrl = `${projsUrl}/${hp.name}/repositories`;
        this.logger.info(`Getting repos from ${reposUrl}`);
        // const agent = new https.Agent({
        //     rejectUnauthorized: false,
        //     });
        
        let pageNum = 1;
        let reposCnt = 0;
        const pageSize = 100;
        const result: ImageRepo[] = [];
        let error = false;
        do {
            const response: Response | null = await Util.fetchRetry(`${reposUrl}?page=${pageNum}&page_size=${pageSize}`, 
                {
                    // agent,
                    ...hp.token && {headers: [["authorization", `Basic ${hp.token}`]]}
                });
            if (response?.ok) {
                const prjRepos: HarborRepository[] = await response.json() as HarborRepository[];
                reposCnt = prjRepos.length;
                for (const repo of prjRepos) {
                    // Get repo name, remove project name 
                    const name: string = repo.name.substring(repo.name.indexOf("/") + 1, repo.name.length);
                    const description: string = repo.description;
                    const artifacts: Artifact[] = []
                    result.push({name, repository: repo.name, artifacts, description})
                    
                    const artsUrl = `${reposUrl}/${name}/artifacts`;
                    const rArtifacts: Response | null = await Util.fetchRetry(`${artsUrl}?page_size=${repo.artifact_count}`, 
                        {
                            // agent,
                            ...hp.token && {headers: [["authorization", `basic ${hp.token}`]]}
                        });
                    if (rArtifacts?.ok) {
                        const arts: HarborRespositoryArtifact[] = await rArtifacts.json() as HarborRespositoryArtifact[];
                        
                        for (const art of arts ) {
                            // const rCallManifest: Response = await this.fetchCustom(`${hp.baseUrl}/api/v2.0/${hp.name}/${repo.name}/manifests/art.digest`, 
                            //     {
                            //         agent,
                            //         ...hp.token && {headers: [["authorization", `Basic ${hp.token}`]]}
                            //     });
                            // if (rCallManifest.ok) {
                            //     const digest = await rCallManifest.json() as HarborRepository[];
                            //     TODO: finish
                            // }
                            artifacts.push({
                                entrypoint: [],
                                cmd: [],
                                digest: art.digest,
                                tags: art.tags !== null ? art.tags.map(t => t.name) : []
                                
                            })
                            // this.logger.info(art);
                            // if (art.tags !== null) {
                            //     for (const tag of art.tags) {
                            //         const artUrl = `${artsUrl}/${tag.name}`;
                            //         const artifact: Response = await this.fetchCustom(`${artUrl}`, 
                            //         {
                            //             agent,
                            //             ...hp.token && {headers: [["Autorization", `Bearer ${hp.token}`]]}
                            //         });
                            //     }
                            //     // if (art.tags !== null)
                            //     //     tags.push(...art.tags.map(t => t.name));
                            // }
                        }
                    } else {
                        this.logger.warn(`Unable to load artifacts from ${artsUrl}, error: '${await rArtifacts?.text()}'`);
                    }
                } 
                ++pageNum;      
            } else {
                error = true;
                this.logger.error(`Unable to load repositories from '${reposUrl}?page=${pageNum}&page_size=${pageSize}', API responded with code '${response?.statusText}' and message: ${JSON.stringify(await response?.json())}`);
                // If the first page fails, don't try again
                break;
            }
        } while (reposCnt === pageSize);
        if (error)
            return new KubeOpReturn(KubeOpReturnStatus.Error, `Unable to load repositories from '${reposUrl}`, result);
        else
            return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, result);

    }

    public async getImageInfo(submitImage: string | null | undefined): Promise<ImageInfo> {
        if (submitImage) {
            let submitImageName = null;
            let tag = null;
            let digest = null;
            const tagSemiColPos = submitImage.lastIndexOf(":");
            const atPos = submitImage.lastIndexOf("@");
            // Get tag or digest and image name without
            if (atPos === -1) {
                if (tagSemiColPos === -1) {
                    // No tag
                    tag = "latest";
                    submitImageName = submitImage
                } else if (tagSemiColPos < submitImage.lastIndexOf("/")) {
                    // The semicolon is for the port
                    tag = "latest";
                    submitImageName = submitImage;
                } else {
                    // Semicolon marks the tag
                    tag = submitImage.substring(tagSemiColPos + 1);
                    submitImageName = submitImage.substring(0, tagSemiColPos);
                }
            } else {
                digest = submitImage.substring(atPos + 1);
                submitImageName = submitImage.substring(0, atPos);
            }

            if (!digest && ! tag) {
                this.logger.error(`Cannot extract tag or digest from image name '${submitImage}'`)
            }
            let matched: ImageInfo[] = [];
            // Check all the available repos for the requested image
            for (const hp of this.settings.harborProjects) {
                const projImgs: KubeOpReturn<ImageRepo[]>  = await this.getHarborImages(hp);
                if (projImgs.isOk() && projImgs.payload) {
                    const prefix = `${hp.baseUrl}/${hp.name}`
                    for (const projImg of projImgs.payload) {
                        const fullImgURL = `${prefix}/${projImg.name}`;
                        if (projImg.name === submitImageName || fullImgURL.endsWith(submitImageName)) {
                            // this.logger.debug(`--- Image matched with '${projImg.name}' or '${fullImgURL}'`)
                            let tagDigest = null;
                            if (tag) {
                                for (const artifact of projImg.artifacts) {
                                    if (artifact.tags.includes(tag)) {
                                        tagDigest = `:${tag}`;
                                        break;
                                    }
                                }
                            } else if (digest) {
                                tagDigest = projImg.artifacts.find(a => a.digest === digest) ?
                                                `@${digest}` : null;
                            }
                            if (tagDigest) {
                                matched.push({
                                    fullUrl: `${fullImgURL}${tagDigest}`,
                                    imagePullSecrets: hp.imagePullSecrets
                            });
                            }
                        } 
                    }
                } else {
                    this.logger.error(projImgs.message ?? `An error occured when loading Harbor images fron ${hp.baseUrl}/${hp.name}`);
                }
            }

            matched = matched.map(i => ({...i, fullUrl: i.fullUrl.replace(/^https?:\/\//i,'')}));
            if (matched.length === 0) {
                throw new Error(`Image '${submitImage}' not found.`);
            } else if (matched.length === 1) {
                const result = matched[0]; 
                // need this line because the Typescript compiler doesn't understand the check for one element...
                if (result === undefined) throw new Error(`Image '${submitImage}' not found.`);
                return result;
            } else {
                const msg = `Multiple images matched '${submitImage}': ${matched.map(i => i.fullUrl).join(", ")}. Please contact the administrator, or use the full Docker compatible URL.`
                throw new Error(msg);
            }
        } else {
            if (this.settings.job.defaultImage && this.settings.job.defaultImage.fullUrl) {
                return this.settings.job.defaultImage;
            } else {
                throw new Error(`No default image defined by the platform. Please specify a valid input image.`)
            }
        }
        
    }

    // protected fetchCustom(url: string, init?: RequestInit): Promise<Response> {
    //     return fetch(url, init);
    // }

    protected checkSettings(settings: SettingsWebService) {
        // Check if the harbor repos start with http(s)
        for (const hp of settings.harborProjects) {
            if (hp.baseUrl.startsWith("http://") || hp.baseUrl.startsWith("https://")) {
                throw new Error(`Harbor repository with base URL '${hp.baseUrl}' starts with http(s), it shouldn't as per Docker documentation.`)
            }
        }
    }

}