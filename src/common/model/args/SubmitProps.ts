import type KubeManagerProps from "./KubeManagerProps.js";

export default interface SubmitProps extends KubeManagerProps{
    jobName?: string;
    image?: string;
    resources?: string;
    commandArgs?: string[];
    command?: boolean;
    dryRun?: boolean;
    annotations?:  string;
}