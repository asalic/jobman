

export default class LoggerService {

    static DEBUG = 1;
    static LOG = 2;
    static INFO = 3;
    static WARN = 4;
    static ERROR = 5;

    debug(message: string | null | undefined) {
        this._print(LoggerService.DEBUG, message);
    }

    log(message: string | null | undefined) {
        this._print(LoggerService.LOG, message);
    }

    info(message: string | null | undefined) {
        this._print(LoggerService.INFO, message);
    }

    warn(message: string | null | undefined) {
        this._print(LoggerService.WARN, message);
    }

    error(message: string | null | undefined) {
        this._print(LoggerService.ERROR, message);
    }

    _print(verb: number, message: string | null | undefined) {
        let header = "";
        let f: Function | undefined = undefined;
        switch (verb) {
            case LoggerService.WARN: header = "[WARNING]"; f = console.warn; break;
            case LoggerService.INFO: header = "[INFO]"; f = console.info; break;
            case LoggerService.LOG: header = "[LOG]"; f = console.log; break;
            case LoggerService.ERROR: header = "[ERROR]"; f = console.error; break;
            case LoggerService.DEBUG: header = "[DEBUG]"; f = console.debug; break;
            default: throw new Error(`Unhandled verb ${verb}`);
        }
        if (message) {
            f?.(`${header} ${message}`);
        } else {
            f?.();
        }

    }
}