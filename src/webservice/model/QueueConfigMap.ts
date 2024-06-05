import QueueJob from "./QueueJob.js";

export default interface  QueueConfigMap {
    
    namespace: string;
    name: string;
    updated: Date;
    jobs: QueueJob[];

}