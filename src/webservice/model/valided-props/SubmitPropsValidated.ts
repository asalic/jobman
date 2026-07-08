import type { V1EnvVar } from "@kubernetes/client-node";
import type KubeResourcesFlavor from "../../../common/model/KubeResourcesFlavor.js";
import type ImageInfo from "../ImageInfo.js";

export default interface SubmitPropsValidated {
    jobName: string;
    internalJobName: string;
    image: ImageInfo;
    resources: KubeResourcesFlavor;
    args: string[] | null;
    annotations:  { [key: string]: string; } | null;
    datasetsList: string;
    env: V1EnvVar[];
    logFile: string | null;
    workers: number;
    ports: number[] | null;
}