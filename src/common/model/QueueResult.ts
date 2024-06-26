import AbstractDto from "./AbstractDto.js";

export default class QueueResult extends AbstractDto {
    public id: string;
    public flavor: string | undefined;
    //public count: number;
    public cpu: string | undefined;
    public memory: string | undefined;
    public gpu: number | undefined;
    public totalPending: number;
    public totalRunning: number;
    //public userJobsCnt: number;
    //public allJobsStats: QueueResultJobStats;
    //public userJobsStats: QueueResultJobStats;



    public static override from(obj: any) {
        return Object.assign(new QueueResult(), obj);
    }

}