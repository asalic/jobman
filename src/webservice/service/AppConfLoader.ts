import fs from "node:fs";
import type  { SettingsWebService } from "../model/SettingsWebService.js";


export default class AppConfLoader {

    static getAppConf(settingsPath: string): SettingsWebService {
        const sett: SettingsWebService = JSON.parse(fs.readFileSync(settingsPath, { encoding: 'utf8', flag: 'r' })) as SettingsWebService;
        // const harborProjProtToken = process.env["HARBOR_PROTECTED_PROJECT_TOKEN"];
        // if (!harborProjProtToken) {
        //     console.error("HARBOR_PROTECTED_PROJECT_TOKEN env variable not set, cannot use that project");
        // } else {
        //     sett.harbor.projectProtectedToken = harborProjProtToken;
        // }
        return sett;
    }

}