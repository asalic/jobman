import type KubeManagerProps from "./KubeManagerProps.js";

export default interface DeleteProps extends KubeManagerProps {
    jobName?: string;
    all?: boolean;
}