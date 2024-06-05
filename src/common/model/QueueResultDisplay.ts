import QueueResult from "./QueueResult.js";


export default interface QueueResultDisplay {

    result: Map<string, QueueResult>;
    updated: Date;

}