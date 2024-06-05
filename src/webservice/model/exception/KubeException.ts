export default class KubeException extends Error {

    constructor(override readonly message: string) {
      super(message);
  
      this.name = "KubeException";
    }

}