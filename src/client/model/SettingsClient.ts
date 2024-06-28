
export interface NewVersion {
    repository?: string | null;
    packageJsonPath?: string | null;
    customMessage?: string | null;
    check?: string | null;
}

export interface SettingsClient {

    datasetsListEnvVar: string;
    /**
     * Path to a new version. Can be ommited, or left null/blank to disbale the check
     * It supports:
     * - a local full path to a tar.gz archive with the jobman distribution 
     */
    newVersion?: NewVersion | null;
    webServiceUrl: string;
    apiTokenEnvName: string;

}