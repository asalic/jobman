import { KubeConfig, BatchV1Api, V1Job, V1JobStatus, V1DeleteOptions, Watch, 
        CoreV1Api, V1PodList, HttpError, V1Pod, V1ConfigMap, 
        //V1Volume, V1VolumeMount, 
        V1PodSecurityContext, V1ResourceRequirements, 
        V1EnvVar} from '@kubernetes/client-node';
import { v4 as uuidv4 }  from "uuid";
import log from "loglevel";
import fetch from "node-fetch";
import type { RequestInit, Response } from "node-fetch";
import https from "https";
import fs from "node:fs";
//import path from "node:path";
import JobInfo from '../../common/model/JobInfo.js';
import ParameterException from '../../common/model/exception/ParameterException.js';
import type SubmitProps from '../../common/model/args/SubmitProps.js';
//import NotImplementedException from '../model/exception/NotImplementedException.js';
import { KubeOpReturn, KubeOpReturnStatus } from '../../common/model/KubeOpReturn.js';
import UnhandledValueException from '../model/exception/UnhandledValueException.js';
import type ImageDetails from '../../common/model/ImageDetails.js';
import type HarborRepository from '../model/HarborRepository.js';
import type { HarborRespositoryArtifact } from '../model/HarborRespositoryArtifact.js';
import KubeException from '../model/exception/KubeException.js';
import type DetailsProps from '../../common/model/args/DetailsProps.js';
import type LogProps from '../../common/model/args/LogProps.js';
import type DeleteProps from '../../common/model/args/DeleteProps.js';
import type ImageDetailsProps from '../../common/model/args/ImageDetailsProps.js';
import KubeResourcesPrep from './KubeResourcesPrep.js';
import QueueResult from '../../common/model/QueueResult.js';
import type QueueConfigMap from '../model/QueueConfigMap.js';
import QueueResultDisplay from '../../common/model/QueueResultDisplay.js';
import type DeleteJobHandlerResult from '../model/DeleteJobHandlerResult.js';
import LoggerService from './LoggerService.js';
import { KubeConfigType } from "../model/SettingsWebService.js";
import type { KubeConfigLocal, SecurityContext, SettingsWebService } from "../model/SettingsWebService.js";
import type HarborProject from '../model/SettingsWebService.js';
import type KubeResourcesFlavor from "../../common/model/KubeResourcesFlavor.js";
import EJobStatus from '../../common/model/EJobStatus.js';
import Util from '../../common/Util.js';
import type JobDetails from '../../common/model/JobDetails.js';
import type Page from '../../common/model/Page.js';
import type JobLog from '../../common/model/JobLog.js';


export default class KubeManager {

    protected logger: LoggerService;
    protected clusterConfig: KubeConfig;
    protected k8sApi: BatchV1Api;
    protected k8sCoreApi: CoreV1Api;
    protected settings: SettingsWebService;
    protected watch: Watch;

    public constructor(settings: SettingsWebService) {
        this.logger = new LoggerService();
        this.settings = settings;
        this.clusterConfig = this.loadKubeConfig(settings.kubeConfig);
        this.k8sApi = this.clusterConfig.makeApiClient(BatchV1Api);
        this.k8sCoreApi = this.clusterConfig.makeApiClient(CoreV1Api);
        this.watch = new Watch(this.clusterConfig);
    }

