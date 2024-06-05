export default  class BaseError {

  public static ERROR_INTERNAL_TITLE:string = "Internal Server Error";
  public static ERROR_INTERNAL_MESSAGE: string = "There has been an internal server error, that's all we know.";

  private title: string;
  private message: string;
  private status: number;

  constructor(title: string, message: string, status: number) {
    this.title =  title;
    this.message = message;
    this.status = status;
  }

  getTitle(): string {
    return this.title;
  }
  getMessage(): string {
    return this.message;
  }
  getStatus(): number {
    return this.status;
  }
}



