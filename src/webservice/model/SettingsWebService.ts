
export enum KubeConfigType {
    default = "default", 
    cluster = "cluster",
    file = "file"
}


export interface HarborConfig {
    url: string;
    project: string;
    projectProtected: string;
    projectProtectedToken: string;

}

export interface JobsQueue {
    namespace: string;
    configmap: string;
    gpuResources: string[];
}

export interface KubeConfigLocal {

    type: KubeConfigType;
    file?: string | null;
}

export interface KubeResourcesFlavor {
    name: string;
    description?: string | null;
    resources: {
        requests?: {
            [key: string]: string
        },
        limits?: {
            [key: string]: string
        }
    };

}

export enum AnnotationType {
    string = "string", 
    env = "env"
}

export interface Affinity {

    cpu: string;
    gpu: string;
}

export interface Resources {
    default?: string | null;
    label: string;
    predefined?: KubeResourcesFlavor[];

}

// export interface MountPoints {
//     datalake: string,
//     persistent_home: string,
//     persistent_shared_folder: string;
//     datasets: string;

// }

export interface SecurityContext {
    runAsUser?: number;
    runAsGroup?: number;
    fsGroup?: number;
    supplementalGroups?: Array<number>;
}

export interface Annotation {
    key: string;
    value: string;
    valueType: AnnotationType;
}

export interface Job {
    annotations?: Annotation[] | null;
    //datasetsList?: string | null;
    defaultImage?: string;
    imagePrefix?: string | null;
    userConfigmap: string | null | undefined,
    priorityClassName?: string | null;
    securityContext?: SecurityContext | null;
    //mountPoints?: MountPoints;
    //affinity: Affinity;
    resources: Resources;
}

export interface OidcSettings {
    url: string;
    realm: string;
    clientId: string;
    clientSecret: string;
}


export interface SettingsWebService {
    sharedNamespace: string;
    sharedConfigmap: string;
    jobsQueue: JobsQueue;
    harbor: HarborConfig;
    kubeConfig: KubeConfigLocal;   
    job: Job;
    oidc: OidcSettings;
    port: string;
    path: string;

}