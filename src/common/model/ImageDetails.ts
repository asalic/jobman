import AbstractDto from "./AbstractDto.js";

export default class  ImageDetails extends AbstractDto {

    name: string;
    tags: string[]; 
    desc?: string;

    public static override from(obj: any) {
        return Object.assign(new ImageDetails(), obj);
    }
}