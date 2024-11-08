import type EJobStatus from "./EJobStatus";

export default interface JobDetails {

    name: string;
    uid?: string | undefined;
    status: EJobStatus;
    dateLaunched: number | null | undefined;
    position: number;
    flavor: string;
}