

export default interface Page<T> {

    data: T[];
    size: number;
    total: number;
    skip: number;
}