
export default class QueueJob {

    namespace: string;
    //name: string;
    controllerUid: string;
    creationDate: Date;
    podStatus: string | null | undefined;
    resources: {
        flavor: string;
        requests?: {
            [key: string]: string;
        }
    }
}