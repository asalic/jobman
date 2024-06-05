
export enum KubeOpReturnStatus {
    Error, Success, Unknown, Warning
}

export class KubeOpReturn<Type> {

    public readonly status: KubeOpReturnStatus;
    public readonly message: string | undefined;
    public readonly payload: Type | undefined;

    constructor(statusCode: KubeOpReturnStatus, 
            message: string | undefined, payload: Type | undefined) {
        this.status = statusCode;
        this.message = message;
        this.payload = payload;
    }

    public isOk(): boolean {
        return this.status === KubeOpReturnStatus.Success;
    }

    public isWarning(): boolean {
        return this.status === KubeOpReturnStatus.Warning;
    }

}