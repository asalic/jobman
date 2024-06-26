import AbstractDto from "./AbstractDto.js";
import type EJobStatus from "./EJobStatus.js";

export default class JobInfo extends AbstractDto {
    
    name: string;
    uid?: string | undefined;
    status: EJobStatus;
    dateLaunched?: Date | undefined;
    position: number;
    flavor: string;

    public static override from(obj: any) {
        return Object.assign(new JobInfo(), obj);
    }
    
}