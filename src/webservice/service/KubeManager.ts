import { KubeConfig, CustomObjectsApi, BatchV1Api, V1Job, V1JobStatus, Watch, 
        CoreV1Api, V1PodList, V1Pod, V1ConfigMap, 
        //V1Volume, V1VolumeMount, 
        V1PodSecurityContext, V1ResourceRequirements, 
        V1EnvVar,
        V1Container,
        V1VolumeMount,
        V1Status,
        CoreV1EventList} from '@kubernetes/client-node';
import { v4 as uuidv4}  from "uuid";
import log from "loglevel";
import fs from "node:fs";
//import path from "node:path";
import JobInfo from '../../common/model/JobInfo.js';
import ParameterException from '../../common/model/exception/ParameterException.js';
import type SubmitProps from '../../common/model/args/SubmitProps.js';
//import NotImplementedException from '../model/exception/NotImplementedException.js';
import { KubeOpReturn, KubeOpReturnStatus } from '../../common/model/KubeOpReturn.js';
import UnhandledValueException from '../../common/model/exception/UnhandledValueException.js';
import KubeException from '../model/exception/KubeException.js';
import type DetailsProps from '../../common/model/args/DetailsProps.js';
import type LogProps from '../../common/model/args/LogProps.js';
import type DeleteProps from '../../common/model/args/DeleteProps.js';
import KubeResourcesPrep from './KubeResourcesPrep.js';
import QueueResult from '../../common/model/QueueResult.js';
import type QueueConfigMap from '../model/QueueConfigMap.js';
import QueueResultDisplay from '../../common/model/QueueResultDisplay.js';
import type DeleteJobHandlerResult from '../model/DeleteJobHandlerResult.js';
import LoggerService from './LoggerService.js';
import { KubeConfigType } from "../model/SettingsWebService.js";
import type { KubeConfigLocal, SecurityContext, SettingsWebService } from "../model/SettingsWebService.js";
import type KubeResourcesFlavor from "../../common/model/KubeResourcesFlavor.js";
import EJobStatus from '../../common/model/EJobStatus.js';
import Util from '../../common/Util.js';
import type JobDetails from '../../common/model/JobDetails.js';
import type Page from '../../common/model/Page.js';
import type JobLog from '../../common/model/JobLog.js';
import type JobSubmiSuccess from '../../common/model/JobSubmitSuccess.js';
import type JobErrors from '../model/JobErrors.js';
import type { ClusterWarning, ContainerError } from '../model/JobErrors.js';
import type HarborManager from './HarborManager.js';
import type ResourceConsumptionProps from '../../common/model/args/ResourceConsumptionProps.js';
import type { JobDetailsEnv, JobDetailsResourcesUsage } from '../../common/model/JobDetails.js';
import type ImageInfo from '../model/ImageInfo.js';


export default class KubeManager {

    public static CONTAINER_MAIN_NAME = "container-main";
    public static CONTAINER_K8S_LOGGER_NAME = "container-k8s-logger";
    public static CONTAINER_SIDECAR_LOGS_NAME = "container-sidecar-logs";
    public static SERVICE_ACCOUNT_CREDENTIALS_VOL = "sacredentials";

    public static RESOURCE_USAGE_FINISHED: JobDetailsResourcesUsage = {
                        cpu: "0mi",
                        memory: "0b"

    }

    protected logger: LoggerService;
    protected clusterConfig: KubeConfig;
    protected k8sApi: BatchV1Api;
    protected k8sCoreApi: CoreV1Api;
    protected metricsClient: CustomObjectsApi;
    protected settings: SettingsWebService;
    protected watch: Watch;