    public async queue(userId: string):  Promise<KubeOpReturn<QueueResultDisplay | null>> {
        try {

            const cm: V1ConfigMap = await this.getConfigmap(this.settings.jobsQueue.configmap, this.settings.jobsQueue.namespace);
            if (cm) {
                const queue: QueueConfigMap | null = cm.data?.[this.settings.jobsQueue.configmap] 
                    ? JSON.parse(cm.data[this.settings.jobsQueue.configmap] ?? "") as QueueConfigMap : null;
                const result: {[key: string]: QueueResult} = Object.create(null);//new Map<string, QueueResult>();
                if (queue) {
                    for (const j of queue.jobs) {
                        const cpu: string | undefined = j.resources.requests?.["cpu"];
                        const memory: string | undefined = j.resources.requests?.["memory"];
                        let gpu: number | undefined = 0;
                        for (const v of this.settings.jobsQueue.gpuResources) {
                            if (j.resources.requests?.[v]) {
                                gpu += Number(j.resources.requests[v]);
                            }
                        }

                        let flavor  = undefined;
                        let qr: QueueResult | undefined = undefined;
                        let id: string | undefined = undefined;
                        if (j.resources.flavor) {
                            flavor = j.resources.flavor;
                            id = flavor;
                        } else {
                            //flavor = "<no label>";//`unk-${uuidv4()}`
                            id = `${cpu}/${memory}/${gpu}`;
                        }
                        qr = result[id];
                        if (qr === undefined) {
                            qr = {
                                id,
                                flavor,
                                totalPending: 0,
                                totalRunning: 0,
                                //count: 1,
                                cpu, memory, gpu,
                                //userJobsCnt: isUserJob ? 1 : 0
                            };
                            result[id] =  qr;
                        }

                        //qr.count = qr.count + 1;
                        qr.totalPending += (j.podStatus === "Pending" ? 1 : 0);
                        qr.totalRunning += (j.podStatus === "Running" ? 1 : 0);                     
                        
                    }
                    return new KubeOpReturn(this.getStatusKubeOp(200), undefined, {result, updated: queue.updated});
                } else {
                    throw new KubeException("The queue is not available, please make sure the settings are correct and the CronJob has been started on the cluster.");
                }
            } else {
                throw new KubeException(`Unable to retrieve configmap ${this.settings.jobsQueue.configmap}  from namespace ${this.settings.jobsQueue.namespace}`);
            }
        } catch (e) {
            return this.handleKubeOpsError(e);
        }
    }

    public async submit(props: SubmitProps, userId: string): Promise<KubeOpReturn<null>> {
        try {
            // if (!props.image) {
            //     return new KubeOpReturn(KubeOpReturnStatus.Error,
            //         "Please specify an image and tag. Use the 'images' command to see the available images and tags for each of them.",
            //         null);
            // } else {            
            //console.log(`Parameters sent to the job's container: ${JSON.stringify(props.command)}`);
            const kr: KubeResourcesFlavor = KubeResourcesPrep.getKubeResources(this.settings, props.resources);
            const jn: string = this.getInternalJobName(userId, props.jobName);
            const imageNmTag: string | undefined = props.image ?? this.settings.job.defaultImage;
            if (!imageNmTag || imageNmTag.length === 0) {
                throw new ParameterException(
                    `Please specify an image name and a tag either using the command line parameters or defining a default value in application's settings`); 
            }
            let prefix = "";
            const [imgNm, imgTag] = imageNmTag.split(":");
            for (const hp of this.settings.harborProjects) {
                const projImgs: KubeOpReturn<ImageDetails[]>  = await this.getHarborImages(hp);
                if (projImgs.isOk() && projImgs.payload) {
                    const f:ImageDetails | undefined = projImgs.payload.find((id: ImageDetails) => id.name === imgNm && id.tags.find(t => t === imgTag) !== undefined);
                    if (f) {
                        const u = new URL(hp.baseUrl);
                        prefix = `${u.hostname}${u.port !== "" ? ":" + u.port : ""}/${hp.name}/`;
                        break;
                    }
                } else {
                    console.error(projImgs.message);
                }    
            }
            const image = prefix + imageNmTag;
            const namespace = this.getNamespace();
            console.log(`Using image '${image}'`);
            //console.log("Preparing volumes...");
            //const [volumes, volumeMounts] = await this.prepareJobVolumes();
            const job: V1Job = new V1Job();
            const annotations = this.getAnnotations(kr, props, userId);
            job.metadata = {
                name: jn,
                namespace,
                ...annotations && {annotations}
            }
            job.kind = "Job";
            const securityContext: SecurityContext | undefined | null = this.settings.job.securityContext;
            // if (securityContext && this.settings.job.userConfigmap) {
            //     const userConfigmap: V1ConfigMap = await this.getConfigmap(this.settings.job.userConfigmap);
            //     const sgs: string | undefined | null = userConfigmap.data?.["ceph.gid"]
            //     if (sgs) {
            //         securityContext.supplementalGroups = [Number(sgs)];
            //     }
            // }
            const priorityClassName: string | undefined | null = this.settings.job.priorityClassName;
            const cmdArgs: string[] | undefined = props.commandArgs ? (props.commandArgs.length === 0 ? undefined : props.commandArgs) : props.commandArgs;
            //const command: string[] | undefined = props.command ? cmdArgs : undefined;
            const args: string[] | undefined = //props.command ? undefined : 
                cmdArgs;
            const env: Array<V1EnvVar> | undefined = props.env?.map(e => Object.assign(new V1EnvVar(),  e));
            job.spec = {
                backoffLimit: 0,
                template: {
                    metadata: {
                        name: jn
                    },
                    spec: {
                        ...securityContext && {securityContext: {...new V1PodSecurityContext(), ...securityContext} },
                        ...priorityClassName && {priorityClassName},
                        //...volumes && {volumes},
                        containers: [
                            {
                                name: `container-${jn}`,
                                image,
                                ...env && { env },
                                //...command && {command},
                                ...args && {args},
                                //...volumeMounts && {volumeMounts},
                                resources: {...new V1ResourceRequirements(), ...kr.resources}
                            }
                        ],
                        restartPolicy: "Never"
                    }
                }

            }
            if (props.dryRun) {
                return new KubeOpReturn(KubeOpReturnStatus.Success, "\n" + JSON.stringify(job, null, 2), null);

            } else {
                const r = await this.k8sApi.createNamespacedJob(namespace, job);
                return new KubeOpReturn(this.getStatusKubeOp(r.response.statusCode), 
                    `Job named '${jn}' created successfully by user '${userId}'`, null);

            }
            //}
        
        } catch (e) {
            return this.handleKubeOpsError(e);
        }
    }

