import type EAnnotationType from "./EAnnotationType.js";


export default interface Annotation {
    key: string;
    value: string;
    valueType: EAnnotationType;
}