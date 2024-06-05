import { KubeOpReturnStatus } from "../../common/model/KubeOpReturn.js";


export default interface DeleteJobHandlerResult {

    status: KubeOpReturnStatus;
    message: string;
}