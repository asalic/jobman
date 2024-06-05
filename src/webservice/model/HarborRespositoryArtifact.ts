
interface ExtraAttr {

    additionalProp1: Object;
    additionalProp2: Object;
    additionalProp3: Object;

}

interface Annotations {
    additionalProp1: string;
    additionalProp2: string;
    additionalProp3: string;

}

interface Platform {
    architecture: string;
    os: string;
    'os.version': string;
    'os.features': string[];
    variant: string;
}

interface Reference {
    parent_id: number;
    child_id: number;
    child_digest: string;
    platform: Platform;
    annotations: Annotations;
    urls: string[];

}

interface AdditionalProp {
    href: string;
    absolute: true

}

interface AdditionLinks {
    additionalProp1: AdditionalProp;
    additionalProp2: AdditionalProp;
    additionalProp3: AdditionalProp;

}

interface Label {
    id: number;
    name: string;
    description: string;
    color: string;
    scope: string;
    project_id: number;
    creation_time: string;
    update_time: string;

}

interface Accessory {
    id: number;
    artifact_id: number;
    subject_artifact_id: number;
    size: number;
    digest: string;
    type: string;
    icon: string;
    creation_time: string;

}

export interface Tag {
    id: number;
    repository_id: number;
    artifact_id: number;
    name: string;
    push_time: string;
    pull_time: string;
    immutable: true;
    signed: true;
}

export interface HarborRespositoryArtifact {
        id: number;
        type: string;
        media_type: string;
        manifest_media_type: string;
        project_id: number;
        repository_id: number;
        digest: string;
        size: number;
        icon: string;
        push_time: string;
        pull_time: string;
        extra_attrs: ExtraAttr;
        annotations: Annotations;
        references: Reference[];
        tags: Tag[];
        addition_links: AdditionLinks;
        labels: Label[];
        scan_overview: Object;
        accessories: Accessory[];
}