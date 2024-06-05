
export default class UnhandledValueError extends Error {

    constructor(message: string | undefined) {
        super(message);
    }
}