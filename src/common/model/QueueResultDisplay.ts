import AbstractDto from "./AbstractDto.js";
import QueueResult from "./QueueResult.js";


export default class QueueResultDisplay extends AbstractDto {

    result: Map<string, QueueResult>;
    updated: Date;

    public static override from(obj: any) {
        const r = new QueueResultDisplay();
        r.updated = new Date(obj["updated"]);
        r.result = new Map();
        for (const [k, v] of obj["result"]) {
            r.result.set(k, QueueResult.from(v));
        }
        return r;
    }

    public override toString(): string {
        return JSON.stringify(
            {
                updated: this.updated,
                result: Object.fromEntries(this.result.entries())
            }
        )    
    }


}