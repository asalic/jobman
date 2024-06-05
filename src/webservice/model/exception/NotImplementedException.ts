
export default class NotImplementedException extends Error {

    constructor(override readonly message: string) {
      super(message);
  
      this.name = "NotImplementedException";
    }

}