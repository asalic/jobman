export enum EJobStatus {
    Pending = "Pending", 
    PendingError = "Pending - error", 
    Running = "Running", 
    Succeeded = "Succeeded", 
    Failed = "Failed", 
    Unknown = "Unknown"
}

export interface IJobInfo {

    name: string;
    uid?: string | undefined;

}