
import { parseArgs } from 'node:util';
import { exit } from "node:process";
import fs from "node:fs";
import path from 'path';
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

import DisplayService from "./service/DisplayService.js";
import ParameterException from '../common/model/exception/ParameterException.js';
import SettingsManager from './service/SettingsManager.js';
import type KubeManagerProps from '../common/model/args/KubeManagerProps.js';
import Util from '../common/Util.js';
import VersionService from './service/VersionService.js';
import type { SettingsClient } from './model/SettingsClient.js';

const ARGS_PARSING_ERROR_MSG = "Error parsing the arguments, please check the help by passing -h/--help as first arg of the application.";

export enum Cmd {
    Queue, Images, ImageDetails, Submit, List, Details, Log, Delete, ResourcesFlavors
}


export class Main {

    public static readonly USAGE_FILE: string = "usage.md";
    public static readonly EXAMPLES_FILE: string = "examples.md";

    protected args: string[];

    constructor(args: string[]) {
        this.args = args;
    }

    public run(): number {
        if (this.args.length <= 2) {
            this.printV();
            this.printExamples();
            return 0;
        }
        
        const argsTmp: string[] = this.args.slice(2);
        const cmdArg: string | undefined = argsTmp[0]?.toLowerCase();
        if (!cmdArg) {
            this.printV();
            this.printExamples();
            return 0;
        }
        switch (cmdArg) {
        
            case "-h": 
            case "--help": this.printH(); break;
            case "-v":
            case "--version": this.printV(); break;
            case "-s":
            case "--settings": 
                if (argsTmp.length >= 3) {
                    const cmdArgTmp: string | undefined = argsTmp[2];
                    const settingsPath:string | undefined = argsTmp[1];
                    if (cmdArgTmp && settingsPath) {
                        this.parseCmdArgs(cmdArgTmp, settingsPath, argsTmp.slice(3, argsTmp.length));
                    } else {
                        console.error(`Undefined settings path '${settingsPath}' and/or command '${cmdArgTmp}'`);
                        return 1;
                    }
                } else {
                    console.error(ARGS_PARSING_ERROR_MSG);
                    return 1;
                }
                break;    
            default: this.parseCmdArgs(cmdArg, null, argsTmp.slice(1, argsTmp.length)); break;
        }
        return 0;
    }

    protected parseCmdArgs(cmdArg: string, sp: string | null, cmdArgs: string[]): void {
        switch (cmdArg) {
            case "queue": this.execCmd(Cmd.Queue, sp, {}); break;
            case "submit": { 
                let cmdPos = cmdArgs.indexOf("--");
                cmdPos = cmdPos === -1 ? cmdArgs.length : cmdPos;
                //if (cmdPos !== -1) {

                const tmp = cmdArgs.slice(0, cmdPos);
                const { values } = parseArgs({ args: tmp, options: {
                            "job-name": { type: "string", short: "j" },
                            image: { type: "string", short: "i" },
                            "resources-flavor": { type: "string", short: "r" },
                            command: { type: "boolean", short: "c", default: false },
                            "dry-run": { type: "boolean", default: false },
                            annotations: {type: "string", multiple: false, short: "a"}
                        }
                    });
                this.execCmd(Cmd.Submit, sp, {
                        jobName: values["job-name"], image: values.image, 
                        resources: values["resources-flavor"],
                        commandArgs: cmdArgs.slice(cmdPos + 1, cmdArgs.length),
                        command: values.command,
                        dryRun: values["dry-run"],
                        annotations: values["annotations"]
                    });
                // } else {
                //     throw new ParameterException("Missing container command separator '--'. It is needed to separate jobman's args and the actual command  passed to the container.");
                // }
                break;
            }
            case "list": this.execCmd(Cmd.List, sp, {}); break;
            case "images":  this.execCmd(Cmd.Images, sp, {}); break;
            case "image-details": {
                    const { values: dv } = parseArgs({ args: cmdArgs, options: {
                        image: { type: "string", short: "i" }
                    }});
                    this.execCmd(Cmd.ImageDetails, sp, { image: dv["image"] }); 
                break;
            }
            case "details": {
                    const { values: dv } = parseArgs({ args: cmdArgs, options: {
                        "job-name": { type: "string", short: "j" }
                    }});
                    this.execCmd(Cmd.Details, sp, { jobName: dv["job-name"] }); 
                break;
            }
            case "log": throw new ParameterException(`Please use 'logs' instead of 'log', the latter has been deprecated and is not accepted anymore.`); 
            case "logs": {
                    const lv = parseArgs({ args: cmdArgs, options: {
                        "job-name": { type: "string", short: "j" }
                    }});
                    if (lv.values["job-name"])
                        this.execCmd(Cmd.Log, sp, { jobName: lv.values["job-name"] });
                    else
                        throw new ParameterException(`Please specify the job name for the '${cmdArg}' command.`);
                break;
            }
            case "delete": {
                    const { values: cv } = parseArgs({ args: cmdArgs, options: {
                        "job-name": { type: "string", short: "j" },
                        all: {type: "boolean", default: false}
                    }});
                    if (cv["job-name"] && cv.all) {
                        throw new ParameterException(`You cannot request to remove both all and a specific job at the same time. Use only one of the options for every invocation of jobman.`);
                    }
                    if (cv["job-name"])
                        this.execCmd(Cmd.Delete, sp, { jobName: cv["job-name"] });
                    else if (cv.all) {
                        this.execCmd(Cmd.Delete, sp, { all: true });
                    } else
                        throw new ParameterException(`Please specify the job name for the '${cmdArg}' command, or the "--all" flag (to remove all your jobs).`);
                break;
            }
            case "resources-flavors": this.execCmd(Cmd.ResourcesFlavors, sp, {}); break;
            default: throw new ParameterException(`Unknown command '${cmdArg}'`);
        }
    }

