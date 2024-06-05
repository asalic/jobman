

export default class ParameterException extends Error {

    constructor(override readonly message: string) {
      super(message);
  
      this.name = "ParameterException";
    }

}