    public constructor(settings: SettingsWebService, logger: LoggerService) {
        this.logger = logger;
        this.settings = settings;
        this.clusterConfig = this.loadKubeConfig(settings.kubeConfig);
        this.k8sApi = this.clusterConfig.makeApiClient(BatchV1Api);
        this.k8sCoreApi = this.clusterConfig.makeApiClient(CoreV1Api);
        this.metricsClient = this.clusterConfig.makeApiClient(CustomObjectsApi);
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

    public async submit(hm: HarborManager, props: SubmitProps, userId: string): Promise<KubeOpReturn<null | string | JobSubmiSuccess>> {
        try {
            // if (!props.image) {
            //     return new KubeOpReturn(KubeOpReturnStatus.Error,
            //         "Please specify an image and tag. Use the 'images' command to see the available images and tags for each of them.",
            //         null);
            // } else {            
            const kr: KubeResourcesFlavor = KubeResourcesPrep.getKubeResources(this.settings, props.resources);
            const jn: string = this.getInternalJobName(userId, props.jobName);
            this.logger.info("Job name: " + jn)
            const namespace = this.getNamespace();
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
            // const volumes = [
            //     {
            //     name: KubeManager.SERVICE_ACCOUNT_CREDENTIALS_VOL,
            //     projected: {
            //         sources: [
            //         {
            //             secret: {
            //                 name: this.settings.job.serviceAccountTokenSecret,
            //                 items:[
            //                     {
            //                         key: "token",
            //                         path: "token"
            //                     }
            //                 ]
            //             }
            //         },
            //         {
            //             downwardAPI: {
            //                 items:[
            //                     {
            //                         path: "namespace",
            //                         fieldRef: {
            //                             fieldPath: "metadata.namespace"
            //                         }
            //                     }
            //                 ]
            //             }
            //         },
            //         {
            //             configMap: {
            //                 name: this.settings.job.kubeRootCASecret,
            //                 items: [
            //                     {
            //                         key: "ca.crt",
            //                         path: "ca.crt"
            //                     }
            //                 ]
            //             }
                        
            //         }
            //     ]
            //     }
            //     }
            // ]
            const image: ImageInfo = await hm.getImageInfo(props.image);
            const imagePullSecrets = image.imagePullSecrets;

            this.logger.info(`Using image '${image.fullUrl}'`);
            job.spec = {
                backoffLimit: 0,
                template: {
                    metadata: {
                        name: jn
                    },
                    spec: {
                        //serviceAccount: this.settings.job.serviceAccount,
                        automountServiceAccountToken: false,
                        ...securityContext && {securityContext: {...new V1PodSecurityContext(), ...securityContext} },
                        ...priorityClassName && {priorityClassName},
                        //...volumes && {volumes},
                        containers: await this.getSubmitContainers(image, props, kr, hm),
                        ...imagePullSecrets && {imagePullSecrets},
                        restartPolicy: "Never"
                    }
                }

            }

            if (props.dryRun) {
                return new KubeOpReturn(KubeOpReturnStatus.Success, "\n" + JSON.stringify(job, null, 2), "\n" + JSON.stringify(job, null, 2));

            } else {
                await this.k8sApi.createNamespacedJob({ namespace, body: job });
                return new KubeOpReturn(KubeOpReturnStatus.Success, 
                    `Job named '${jn}' created successfully by user '${userId}'`, {
                        jobName: this.getJobName(userId, jn)
                    });

            }
            //}
        
        } catch (e: any) {
            return this.handleKubeOpsError(e);
        }
    }

    public async list(userId: string): Promise<KubeOpReturn<Page<JobInfo> | null>> {
        try {
            const r: V1Job[] = (await this.getJobsList(this.getNamespace(), userId));
            // const jobsQueue: V1ConfigMap = await this.getConfigmap(
            //     this.settings.jobsQueue.configmap, this.settings.jobsQueue.namespace);
            if (r) {
                const res: JobInfo[] = [];
                for (const e of r) {
                    const jn = e.metadata?.name;
                    if (jn) {
                        res.push({ name: this.getJobName(userId, jn),
                            uid: e.metadata?.uid,
                            status: await this.getStatusJob(jn, e.status, userId),
                            createdAt: e.metadata?.creationTimestamp?.getTime() ? new Date(e.metadata?.creationTimestamp?.getTime()).toISOString() : null,
                            position: 0,//jobsQueue?.data?.["jobs"]?.find(j => j.name === jn && j.user === this.getUsername())?.
                            flavor: e.metadata?.annotations?.["chaimeleon.eu/jobResourcesFlavor"] ?? "-"
                        });
                    }
                }
                res.sort(function(a,b){return (b.createdAt ? new Date(b.createdAt).getTime() : 0) 
                        - (a.createdAt ? new Date(a.createdAt).getTime() : 0)});
                return new KubeOpReturn(KubeOpReturnStatus.Success, "", { data: res, size: res.length, total: res.length, skip: 0 });
            } else {
                return new KubeOpReturn(KubeOpReturnStatus.Success, "Empty jobs list", { data: [], size: 0, total: 0, skip: 0 });
            }
        } catch (e) {
            return this.handleKubeOpsError(e);
        }
    }

    public async details(props: DetailsProps, userId: string): Promise<KubeOpReturn<JobDetails | null>> {
        try {
            if (props.jobName) {
                const jn = this.getInternalJobName(userId, props.jobName);
                const namespace = this.getNamespace();
                const r: V1Job = await this.k8sApi.readNamespacedJob({ name: jn, namespace });
                    if (this.userOwnsJob(userId, r)) {
                        const pods = await this.k8sCoreApi.listNamespacedPod({ namespace, labelSelector: `job-name=${jn}` });
                        const pod = pods.items[0]; 
                        if (pod) {
                            let executionDuration: number | null = null;
                            if (pod.status?.containerStatuses?.[0]?.state?.terminated?.startedAt && 
                                pod.status?.containerStatuses?.[0]?.state?.terminated?.finishedAt) {
                                executionDuration = Math.round((pod.status?.containerStatuses?.[0]?.state?.terminated?.finishedAt.getTime() -
                                    pod.status?.containerStatuses?.[0]?.state?.terminated?.startedAt.getTime())/1000);
                            }
                            const errors: string[] = [];
                            const jobErrors: JobErrors = await this.getJobErrors(userId, props.jobName);
                            if (jobErrors.containerError) {
                                const msg = jobErrors.containerError.message ? ` Message: '${jobErrors.containerError.message}'.` : "";
                                const reason = jobErrors.containerError.reason ? ` Reason: '${jobErrors.containerError.reason}'.` : "";
                                errors.push(`Container error with exit code '${jobErrors.containerError.exitCode}'.${reason}${msg}`);
                            }
                            errors.push(...jobErrors.clusterWarnings.map(cw => {
                                const msg = cw.message ? ` Message: '${cw.message}'.` : "";
                                const reason = cw.reason ? ` Reason: '${cw.reason}'.` : "";
                                return `Cluster error.${reason}${msg}`;
                            }));
                            const env: JobDetailsEnv[] | undefined = pod.spec?.containers[0]?.env
                                                ?.filter((e: V1EnvVar) => e.valueFrom === undefined)
                                                ?.map((e: V1EnvVar) => { return {
                                                    name: e.name,
                                                    value: e.value !== undefined ? e.value : null
                                                }});
                            const finishedAt = pod.status?.containerStatuses?.[0]?.state?.terminated?.finishedAt?.toISOString() ?? null;
                            let usage: JobDetailsResourcesUsage | null = null;
                            if (finishedAt) {
                                usage = KubeManager.RESOURCE_USAGE_FINISHED;
                            } else {
                                usage = pod.metadata?.name ? await this.getResourcesUsage(jn, pod.metadata?.name) : null;
                            }
                            const jd: JobDetails = { name: props.jobName,//r.metadata?.name ?? "<Unknown>",
                                uid: r.metadata?.uid ?? null,
                                status: await this.getStatusJob(r.metadata?.name ?? "", r.status, userId),
                                createdAt: r.metadata?.creationTimestamp?.toISOString() ?? null,
                                position: 0,//jobsQueue?.data?.["jobs"]?.find(j => j.name === jn && j.user === this.getUsername())?.
                                flavor: r.metadata?.annotations?.["chaimeleon.eu/jobResourcesFlavor"] ?? "-",
                                exitCode: pod.status?.containerStatuses?.[0]?.state?.terminated?.exitCode ?? null,
                                startedAt: pod.status?.containerStatuses?.[0]?.state?.running?.startedAt?.toISOString() 
                                    ?? pod.status?.containerStatuses?.[0]?.state?.terminated?.startedAt?.toISOString() ?? null,
                                finishedAt,
                                executionDuration,
                                errors,
                                user: r.metadata?.annotations?.[this.settings.job.userNameAnnotation] ?? null,
                                image: pod.spec?.containers[0]?.image ?? null,
                                privileged: pod.spec?.containers[0]?.securityContext?.privileged !== undefined 
                                                ? pod.spec?.containers[0]?.securityContext?.privileged : null,
                                mounts: pod.spec?.containers[0]?.volumeMounts
                                            ?.map((v: V1VolumeMount) => { return {
                                                    source: v.name,
                                                    mountPath: v.mountPath,
                                                    readOnly: v.readOnly !== undefined ? v.readOnly : null
                                                };}) ?? [],
                                env: env !== undefined ? env : null,
                                command: pod.spec?.containers[0]?.command !== undefined ? pod.spec?.containers[0]?.command : null,
                                args: pod.spec?.containers[0]?.args !== undefined ? pod.spec?.containers[0]?.args : null,
                                host: {
                                    serverName: this.settings.defaultKubeURL ? this.settings.defaultKubeURL : (this.clusterConfig.getCurrentCluster()?.server ?? null),
                                    uid: pod.spec?.containers[0]?.securityContext?.runAsUser === undefined ? 
                                        (pod.spec?.securityContext?.runAsUser === undefined ? null 
                                            : pod.spec?.securityContext?.runAsUser) 
                                        : pod.spec?.containers[0]?.securityContext?.runAsUser,
                                    gid:  pod.spec?.containers[0]?.securityContext?.runAsGroup === undefined ? 
                                        (pod.spec?.securityContext?.runAsGroup === undefined ? null 
                                            : pod.spec?.securityContext?.runAsGroup) 
                                        : pod.spec?.containers[0]?.securityContext?.runAsGroup,
                                    user: null
                                },
                                resources: {
                                    usage
                                }
                            }
                            return new KubeOpReturn(KubeOpReturnStatus.Success, undefined, jd);
                        } else {
                            return new KubeOpReturn(KubeOpReturnStatus.Error, `Can't get the pods list for job '${props.jobName}'`, null);
                        }

                    } else {
                        return  new KubeOpReturn(KubeOpReturnStatus.Error, `Job '${props.jobName}' not found.`, null);
                    }
            } else {
                return new KubeOpReturn(KubeOpReturnStatus.Error, "Job name required", null);
            }
        } catch (e) {
            return this.handleKubeOpsError(e);
        }
    }

    public async log(props: LogProps, userId: string): 
            Promise<KubeOpReturn<JobLog | null>>{
        try {
            if (props.jobName) {
                const namespace: string = this.getNamespace();
                const jn = this.getInternalJobName(userId, props.jobName);
                const j: V1Job = await this.k8sApi.readNamespacedJob({ name: jn, namespace });
                if (this.userOwnsJob(userId, j)) {
                    const podName: string | undefined =  (await this.getJobPodInfo(jn, userId))?.metadata?.name;

                    //this.logger.info(JSON.strigify((await this.k8sApi.readNamespacedJobStatus(jn, this.getNamespace())).body.status));
                    if (podName) {
                        // this.logger.info(`Getting log for pod '${podName}', user '${userId}' in namespace '${namespace}'`);
                        const log: string = (await this.k8sCoreApi.readNamespacedPodLog({ name: podName, namespace }));
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
            // if (e instanceof HttpError && e.statusCode === 404) {
            //     return new KubeOpReturn(KubeOpReturnStatus.Error, `Job '${props.jobName}' not found.`, null);
            // } else {
                return this.handleKubeOpsError(e);
            // }
        }
    }

    public async delete(props: DeleteProps, userId: string): Promise<KubeOpReturn<null>> {
        try {

            if (props.jobName) {
                const jn = this.getInternalJobName(userId, props.jobName);
                const r: DeleteJobHandlerResult = await this.deleteJobHandler(jn, userId);
                return new KubeOpReturn(r.status,  r.message, null);
            } else if (props.all) {
                const  r: V1Job[] = await this.getJobsList(this.getNamespace(), userId);
                if (r && r.length > 0) {
                    const idsStatus: Map<KubeOpReturnStatus, string[]> = new Map<KubeOpReturnStatus, string[]>()
                    for (const j of r) {
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
                    return new KubeOpReturn(KubeOpReturnStatus.Success, msgs.join("; "), null);
                } else {
                    return new KubeOpReturn(KubeOpReturnStatus.Success, "No jobs found", null);
                }
            } else {
                return new KubeOpReturn(KubeOpReturnStatus.Error, "Job name required", null);
            }
        } catch (e) {
            // if (e instanceof HttpError && (e as HttpError).statusCode === 404) {
            //     return new KubeOpReturn(KubeOpReturnStatus.Error, `Job '${props.jobName}' not found.`, null);
            // } else {
            return this.handleKubeOpsError(e);
            //}
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

    public async resourceConsumption(props: ResourceConsumptionProps, userId: string, ) {

    }

    protected async getResourcesUsage(internalJobName: string, pod: string): Promise<JobDetailsResourcesUsage | null> {
        try {
            const res = await this.metricsClient.getNamespacedCustomObject({
                namespace: this.getNamespace(),
                group: 'metrics.k8s.io',
                version: 'v1beta1',
                plural: 'pods',
                name: pod
            });
            const cn = KubeManager.CONTAINER_MAIN_NAME;
            const podMetrics = res.body as any;
            for (const container of podMetrics.containers) {
                if (container.name === cn) {
                    return {
                        cpu: container.usage.cpu,
                        memory: container.usage.memory
                    }
                }
            }
            this.logger.error(`Container named '${cn}' not found in pod '${pod}'`);
        } catch(e: any) {
            // if (e instanceof HttpError && e.body.code === 404) {
            //     const pods = await this.k8sCoreApi.listNamespacedPod({ namespace: this.getNamespace(), labelSelector: `job-name=${internalJobName}` });
            //     const pod = pods.items[0]; 
            //     if (pod?.status?.containerStatuses?.[0]?.state?.terminated?.finishedAt) {
            //         return KubeManager.RESOURCE_USAGE_FINISHED;
            //     } else {
            //         this.logger.error(e.body.message);
            //     }
            // } else {
            //     const k = this.handleKubeOpsError(e);
            //     this.logger.error(k.message)
            // }
            this.logger.error(e);
        }
        return null;
    }

    protected async getSubmitContainers(image:ImageInfo, props: SubmitProps, kr: KubeResourcesFlavor, 
            hm: HarborManager): Promise<V1Container[]> {
        const env: Array<V1EnvVar> | undefined = props.env?.map(e => Object.assign(new V1EnvVar(),  e));

        // let imgEntryPoint = null;
        // let imgCmd = null;
        const args: string[] | undefined = props.commandArgs ? (props.commandArgs.length === 0 ? undefined : props.commandArgs) : props.commandArgs;
        //const command: string[] | undefined = [];//props.command ? cmdArgs : undefined;
        const containers: V1Container[] = [
            {
                name: KubeManager.CONTAINER_MAIN_NAME,
                image: image.fullUrl,
                ...env && { env },
                //...command && {command},
                ...args && {args},
                //...volumeMounts && {volumeMounts},
                resources: {...new V1ResourceRequirements(), ...kr.resources}
            }
        ]
        if (props.logFile) {
            containers.push({
                name: KubeManager.CONTAINER_K8S_LOGGER_NAME,
                image: this.settings.job.k8sLogger.image,
                args: [
                    "-c", KubeManager.CONTAINER_MAIN_NAME,
                    "-l", props.logFile,
                    "-s", String(this.settings.job.k8sLogger.sleep)
                ],
                env: [
                    {
                        name: "POD_NAME",
                        valueFrom: {
                            fieldRef: {
                                fieldPath: "metadata.name"
                            }                  
                        }                
                    },
                    {
                        name: "POD_NAMESPACE",
                        valueFrom: {
                            fieldRef: {
                                fieldPath: "metadata.namespace"
                            }                  
                        }                

                    }
                ],
                volumeMounts: [
                    {
                        name: KubeManager.SERVICE_ACCOUNT_CREDENTIALS_VOL,
                        mountPath: "/var/run/secrets/kubernetes.io/serviceaccount",
                        readOnly: true
                    }
                ]
            })
        }
        return containers;
    }


    protected async getJobErrors(userId: string, jobName: string): Promise<JobErrors> {
        const internalJobName = this.getInternalJobName(userId, jobName);
        const podsRes = await this.k8sCoreApi.listNamespacedPod({ namespace: this.getNamespace(), labelSelector: `job-name=${internalJobName}` });
        const pod = podsRes.items?.[0];
        if (!pod) throw new Error(`No Pod found for Job: ${jobName}`);

        const podName = pod.metadata?.name;
        const containerStatus = pod.status?.containerStatuses?.[0];
        const termination = containerStatus?.state?.terminated;

        let containerError: ContainerError | null = null;

        if (termination?.exitCode !== undefined && termination?.exitCode !== 0) {
            containerError = {
                exitCode: termination?.exitCode,
                reason: termination?.reason,
                message: termination?.message
            };
        }
        

        // Cluster-level warning events
        const eventsRes: CoreV1EventList = await this.k8sCoreApi.listNamespacedEvent({ namespace: this.getNamespace(), 
            fieldSelector: `involvedObject.name=${podName}` });
        const clusterWarnings: ClusterWarning[] = eventsRes.items
            .filter(ev => ev.type === 'Warning')
            .map(ev => ({
            reason: ev.reason,
            message: ev.message,
            lastTimestamp: ev.lastTimestamp
            }));

        return {
            containerError,
            clusterWarnings
        };
    }

    protected getAnnotations(kr: KubeResourcesFlavor, props: SubmitProps, userId: string): { [key: string]: string; } | null {

        const r = Object.create(null);
        if (this.settings.job.resources.label) {
            r[this.settings.job.resources.label] = kr.name;
        }
        r[this.settings.job.userNameAnnotation] = userId;
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
        const j: V1Job = (await this.k8sApi.readNamespacedJob({ name: jobName, namespace: this.getNamespace() }));
        if (this.userOwnsJob(userId, j)) {
            log.info(`Deleting job named '${jobName}' for user '${userId}' in namespace '${this.getNamespace()}'`);
            // const deleteObj: V1DeleteOptions = {
            //     apiVersion: 'v1',
            //     propagationPolicy: 
            //     }
            const r: V1Status = await this.k8sApi.deleteNamespacedJob({ name: jobName, namespace: this.getNamespace(), propagationPolicy: 'Background' });
            status = this.getStatusKubeOp(r.code);
            if (status !==  KubeOpReturnStatus.Success) {
                message = `Unable to delete job '${jobName}' with error code ${r.code ?? "'unknown'"} and details: ${r.details ?? "'unknown'"}`
                this.logger.error(message);
            } else {    
                message = `Job '${jobName}' has been successfully deleted.`;
                this.logger.info(message);
            }
        } else {
            throw new KubeException(`Job '${jobName}' not found.`);
        }
        return {message, status};
        
    }

    protected async getConfigmap(configMapName: string, namespace?: string): Promise<V1ConfigMap> {
            return (await this.k8sCoreApi.readNamespacedConfigMap({ name: configMapName, namespace: namespace ?? this.getNamespace() }));
    }
    
    protected async getJobPodInfo(jobName: string, userId: string): Promise<V1Pod | undefined> {
        const r: V1Job = (await this.k8sApi.readNamespacedJob({ name: jobName, namespace: this.getNamespace() }));
        if (this.userOwnsJob(userId,r)) {
            const cUid: string | undefined = r?.metadata?.labels?.["controller-uid"];
            if (cUid) {
                const podLblSel: string = "controller-uid=" + cUid;
                const pods: V1PodList = (await this.k8sCoreApi.listNamespacedPod({
                    namespace: this.getNamespace(),
                    labelSelector: podLblSel
                }));
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

    protected async getJobsList(namespace: string, userId: string): Promise<V1Job[]> {
        const res =  (await this.k8sApi.listNamespacedJob({namespace}))//, undefined, undefined, undefined, 

        //     `metadata.annotations.${this.settings.job.userIdAnnotation}=${userId}`
        // );
        const r: V1Job[] = res.items.filter((j:V1Job) => this.userOwnsJob(userId, j));
        return r;
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

        this.logger.error(e);
        // if (e instanceof HttpError) {
        //     return new KubeOpReturn(KubeOpReturnStatus.Error, `Error message from Kubernetes: ${e.body.message}`, null);
        // } else 
        if (e.body && typeof e.body === "string") {
            try {
                const b = JSON.parse(e.body);
                if (b.message) {
                    return new KubeOpReturn(KubeOpReturnStatus.Error, b.message, null);
                }
            } catch (parseErr: any) {
                this.logger.error(parseErr);
            } 
        } else if ("message" in e) {
            return new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null);
        }
        return new KubeOpReturn(KubeOpReturnStatus.Error, `Unknown error: ${JSON.stringify(e)}`, null);

    }

    protected getNamespace(): string {
        return this.settings.job.protectedNamespace;
        // const nm: string | undefined = this.clusterConfig.getContexts().filter(c => c.name === this.clusterConfig.getCurrentContext())?.[0]?.namespace;
        // if (!nm)
        //     throw new KubeException("Unable to determine namespace");
        // else   
        //     return nm;
    }


    protected userOwnsJob(userId: string, job: V1Job): boolean {
        return job.metadata?.annotations?.[this.settings.job.userNameAnnotation] === userId;
    }

    protected getInternalJobName(userId: string, jobName?: string | null | undefined):  string {
        return userId + (jobName ?? uuidv4());
    }

    protected getJobName(userId: string, internalJobName: string): string {
        return internalJobName.substring(userId.length);
    }

    // protected uuid2B64(uuid: string): string {
    //     const userIdB64Bin:  Uint8Array = uuidParse(uuid);
    //     return  Buffer.from(userIdB64Bin).toString('base64');
    // }

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