    protected execCmd(cmd: Cmd, sp: string | null, payload: KubeManagerProps): void { 
        const s: SettingsClient = new SettingsManager(sp).settings;
        // Check for new version
        new VersionService(s.newVersion)
            .check()
            .then(msg => msg ? console.log(msg) : () => {})
            .catch(errMesage => console.error(errMesage))
            // Execute the rest of the program independently of what is return by the new version checker
            .finally(() => {
                const apiToken = this.getApiToken(s.apiTokenEnvName);
                const ds: DisplayService = new DisplayService(s, apiToken);
                switch (cmd) {
                    case Cmd.Queue: ds.queue(); break;
                    case Cmd.Images: ds.images(); break;
                    case Cmd.ImageDetails: ds.imageDetails(payload); break;
                    case Cmd.Submit: ds.submit(payload); break;
                    case Cmd.List: ds.list(); break;
                    case Cmd.Details: ds.details(payload); break;
                    case Cmd.Log: ds.log(payload); break;
                    case Cmd.Delete: ds.delete(payload); break;
                    case Cmd.ResourcesFlavors: ds.resourcesFlavors(); break;
                    default: console.error(ARGS_PARSING_ERROR_MSG);
                }
            });
    }
    
    protected printH(): void  {
        marked.setOptions({
            // Define custom renderer
            renderer: new TerminalRenderer()
          });
        console.log(marked(fs.readFileSync(path.join(path.dirname(Util.getDirName()), Main.USAGE_FILE), {encoding: "ascii", flag: "r" })));
    }
    
    protected printV(): void {
        console.info(this.getV());
    }

    protected printExamples(): void {
        marked.setOptions({
            // Define custom renderer
            renderer: new TerminalRenderer()
          });
        console.log(marked(fs.readFileSync(path.join(path.dirname(Util.getDirName()), Main.EXAMPLES_FILE), {encoding: "ascii", flag: "r" })));
    }
 
    protected getApiToken(apiTokenEnvName: string) {
        const apiToken: string | undefined = process.env[apiTokenEnvName];
        if (apiToken) {
            return apiToken;
        } else {
            throw new Error(`Please define an env variable called ${apiTokenEnvName} that holds the API token for the application.`);
        }
    }

    public getV(): string {
        return `jobman version '${process.env["npm_package_version"]}'`;
    }

}

export function main(args: string[]): number {
    const main = new Main(args);
    try {
        return main.run();
    } catch (e) {
        if (e instanceof ParameterException ||
                (e instanceof TypeError && JSON.parse(JSON.stringify(e))["code"] === "ERR_PARSE_ARGS_UNKNOWN_OPTION")) {
            console.error("\x1b[31m", "[ERROR]", "\x1b[0m", e.message);
        } else {
            console.error("\x1b[31m", "[ERROR]", "\x1b[0m", String(e));
        }
        return 1;
    }
}

const code = main(process.argv);
if (code !== 0) {
    exit(code);
}
