import fetch from "node-fetch";

import { KubeOpReturn } from "../../common/model/KubeOpReturn.js";
import type QueueResultDisplay from "../../common/model/QueueResultDisplay.js";
import type SubmitProps from "../../common/model/args/SubmitProps.js";
import type {SettingsClient} from "../model/SettingsClient.js";
import type ImageDetailsProps from "../../common/model/args/ImageDetailsProps.js";
import type ImageDetails from "../../common/model/ImageDetails.js";
import type DetailsProps from "../../common/model/args/DetailsProps.js";
import { V1Job } from "@kubernetes/client-node";
import type LogProps from "../../common/model/args/LogProps.js";
import type DeleteProps from "../../common/model/args/DeleteProps.js";
import type { KubeResourcesFlavor } from "../../common/model/Settings.js";
import type JobInfo from "../../common/model/JobInfo.js";
import type AbstractDto from "../../common/model/AbstractDto.js";

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

    public async list(): Promise<KubeOpReturn<JobInfo[] | null>> {
        return this.commonCall<JobInfo[] | null>("/jobs/", "GET");
    }

    public imageDetails(props: ImageDetailsProps): Promise<KubeOpReturn<string | null>> {
        return this.commonCall<string | null>(`/images/${props.image}/`, "GET");
    }

    public images(): Promise<KubeOpReturn<ImageDetails[]>> {
        return this.commonCall<ImageDetails[]>("/images/", "GET");
    }

    public details(props: DetailsProps): Promise<KubeOpReturn<V1Job | null>> {
        return this.commonCall<V1Job | null>(`/jobs/${props.jobName}/`, "GET");
    }

    public log(props: LogProps): Promise<KubeOpReturn<string | null>> {
        return this.commonCall<string | null>(`/jobs/${props.jobName}/logs/`, "GET");
    }

    public delete(props: DeleteProps): Promise<KubeOpReturn<null>> {
        if (props.all) {
            return this.commonCall<null>("/jobs/", "DELETE");
        } else {
            return this.commonCall<null>(`/jobs/${props.jobName}/`, "DELETE");
        }
    }

    public resourcesFlavors(): Promise<KubeOpReturn<KubeResourcesFlavor[] | null>> {
        return this.commonCall<KubeResourcesFlavor[] | null>("/resources-flavors", "GET");
    }

    protected commonCall<T extends AbstractDto | null>(path: string, method: string, props?: any): Promise<KubeOpReturn<T>> {
        return new Promise((resolve, reject) => {
            const opts = {
                method,
                headers:{
                  "Authorization":`ApiToken ${this.apiToken}`,
                  ...props && {"Content-Type": "application/json" }
                },
                ...props && { body: JSON.stringify(props) }
            }
            fetch(this.settings.webServiceUrl + path, opts)
                .then(
                async r => {
                    const g: KubeOpReturn<T> = KubeOpReturn.from<T>((await r.json()));
                    resolve(g);
                },
                e => reject(e)
            )
        });
    }


}