    public async list(userId: string): Promise<KubeOpReturn<Page<JobInfo> | null>> {
        try {
            const r: KubeOpReturn<V1Job[]> = (await this.getJobsList(this.getNamespace(), userId));
            // const jobsQueue: V1ConfigMap = await this.getConfigmap(
            //     this.settings.jobsQueue.configmap, this.settings.jobsQueue.namespace);
            if (r.payload) {
                const res: JobInfo[] = [];
                for (const e of r.payload) {
                    const jn = e.metadata?.name;
                    if (jn) {
                        res.push({ name: this.getJobName(userId, jn),
                            uid: e.metadata?.uid,
                            status: await this.getStatusJob(jn, e.status, userId),
                            dateLaunched: e.metadata?.creationTimestamp?.getTime() ?? null,
                            position: 0,//jobsQueue?.data?.["jobs"]?.find(j => j.name === jn && j.user === this.getUsername())?.
                            flavor: e.metadata?.annotations?.["chaimeleon.eu/jobResourcesFlavor"] ?? "-"
                        });
                    }
                }
                res.sort(function(a,b){return (b.dateLaunched ?? 0) 
                        - (a.dateLaunched ?? 0)});
                return new KubeOpReturn(KubeOpReturnStatus.Success, r.message, { data: res, size: res.length, total: res.length, skip: 0 });
            } else {
                return new KubeOpReturn(KubeOpReturnStatus.Success, "Empty jobs list", { data: [], size: 0, total: 0, skip: 0 });
            }
        } catch (e) {
            return this.handleKubeOpsError(e);
        }
    }

