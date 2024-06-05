import fetch from "node-fetch";

import { KubeOpReturn } from "../../common/model/KubeOpReturn.js";
import type QueueResultDisplay from "../../common/model/QueueResultDisplay.js";
import type SubmitProps from "../../common/model/args/SubmitProps.js";
import type {SettingsClient} from "../model/SettingsClient.js";
import type { IJobInfo } from "../../common/model/IJobInfo.js";
import type ImageDetailsProps from "../../common/model/args/ImageDetailsProps.js";
import type ImageDetails from "../../common/model/ImageDetails.js";
import type DetailsProps from "../../common/model/args/DetailsProps.js";
import { V1Job } from "@kubernetes/client-node";
import type LogProps from "../../common/model/args/LogProps.js";
import type DeleteProps from "../../common/model/args/DeleteProps.js";
import type { KubeResourcesFlavor } from "../../common/model/Settings.js";

export default class RestService {

    protected settings: SettingsClient;
    protected apiToken: string;

    constructor(settings: SettingsClient, apiToken: string) {
        this.settings = settings;
        this.apiToken = apiToken;
    }
    

    public queue():  Promise<KubeOpReturn<QueueResultDisplay | null>> {
        return this.commonCall<KubeOpReturn<QueueResultDisplay | null>>("/queue");
    }

    public async submit(props: SubmitProps): Promise<KubeOpReturn<null>> {
        return this.commonCall<KubeOpReturn<null>>("/submit", props);
    }

    public async list(): Promise<KubeOpReturn<IJobInfo[] | null>> {
        return this.commonCall<KubeOpReturn<IJobInfo[] | null>>("/list");
    }

    public imageDetails(props: ImageDetailsProps): Promise<KubeOpReturn<string | null>> {
        return this.commonCall<KubeOpReturn<string | null>>("/image-details", props);
    }

    public images(): Promise<KubeOpReturn<ImageDetails[]>> {
        return this.commonCall<KubeOpReturn<ImageDetails[]>>("/images");
    }

    public details(props: DetailsProps): Promise<KubeOpReturn<V1Job | null>> {
        return this.commonCall<KubeOpReturn<V1Job | null>>("/details");
    }

    public log(props: LogProps): Promise<KubeOpReturn<string | null>> {
        return this.commonCall<KubeOpReturn<string | null>>("/log");
    }

    public delete(props: DeleteProps): Promise<KubeOpReturn<null>> {
        return this.commonCall<KubeOpReturn<null>>("/delete");
    }

    public resourcesFlavors(): Promise<KubeOpReturn<KubeResourcesFlavor[] | undefined>> {
        return this.commonCall<KubeOpReturn<KubeResourcesFlavor[] | undefined>>("/resources-flavors");
    }

    protected commonCall<T>(path: string, props?: any): Promise<T> {
        return new Promise((resolve, reject) => {
            fetch(this.settings.webServiceUrl + path,
                {
                    method: "POST",
                    headers:{
                      "Authorization":`ApiToken + ${this.apiToken}`
                    },
                    ...props && { body: JSON.stringify(props) }
                }
            ).then(
                async r => resolve((await r.json()) as T),
                e => reject(e)
            )
        });
    }


}