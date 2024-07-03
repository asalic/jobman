import type EnvEntry from "../EnvEntry.js";

export default interface SubmitProps {
    jobName?: string | undefined;
    image?: string | undefined;
    resources?: string | undefined;
    commandArgs?: string[] | undefined;
    //command?: boolean | undefined;
    dryRun?: boolean | undefined;
    annotations?:  string | undefined;
    datasetsList: string;
    env?: EnvEntry[] | undefined;
}