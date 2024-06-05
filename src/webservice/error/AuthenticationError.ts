import BaseError from "../../common/error/BaseError.js";


export default class AuthenticationError extends BaseError {

    constructor(title: string, message: string, status: number)  {
        super(title, message, status) ;
    }
}