import type { V1Job } from "@kubernetes/client-node";
import type { SettingsWebService } from "../model/SettingsWebService.js";
import type LoggerService from "./LoggerService.js";
import { v4 as uuidv4}  from "uuid";

export default class KubeManagerCommon {

    protected logger: LoggerService;
    protected settings: SettingsWebService;

    constructor(settings: SettingsWebService, logger: LoggerService) {
        this.logger = logger;
        this.settings = settings;
    }
    
    public userOwnsJob(userId: string, job: V1Job): boolean {
        return job.metadata?.annotations?.[this.settings.job.userNameAnnotation] === userId;
    }

    public getInternalJobName(userId: string, jobName?: string | null | undefined):  string {
        return userId + (jobName ?? uuidv4());
    }

    public getJobName(userId: string, internalJobName: string): string {
        return internalJobName.substring(userId.length);
    }

    public getNamespace(): string {
        return this.settings.job.protectedNamespace;
        // const nm: string | undefined = this.clusterConfig.getContexts().filter(c => c.name === this.clusterConfig.getCurrentContext())?.[0]?.namespace;
        // if (!nm)
        //     throw new KubeException("Unable to determine namespace");
        // else   
        //     return nm;
    }
}