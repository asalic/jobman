
export default abstract class AbstractDto {

    public static from(obj: any): any {
        throw new Error(`The method 'from' for class '${this.constructor.name}' not implemented.`);
    }

    public toString(): string {
        return JSON.stringify(this);
    }
}