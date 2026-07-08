
export default class PropsValidationError extends Error {

    constructor(message: string, options?: any) {
        super(message, options);
    }
}