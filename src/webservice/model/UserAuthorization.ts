import type EAuthorizationType from "./EAuthorizationType";

export default interface UserAuthorization {

    type: EAuthorizationType;
    token: string;
}