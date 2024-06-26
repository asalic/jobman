import type EJobStatus from "./EJobStatus.js";

export default class JobInfo {
    
    name: string;
    uid?: string | undefined;
    status: EJobStatus;
    dateLaunched: number | null | undefined;
    position: number;
    flavor: string;
    
}