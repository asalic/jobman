import type EnvEntry from "../EnvEntry.js";

/**
 * @openapi
* components:
*   schemas:
*     SubmitProps:
*       type: object
*       required:
*         - datasetsList
*       properties:
*         jobName:
*           type:  string
*           maxLength: 36
*           pattern: '[a-z0-9]([a-z0-9-]{0,61}[a-z0-9]'
*           description: 'The name of the job.  Keep in mind that, internally, jobman prepends the OIDC user name'
*         image:
*           type: string
*           description: 'name of the Docker image followed by colon (:) followed  by version'
*         resources:
*           type: string
*           description: 'A label that represents a known predefined Kubernetes resources specification'
*         commandArgs:
*           type: array
*           description: 'List of arguments that you pass to the entrypoint of the chosen Docker image'
*           items:
*             type: string
*         # dryRun:
*         #   type: boolean
*         annotations:
*           type: string
*         datasetsList:
*           type: string
*           description: 'List of UUIDs separated by one comma (,)'
*         env:
*           type: array
*           items:
*             $ref: '#/components/schemas/EnvEntry'
*         logFile:
*           type: string
 */
export default interface SubmitProps {
    jobName?: string | undefined | null;
    image?: string | undefined | null;
    resources?: string | undefined | null;
    commandArgs?: string[] | undefined | null;
    //command?: boolean | undefined;
    dryRun?: boolean | undefined | null;
    annotations?:  string | undefined | null;
    datasetsList: string;
    env?: EnvEntry[] | undefined | null;
    logFile?: string;
    workers?: number | undefined | null;
    ports?: string | undefined | null;
}