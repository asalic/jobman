import fetch from "node-fetch";

import { KubeOpReturn, KubeOpReturnStatus } from "../../common/model/KubeOpReturn.js";
import type QueueResultDisplay from "../../common/model/QueueResultDisplay.js";
import type SubmitProps from "../../common/model/args/SubmitProps.js";
import type {SettingsClient} from "../model/SettingsClient.js";
import type ImageDetailsProps from "../../common/model/args/ImageDetailsProps.js";
import type DetailsProps from "../../common/model/args/DetailsProps.js";
import type LogProps from "../../common/model/args/LogProps.js";
import type DeleteProps from "../../common/model/args/DeleteProps.js";
import type JobDetails from "../../common/model/JobDetails.js";
import type JobInfo from "../../common/model/JobInfo.js";
import type Page from "../../common/model/Page.js";
import type ImageDetails from "../../common/model/ImageDetails.js";
import type KubeResourcesFlavor from "../../common/model/KubeResourcesFlavor.js";
import type JobLog from "../../common/model/JobLog.js";

export default class RestService {

    protected settings: SettingsClient;
    protected apiToken: string;

    constructor(settings: SettingsClient, apiToken: string) {
        this.settings = settings;
        this.apiToken = apiToken;
    }
    

    public queue():  Promise<KubeOpReturn<QueueResultDisplay | null>> {
        return this.commonCall<QueueResultDisplay | null>("/queue/", "GET");
    }

    public async submit(props: SubmitProps): Promise<KubeOpReturn<null>> {
        return this.commonCall<null>("/jobs/", "POST", props);
    }

    public async list(): Promise<KubeOpReturn<Page<JobInfo> | null>> {
        return this.commonCall<Page<JobInfo> | null>("/jobs/", "GET");
    }

    public imageDescription(props: ImageDetailsProps): Promise<KubeOpReturn<string | null>> {
        return this.commonCall<string | null>(`/images/${props.image}/description`, "GET");
    }

    public images(): Promise<KubeOpReturn<Page<ImageDetails> | null>> {
        return this.commonCall<Page<ImageDetails>>("/images/", "GET");
    }

    public details(props: DetailsProps): Promise<KubeOpReturn<JobDetails | null>> {
        return this.commonCall<JobDetails | null>(`/jobs/${props.jobName}/`, "GET");
    }

    public log(props: LogProps): Promise<KubeOpReturn<JobLog | null>> {
        return this.commonCall<JobLog>(`/jobs/${props.jobName}/logs/`, "GET");
    }

    public delete(props: DeleteProps): Promise<KubeOpReturn<null>> {
        if (props.all) {
            return this.commonCall<null>("/jobs/", "DELETE");
        } else {
            return this.commonCall<null>(`/jobs/${props.jobName}/`, "DELETE");
        }
    }

    public resourcesFlavors(): Promise<KubeOpReturn<Page<KubeResourcesFlavor> | null>> {
        return this.commonCall<Page<KubeResourcesFlavor> | null>("/resources-flavors/", "GET");
    }

    protected commonCall<T>(path: string, method: string, props?: any): Promise<KubeOpReturn<T | null>> {
        return new Promise((resolve, reject) => {
            const opts = {
                method,
                headers:{
                  "Authorization": `ApiToken ${this.apiToken}`,
                  ...props && {"Content-Type": "application/json" }
                },
                ...props && { body: JSON.stringify(props) }
            }
            fetch(this.settings.webServiceUrl + path, opts)
                .then(
                async r => {
                    const txt = await r.text();
                    let resp: any = null;
                    if (txt) {
                        resp = JSON.parse(txt) as T;
                    }                   
                    
                    if (r.status >=200 && r.status <= 299) {
                        resolve(new KubeOpReturn(KubeOpReturnStatus.Success, undefined, resp));
                    } else {
                        if (resp) {
                            reject(resp);
                        } else{
                            reject(txt);

                        }                        
                    }
                },
                e => reject(e)
            )
        });
    }


}