    public async imageDetails(props: ImageDetailsProps, userId: string): Promise<KubeOpReturn<string | null>> {
        if (!props.image) {
            return new KubeOpReturn(KubeOpReturnStatus.Error, "Please specify an image name", null);
        }
        for (const hp of this.settings.harborProjects) {        
            const reposUrl = `${hp.baseUrl}/api/v2.0/projects/${hp.name}/repositories`;
            //console.log(`Getting repos from ${reposUrl}`);
            const agent = new https.Agent({
                rejectUnauthorized: false,
            });
            const response: Response = await this.fetchCustom(reposUrl, {
                agent,
                ...hp.token && {headers: [["authorization", `Basic ${hp.token}`]]}
            });
            if (response.ok) {
                const prjRepos: HarborRepository[] = await response.json() as HarborRepository[];
                for (const repo of prjRepos) {
                    // Get repo name, remove project name 
                    const name: string = repo.name.substring(repo.name.indexOf("/") + 1, repo.name.length);
                    if (name === props.image) {
                        return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, repo.description);
                    }
                }
            } else {
                console.error(`Unable to load repositories from '${reposUrl}'`);
            }
        }
        return new KubeOpReturn(KubeOpReturnStatus.Error, `No image with name '${props.image}' found.`, null);
    }

    public async images(userId: string): Promise<KubeOpReturn<Page<ImageDetails> | null>> {
        const imageDetails: ImageDetails[] = [];
        for (const hp of this.settings.harborProjects) {
            const projImgs: KubeOpReturn<ImageDetails[]>  = await this.getHarborImages(hp);
            if (projImgs.isOk() && projImgs.payload) {
                imageDetails.push(...projImgs.payload);
            } else {
                console.error(projImgs.message);
            }    
        }
        return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, { data: imageDetails, size: imageDetails.length, 
            total: imageDetails.length, skip: 0} );
    }

    public async details(props: DetailsProps, userId: string): Promise<KubeOpReturn<JobDetails | null>> {
        if (props.jobName) {
            const jn = this.getInternalJobName(userId, props.jobName);
            const r: V1Job = (await this.k8sApi.readNamespacedJob(jn, this.getNamespace())).body;
                if (this.userOwnsJob(userId, r)) {
                    const jd: JobDetails = { name: r.metadata?.name ?? "<Unknown>",
                        uid: r.metadata?.uid,
                        status: await this.getStatusJob(r.metadata?.name ?? "", r.status, userId),
                        dateLaunched: r.metadata?.creationTimestamp?.getTime() ?? null,
                        position: 0,//jobsQueue?.data?.["jobs"]?.find(j => j.name === jn && j.user === this.getUsername())?.
                        flavor: r.metadata?.annotations?.["chaimeleon.eu/jobResourcesFlavor"] ?? "-"
                    }
                    return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, jd);

                } else {
                    return  new KubeOpReturn(KubeOpReturnStatus.Error, `Job '${props.jobName}' not found.`, null);
                }
        } else {
            return new KubeOpReturn(KubeOpReturnStatus.Error, "Job name required", null);
        }
    }

    public async log(props: LogProps, userId: string): 
            Promise<KubeOpReturn<JobLog | null>>{
        try {
            if (props.jobName) {
                const jn = this.getInternalJobName(userId, props.jobName);
                const j: V1Job = (await this.k8sApi.readNamespacedJob(jn, this.getNamespace())).body;
                if (this.userOwnsJob(userId, j)) {
                    const podName: string | undefined =  (await this.getJobPodInfo(jn, userId))?.metadata?.name;

                    //console.dir((await this.k8sApi.readNamespacedJobStatus(jn, this.getNamespace())).body.status);
                    if (podName) {
                        const ns: string = this.getNamespace();
                        console.log(`Getting log for pod '${podName}', user '${userId}' in namespace '${ns}'`);
                        //console.dir((await this.k8sCoreApi.readNamespacedPodStatus(podName, this.getNamespace())).body.status?.conditions);
                        const log: string = (await this.k8sCoreApi.readNamespacedPodLog(podName, ns)).body;
                        return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, !log ? 
                            { stdOut: "" } : { stdOut: log });
                    } else {
                        return new KubeOpReturn(KubeOpReturnStatus.Error, `Unable to determine the pod name for job '${props.jobName}'.`, null);
                    }
                } else {
                    return new KubeOpReturn(KubeOpReturnStatus.Error, `Job '${props.jobName}' not found.`, null);

                }
            } else {
                return new KubeOpReturn(KubeOpReturnStatus.Error, "Job name required", null);
            }
        } catch (e) {
            if (e instanceof HttpError && e.statusCode === 404) {
                return new KubeOpReturn(KubeOpReturnStatus.Error, `Job '${props.jobName}' not found.`, null);
            } else {
                return this.handleKubeOpsError(e);
            }
        }
    }

    public async delete(props: DeleteProps, userId: string): Promise<KubeOpReturn<null>> {
        try {

            if (props.jobName) {
                const jn = this.getInternalJobName(userId, props.jobName);
                const r: DeleteJobHandlerResult = await this.deleteJobHandler(jn, userId);
                return new KubeOpReturn(r.status,  r.message, null);
            } else if (props.all) {
                const  r: KubeOpReturn<V1Job[]> = await this.getJobsList(this.getNamespace(), userId);
                if (r.payload && r.payload.length > 0) {
                    const idsStatus: Map<KubeOpReturnStatus, string[]> = new Map<KubeOpReturnStatus, string[]>()
                    for (const j of r.payload) {
                        if (j.metadata?.name) {
                            const r = await this.deleteJobHandler(j.metadata?.name, userId);
                            let ids: string[] | undefined = idsStatus.get(r.status);
                            if (!ids) {
                                ids = [];
                            }
                            ids.push(j.metadata?.name);
                            idsStatus.set(r.status, ids);
                        }
                    }
                    const msgs: string[] = [];
                    if (idsStatus.has(KubeOpReturnStatus.Success)) {
                        msgs.push(`Deletion intents have been successfully submitted for the following jobs: ${idsStatus.get(KubeOpReturnStatus.Success)?.map(e => "'" + e + "'").join(", ")}. It may take a while until the job(s) is/are actually deleted by Kubernetes."`);
                    } 

                    if (idsStatus.has(KubeOpReturnStatus.Error)) {
                        msgs.push(`Jobs ${idsStatus.get(KubeOpReturnStatus.Error)?.map(e => "'" + e + "'").join(", ")} have not been deleted due to errors`);
                    } 

                    if (idsStatus.has(KubeOpReturnStatus.Unknown)) {
                        msgs.push(`The status for jobs ${idsStatus.get(KubeOpReturnStatus.Unknown)?.map(e => "'" + e + "'").join(", ")} have not been deleted due to errors`);
                    } 
                    return new KubeOpReturn(r.status, msgs.join("; "), null);
                } else {
                    return new KubeOpReturn(KubeOpReturnStatus.Success, "No jobs found", null);
                }
            } else {
                return new KubeOpReturn(KubeOpReturnStatus.Error, "Job name required", null);
            }
        } catch (e) {
            if (e instanceof HttpError && e.statusCode === 404) {
                return new KubeOpReturn(KubeOpReturnStatus.Error, `Job '${props.jobName}' not found.`, null);
            } else {
                return this.handleKubeOpsError(e);
            }
        }
    }

    public resourcesFlavors(userId: string): KubeOpReturn<Page<KubeResourcesFlavor> | null> {
        if (this.settings.job.resources.predefined && this.settings.job.resources.predefined.length > 0) {
            return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, 
                { data: this.settings.job.resources.predefined,
                    size: this.settings.job.resources.predefined.length,
                    total: this.settings.job.resources.predefined.length,
                    skip: 0
                 });
        } else {
            return new KubeOpReturn(KubeOpReturnStatus.Warning, "No predefined flavors found in the application's settings files.", null);
        }

    }

    protected async getHarborImages(hp: HarborProject): Promise<KubeOpReturn<ImageDetails[]>> {
        const projsUrl = `${hp.baseUrl}/api/v2.0/projects`
        const reposUrl = `${projsUrl}/${hp.name}/repositories`;
        console.log(`Getting repos from ${reposUrl}`);
        const agent = new https.Agent({
            rejectUnauthorized: false,
          });
        
        let pageNum = 1;
        let reposCnt = 0;
        const pageSize = 100;
        const result: ImageDetails[] = [];
        let error = false;
        do {
            const response: Response = await this.fetchCustom(`${reposUrl}?page=${pageNum}&page_size=${pageSize}`, 
                {
                    agent,
                    ...hp.token && {headers: [["authorization", `Basic ${hp.token}`]]}
                });
            if (response.ok) {
                const prjRepos: HarborRepository[] = await response.json() as HarborRepository[];
                reposCnt = prjRepos.length;
                for (const repo of prjRepos) {
                    // Get repo name, remove project name 
                    const name: string = repo.name.substring(repo.name.indexOf("/") + 1, repo.name.length);
                    const desc: string = repo.description;
                    const tags: string[] = [];
                    result.push({name, tags, desc})
                    
                    const artsUrl = `${reposUrl}/${name}/artifacts`;
                    const rArtifacts: Response = await this.fetchCustom(`${artsUrl}?page_size=${repo.artifact_count}`, 
                        {
                            agent,
                            ...hp.token && {headers: [["Autorization", `Bearer ${hp.token}`]]}
                        });
                    if (rArtifacts.ok) {
                        const arts: HarborRespositoryArtifact[] = await rArtifacts.json() as HarborRespositoryArtifact[];
                        for (const art of arts ) {
                            if (art.tags !== null)
                                tags.push(...art.tags.map(t => t.name));
                        }
                    } else {
                        console.warn(`Unable to load artifacts from ${artsUrl}`);
                    }
                } 
                ++pageNum;      
            } else {
                error = true;
                console.error(`Unable to load repositories from '${reposUrl}?page=${pageNum}&page_size=${pageSize}', API responded with code '${response.statusText}' and message: ${JSON.stringify(await response.json())}`);
                // If the first page fails, don't try again
                break;
            }
        } while (reposCnt === pageSize);
        if (error)
            return new KubeOpReturn(KubeOpReturnStatus.Error, `Unable to load repositories from '${reposUrl}`, result);
        else
            return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, result);

    }

    protected getAnnotations(kr: KubeResourcesFlavor, props: SubmitProps, userId: string): { [key: string]: string; } | null {

        const r = Object.create(null);
        if (this.settings.job.resources.label) {
            r[this.settings.job.resources.label] = kr.name;
        }
        r[this.settings.job.userIdAnnotation] = userId;
        Object.assign(r, Util.getAnnotationsFromSettings(this.settings.job.annotations));
        if (props.annotations) {
                Object.assign(r, JSON.parse(props.annotations));   
        }
        r[this.settings.job.annotationDatasetsList] = props.datasetsList;
        return Object.keys(r).length > 0 ? r : null;
    } 

    protected async deleteJobHandler(jobName: string, userId: string): Promise<DeleteJobHandlerResult> {
        let message = "Undefined";
        let status: KubeOpReturnStatus = KubeOpReturnStatus.Unknown;
        const j: V1Job = (await this.k8sApi.readNamespacedJob(jobName, this.getNamespace())).body;
        if (this.userOwnsJob(userId, j)) {
            log.info(`Deleting job named '${jobName}' for user '${userId}' in namespace '${this.getNamespace()}'`);
            const deleteObj: V1DeleteOptions = {
                apiVersion: 'v1',
                propagationPolicy: 'Background'
                }
            const r = await this.k8sApi.deleteNamespacedJob(jobName, this.getNamespace(), 
                undefined, undefined, undefined, undefined, undefined, deleteObj);
            status = this.getStatusKubeOp(r.response.statusCode);
            if (status !==  KubeOpReturnStatus.Success) {
                message = `Unable to delete job '${jobName}' with error code ${r.response.statusCode ?? "'unknown'"} and message: ${r.response.statusMessage ?? "'unknown'"}`
            } else {    
                message = `Job '${jobName}' has been successfully deleted.`;
            }
        } else {
            throw new KubeException(`Job '${jobName}' not found.`);
        }
        return {message, status};
        
    }

    protected async getConfigmap(configMapName: string, namespace?: string): Promise<V1ConfigMap> {
            return (await this.k8sCoreApi.readNamespacedConfigMap(configMapName, namespace ?? this.getNamespace())).body;
    }
    
    protected async getJobPodInfo(jobName: string, userId: string): Promise<V1Pod | undefined> {
        const r: V1Job = (await this.k8sApi.readNamespacedJob(jobName, this.getNamespace())).body;
        if (this.userOwnsJob(userId,r)) {
            const cUid: string | undefined = r?.metadata?.labels?.["controller-uid"];
            if (cUid) {
                const podLblSel: string = "controller-uid=" + cUid;
                const pods: V1PodList = (await this.k8sCoreApi.listNamespacedPod(this.getNamespace(), 
                    undefined, undefined, undefined, undefined, podLblSel)).body;
                return pods.items[0];
            } else {
                throw new KubeException(`Unable to determine controller UID for job '${jobName}'.`);
            }
        } else {
            throw new KubeException(`Job '${jobName}' not found.`);
        }
    }

    protected getStatusKubeOp(kubeStat: number| undefined): KubeOpReturnStatus {
        if (kubeStat) {
            if (kubeStat >= 200 && kubeStat <= 299) {
                return KubeOpReturnStatus.Success;
            } else {
                return KubeOpReturnStatus.Error;
            }
        } else {
            return KubeOpReturnStatus.Unknown;
        }
    }

    protected async getJobsList(namespace: string, userId: string): Promise<KubeOpReturn<V1Job[]>> {
        const res =  (await this.k8sApi.listNamespacedJob(namespace))//, undefined, undefined, undefined, 

        //     `metadata.annotations.${this.settings.job.userIdAnnotation}=${userId}`
        // );
        const r: V1Job[] = res.body.items.filter((j:V1Job) => this.userOwnsJob(userId, j));
        return new KubeOpReturn(this.getStatusKubeOp(res.response.statusCode), res.response.statusMessage, r);
    }

    protected async getStatusJob(jobName: string, stat: V1JobStatus | undefined, userId: string): Promise<EJobStatus>  {
        if (stat) {
            if (stat.failed === undefined && stat.succeeded === undefined) {
                // we have to check what the pod is doing
                const podPhase: string | undefined =  (await this.getJobPodInfo(jobName, userId))?.status?.phase?.toLowerCase();
                switch (podPhase) {
                    case "pending": return EJobStatus.Pending;
                    case "running": return EJobStatus.Running;
                    case "succeeded": return EJobStatus.Succeeded;
                    case "failed": return EJobStatus.Failed;
                    case undefined: // Same as unknown
                    case "unknown": return EJobStatus.Unknown;
                    default: throw new UnhandledValueException(`Unhandled pod status '${podPhase}.`);
                }
            } else if (!stat.active && stat.succeeded && stat.succeeded >= 1) {
                return EJobStatus.Succeeded;
            } else if (!stat.active && stat.failed && stat.failed >= 1) {
                return EJobStatus.Failed;
            }  else if (stat.active) {
                return EJobStatus.Pending;
            } else {
                return EJobStatus.Unknown;
            }
        } else {
            return EJobStatus.Unknown;
        }
    }

    protected loadKubeConfig(cfg: KubeConfigLocal): KubeConfig {
        const clusterConfigTmp = new KubeConfig();
        if (cfg.type === KubeConfigType.default) {
            clusterConfigTmp.loadFromDefault();
        } else if (cfg.type === KubeConfigType.cluster) {
            clusterConfigTmp.loadFromCluster();
        } else if (cfg.type === KubeConfigType.file) {
            if (cfg.file && fs.existsSync(cfg.file)) {
                clusterConfigTmp.loadFromFile(cfg.file);
            } else {
                throw new ParameterException(`Please set kubernetes config file path in the settings`)
            }
        } else {
            throw new UnhandledValueException(`Type '${cfg.type}' not handled. Please use one of the following: 
                ${Object.keys(KubeConfigType).filter(value => typeof value === 'string').join(", ")}`)
        }
        return clusterConfigTmp;
    }

    // public getUsername() : string {
    //     const uname: string | undefined = this.clusterConfig.getCurrentUser()?.name;
    //     if (!uname) 
    //         throw new Error("Unable to determine user name from the current context");
    //     else 
    //         return uname;

    // }

    protected handleKubeOpsError(e: any): KubeOpReturn<null> {
        if (e instanceof HttpError) {
            return new KubeOpReturn(KubeOpReturnStatus.Error, `Error message from Kubernetes: ${e.body.message}`, null);
        } else if (e instanceof Error || e instanceof KubeException || e instanceof ParameterException) {
            return new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null);
        } else {
            return new KubeOpReturn(KubeOpReturnStatus.Error, `Unknown error: ${JSON.stringify(e)}`, null);
        }

    }

    protected getNamespace(): string {
        return this.settings.job.protectedNamespace;
        // const nm: string | undefined = this.clusterConfig.getContexts().filter(c => c.name === this.clusterConfig.getCurrentContext())?.[0]?.namespace;
        // if (!nm)
        //     throw new KubeException("Unable to determine namespace");
        // else   
        //     return nm;
    }

    protected fetchCustom(url: string, init?: RequestInit): Promise<Response> {
        return fetch(url, init);
    }

    protected userOwnsJob(userId: string, job: V1Job): boolean {
        return job.metadata?.annotations?.[this.settings.job.userIdAnnotation] === userId;
    }

    protected getInternalJobName(userId: string, jobName?: string | null | undefined):  string {
        return userId + "--" + (jobName ?? uuidv4());
    }

    protected getJobName(userId: string, internalJobName: string): string {
        return internalJobName.substring(userId.length + 2);
    }

    // protected updateQueueResultJobStats(qrStats: QueueResultJobStats, kubeStats: V1JobStatus) {
    //     qrStats.total += 1;
    //     let finished = 0;
    //     if (kubeStats.succeeded !== undefined && kubeStats.succeeded > 0) {
    //         qrStats.succeeeded += 1;
    //         ++finished
    //     }
    //     if (kubeStats.failed !== undefined && kubeStats.failed > 0) {
    //         qrStats.succeeeded += 1;
    //         ++finished;
    //     }
    // }
    
}