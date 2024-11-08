import fetch from "node-fetch";

import { KubeOpReturn } from "../../common/model/KubeOpReturn.js";
import type QueueResultDisplay from "../../common/model/QueueResultDisplay.js";
import type SubmitProps from "../../common/model/args/SubmitProps.js";
import type {SettingsClient} from "../model/SettingsClient.js";
import type ImageDetailsProps from "../../common/model/args/ImageDetailsProps.js";
import type DetailsProps from "../../common/model/args/DetailsProps.js";
import type LogProps from "../../common/model/args/LogProps.js";
import type DeleteProps from "../../common/model/args/DeleteProps.js";
import type AbstractDto from "../../common/model/AbstractDto.js";
import type JobDetails from "../../common/model/JobDetails.js";
import type JobInfo from "../../common/model/JobInfo.js";
import type Page from "../../common/model/Page.js";
import type ImageDetails from "../../common/model/ImageDetails.js";
import type KubeResourcesFlavor from "../../common/model/KubeResourcesFlavor.js";

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

    public images(): Promise<KubeOpReturn<Page<ImageDetails>>> {
        return this.commonCall<Page<ImageDetails>>("/images/", "GET");
    }

    public details(props: DetailsProps): Promise<KubeOpReturn<JobDetails | null>> {
        return this.commonCall<JobDetails | null>(`/jobs/${props.jobName}/`, "GET");
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

    public resourcesFlavors(): Promise<KubeOpReturn<Page<KubeResourcesFlavor>>> {
        return this.commonCall<Page<KubeResourcesFlavor>>("/resources-flavors/", "GET");
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