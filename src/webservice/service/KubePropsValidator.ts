import { V1EnvVar } from "@kubernetes/client-node";
import type SubmitProps from "../../common/model/args/SubmitProps.js";
import type KubeResourcesFlavor from "../../common/model/KubeResourcesFlavor.js";
import Util from "../../common/Util.js";
import type ImageInfo from "../model/ImageInfo.js";
import type { SettingsWebService } from "../model/SettingsWebService.js";
import type SubmitPropsValidated from "../model/valided-props/SubmitPropsValidated.js";
import type HarborManager from "./HarborManager.js";
import type KubeManagerCommon from "./KubeManagerCommon.js";
import KubeResourcesPrep from "./KubeResourcesPrep.js";
import type LoggerService from "./LoggerService.js";
import type EnvEntry from "../../common/model/EnvEntry.js";
import PropsValidationError from "../error/PropsValidationError.js";

export default class KubePropsValidator {

    protected logger: LoggerService;
    protected settings: SettingsWebService;
    protected commonManager: KubeManagerCommon;

    constructor(settings: SettingsWebService, logger: LoggerService, commonManager: KubeManagerCommon) {
        this.logger = logger;
        this.settings = settings;
        this.commonManager = commonManager;
    }

    public async validateJobSubmit(userId: string, props: SubmitProps, hm: HarborManager): Promise<SubmitPropsValidated> {
        const resources: KubeResourcesFlavor = KubeResourcesPrep.getKubeResources(this.settings, props.resources);
        const annotations = this.getAnnotations(resources, props, userId);
        const internalJobName: string = this.commonManager.getInternalJobName(userId, props.jobName);
        const image: ImageInfo = await hm.getImageInfo(props.image);        
        const workers: number = props.workers ?? 1;
        if (workers > this.settings.job.distributed.maxWorkers || workers < 1) {
            throw new PropsValidationError(`Number of workers must be a natural number between 1 and ${this.settings.job.distributed.maxWorkers}`);
        }
        const env: V1EnvVar[] = this.getEnvVars(workers, props.env, internalJobName, this.commonManager.getNamespace());
        const args: string[] | null = props.commandArgs  
            ? (props.commandArgs.length === 0 ? null : props.commandArgs) 
            : props.commandArgs ?? null;

        this.validateDatasetsList(props.datasetsList);

        return {
            jobName: this.commonManager.getJobName(userId, internalJobName),
            internalJobName,
            image,
            resources,
            annotations,
            workers,
            env,
            args, 
            ports: this.getPorts(props.ports),
            datasetsList: props.datasetsList,
            logFile: props.logFile ?? null
        }
    }

    protected getPorts(ports: string | null |undefined): number[] | null {
        if (ports) {
            const ap = ports.split(",");
            const res = [];
            for(const p of ap) {
                const parsedPort = Number(p);
                if (Number.isNaN(parsedPort)) {
                    throw new PropsValidationError(`Invalid port '${p}'`);
                }

                if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort >= 65535) {
                    throw new PropsValidationError(`Invalid port '${p}': value must be a natural number less or equal to 65535 and higher or equal to 1`);
                }
                res.push(parsedPort);
            }
            return res;
        } else {
            return null;
        }
    }

    protected validateDatasetsList(datasetList: string) {
        const lst = datasetList.split(',');
        if (lst.length === 0) {
            throw new PropsValidationError(`You have to specify at least one dataset ID in the datasetsList prop.`);
        }
        for (const d of lst) {
            if (!Util.isValidUUID(d)) {
                throw new PropsValidationError(`Dataset ID '${d}' is not a valid UUID.`)
            }
        }

    }

    protected getEnvVars(workers: number, env: EnvEntry[] | undefined | null, 
            internalJobName: string, namespace: string): Array<V1EnvVar> {
        const envV: Array<V1EnvVar> = env?.map(e => Object.assign(new V1EnvVar(),  e)) ?? [];
        envV.push({
            name: "WORLD_SIZE",
            value: String(workers)
        })
        envV.push({
            name: "RANK",
            valueFrom: {
                fieldRef: {
                    fieldPath: "metadata.annotations['batch.kubernetes.io/job-completion-index']"
                }
            }
        });
        envV.push({
            name: "MASTER_ADDR",
            value: `${internalJobName}-0.${internalJobName}.${namespace}.svc.cluster.local`
        });
        envV.push({
            name: "MASTER_PORT",
            value: String(this.settings.job.distributed.defaultPort)
        });
        return envV;
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
}