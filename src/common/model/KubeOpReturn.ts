
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

    static from<T>(obj: any): KubeOpReturn<T> {
        return new KubeOpReturn(obj["status"], obj["message"], obj["payload"] as T);
    }

    public toString(): string {
        return JSON.stringify({
            status: this.status,
            message: this.message,
            payload: this.payload?.toString()
        })
    }

}