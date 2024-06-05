
// export interface KubeResourcesReqLim {
//     memory?: string;
//     cpu?: string;
//     [key: string]: string;
// }



export interface KubeResourcesFlavor {
    name: string;
    description?: string | null;
    resources: {
        requests?: {
            [key: string]: string
        },
        limits?: {
            [key: string]: string
        }
    };

}