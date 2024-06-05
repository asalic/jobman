
export default class WithCodeException extends Error {

    private code: number;

    constructor(code: number, message: string) {
        super(message);
        this.code = code;
    }

    public getCode(): number {
        return this.code;
    }

    public getMessage() {
        return this.message;
    }
}