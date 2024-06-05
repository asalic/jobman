export default interface HarborRepository{

    id: number;
    project_id:number;
    name: string;
    description: string
    artifact_count: number;
    pull_count: number;
    creation_time: string;
    update_time: string;
}