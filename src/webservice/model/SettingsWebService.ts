
import type Annotation from "../../common/model/Annotation.js";
import type KubeResourcesFlavor from "../../common/model/KubeResourcesFlavor.js";
import type ImageInfo from "./ImageInfo.js";

export enum KubeConfigType {
    default = "default", 
    cluster = "cluster",
    file = "file"
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


export interface Job {
    serviceAccount: string;
    serviceAccountTokenSecret: string;
    kubeRootCASecret: string;
    userNameAnnotation: string;
    annotationDatasetsList: string;
    annotations?: Annotation[] | null;
    //datasetsList?: string | null;
    defaultImage: ImageInfo;
    userConfigmap: string | null | undefined,
    priorityClassName?: string | null;
    securityContext?: SecurityContext | null;
    //mountPoints?: MountPoints;
    //affinity: Affinity;
    resources: Resources;
    protectedNamespace: string;
    k8sLogger: K8sLogger;
}

export interface OidcSettings {
    apiTokenAttributeName: string;
    url: string;
    realm: string;
    clientId: string;
    clientSecret: string;
    audiences: string[];
    resourceAccessRoles: string[];
}

export interface K8sLogger {
    image: string;
    // in seconds
    sleep: number;
}

export interface ImagePullSecret {
    name: string;
}

export interface HarborProject {
    baseUrl: string;
    name: string;
    token?: string | null;
    imagePullSecrets?: ImagePullSecret[] | null | undefined;
}

export interface PathInfo {
    prefix: string;
    api: string;
}

export interface Log {
    directory: string;
    level?: "trace" | "debug" | "info" | "warn" | "error" | "fatal" | null | undefined;
    fileName?: string | null | undefined;
}


export interface SettingsWebService {
    jobsQueue: JobsQueue;
    harborProjects: HarborProject[];
    projects: HarborProject[];
    kubeConfig: KubeConfigLocal;   
    job: Job;
    oidc: OidcSettings;
    port: string;
    path: PathInfo;
    defaultKubeURL?: string | null | undefined;
    log: Log;
}