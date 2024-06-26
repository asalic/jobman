export default interface KubeResourcesFlavor {
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