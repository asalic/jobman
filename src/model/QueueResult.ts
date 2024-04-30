
export default class QueueResult {
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

}