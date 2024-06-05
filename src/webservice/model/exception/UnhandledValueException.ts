
export default class UnhandledValueException extends Error {

    constructor(override readonly message: string) {
      super(message);
  
      this.name = "ParameterException";
    }

}