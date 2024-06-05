import tar from "tar-stream";
import fs from "node:fs";
import zlib from "node:zlib";
import { homedir } from 'os';
import path from 'path';

import type { NewVersion } from "../model/SettingsClient.js";
import UnhandledValueError from "../error/UnhandledValueError.js";
import type LastUpdateCheck from "../model/LastUpdateCheck.js";
import { Readable } from "node:stream";

export default class VersionService {

    public static ERROR_MSG = (newVersion: string | null | undefined, errorMsg: string) => 
        `\nError trying to read the new version value from '${newVersion}': ${errorMsg}\n`;

    public static NEW_VER_AVAILABLE = (v: string, customMessage: string) => 
        `\nA new version  of jobman, ${v}, is available.\n${customMessage}\n`;


    public static USER_HOME_PATH = ".jobman/last_update_check.json";

    protected newVersion: NewVersion | null | undefined;

    constructor(newVersion: NewVersion | null | undefined) {
        this.newVersion = newVersion;
    }

    protected getCurrentVer(): string | undefined { return process.env["npm_package_version"]; }

    protected getAfterDate(): number {
        const checkAfter: string | undefined | null = this.newVersion?.check?.toLowerCase();
        if (checkAfter) {
            if (checkAfter.endsWith("h")) {
                return Number(checkAfter.substring(0, checkAfter.length - 1)) * 3600000;
            } else if (checkAfter.endsWith("m")) {
                return Number(checkAfter.substring(0, checkAfter.length - 1)) * 60000;
            } else if (checkAfter.endsWith("s")) {
                return Number(checkAfter.substring(0, checkAfter.length - 1)) * 1000;
            } else {
                throw new UnhandledValueError("Unhandled type of check after interval, use 'h' for hours or 'm' for minutes or 's' for seconds.")
            }
        } else {
            return 0;
        }

    }

    protected compareNewVer(newVer: string | null): string | null {
        if (newVer) {
            const cVer: string | undefined = this.getCurrentVer();
            if (cVer) {
                const newVerN = Number(newVer.replace(/[^0-9]/g, ''));
                const cVerN = Number(cVer.replace(/[^0-9]/g, ''));
                //const comp: number | undefined = cVer?.toLowerCase()?.localeCompare(newVer.toLowerCase());
                return newVerN >  cVerN ?
                    VersionService.NEW_VER_AVAILABLE(newVer, this.newVersion?.customMessage ?? "") : null;

            } else {
                console.error("[ERROR] Unable to get app's version.");
                return null;
            }
        } else {
            return null
        }
    }

    protected getPathLastUpdateCheck(): string {
        return path.join(homedir(), VersionService.USER_HOME_PATH);
    }

    protected storeLastUpdateCheck(newVer: string) {
        const luc: LastUpdateCheck = {
            lastCheck: Date.now(),
            remoteVersion: newVer
        }
        const uH: string = this.getPathLastUpdateCheck();
        try {
            fs.mkdirSync(path.dirname(uH), { recursive: true });
            fs.writeFileSync(uH, JSON.stringify(luc));
        } catch (e) {
            console.error("[ERROR] Cannot write the date of the last check for an update: ", e);
        }

    }

    protected getReadStream(path: string): Readable { 
        return fs.createReadStream(path);
    }

    protected checkTarGz(resolve: Function, reject: Function) {
        try {
            const pkgJson: string | null | undefined = this.newVersion?.packageJsonPath;
            if (pkgJson) {
                const extract = tar.extract();
                const datas: Map<string, string> = new Map<string, string>();
                extract.on('entry', (header, stream, cb) => {
                    stream.on('data', (chunk) => {
                            if (header.name.endsWith(pkgJson)) {
                                let data: string | undefined = datas.get(header.name);
                                if (!data) {
                                    data = "";
                                }
                                data += chunk;
                                datas.set(header.name, data);
                            }
                    });

                    stream.on("error", (e: Error) => {
                        reject(VersionService.ERROR_MSG(this.newVersion?.repository, e.message));
                    });
                
                    stream.on('end', function() {
                        cb();
                    });
                
                    stream.resume();
                });
                extract.on("error", (e: Error) => {
                    reject(VersionService.ERROR_MSG(this.newVersion?.repository, e.message));
                });
                
                extract.on('finish', () => {
                    if (datas.size === 1) {
                        try {
                            //console.log(datas.values().next().value);
                            const pkgObj = JSON.parse(datas.values().next().value);
                            if (pkgObj) {
                                const newVer: string | undefined = pkgObj["version"];
                                if (newVer) {
                                    this.storeLastUpdateCheck(newVer);
                                    resolve(this.compareNewVer(newVer));
                                } else {
                                    reject(VersionService.ERROR_MSG(this.newVersion?.repository, 
                                        `Missing 'version' property in ${this.newVersion?.packageJsonPath}`));
                                }
                            } else {
                                reject(VersionService.ERROR_MSG(this.newVersion?.repository, 
                                    `Unable to parse ${this.newVersion?.packageJsonPath}`));
                            }
                        } catch (e) {
                            const msg = e instanceof Error ? e.message : String(e);
                            reject(VersionService.ERROR_MSG(this.newVersion?.repository, msg));
                        }
                    } else if (datas.size > 1) {
                        reject(VersionService.ERROR_MSG(this.newVersion?.repository, 
                            `Multiple ${this.newVersion?.packageJsonPath} files found in '${this.newVersion?.repository}'`));
                    } else {
                        reject(VersionService.ERROR_MSG(this.newVersion?.repository, 
                            `No ${this.newVersion?.packageJsonPath} file found in '${this.newVersion?.repository}'`));
                    }
                });
                if (this.newVersion?.repository) {
                    const stream: Readable = this.getReadStream(this.newVersion?.repository);
                    stream.on("error", 
                        (e: Error) => reject(VersionService.ERROR_MSG(this.newVersion?.repository, e.message)));
                    stream.pipe(zlib.createGunzip())
                        .pipe(extract);
                } else {
                    reject("New version repository is null or undefined");
                }

            } else {
                reject(VersionService.ERROR_MSG(this.newVersion?.repository, "Please set the path of the new app version's package json in the settings for the repository of type tar.gz."));
            }
        } catch(e) {
            const msg = e instanceof Error ? e.message : String(e);
            reject(VersionService.ERROR_MSG(this.newVersion?.repository, msg));
        }
    }

    protected getLastUpdateCheck(): LastUpdateCheck | null {
        return JSON.parse(fs.readFileSync(this.getPathLastUpdateCheck(), {encoding: "ascii"})) as LastUpdateCheck;//Number(fs.readFileSync(uH, {encoding: "ascii"}));
    }

    public check(): Promise<string | null> {
        const checkAfter: number = this.getAfterDate();
        // only check for a new version if 
        let luc: LastUpdateCheck | null = null;
        let lastCheck = 0;
        try {
            luc = this.getLastUpdateCheck();
            lastCheck = luc?.lastCheck ?? 0;
        } catch (e) {
            //console.debug(e);
        }

        if (Date.now() > checkAfter + lastCheck) {
            return new Promise<string | null>((resolve, reject) => {
                if (this.newVersion?.repository) {
                    if (this.newVersion.packageJsonPath && this.newVersion.repository.toLowerCase().endsWith("tar.gz")) {
                       this.checkTarGz(resolve, reject);
                    } else {
                        reject(VersionService.ERROR_MSG(this.newVersion.repository, "The format of the new version is unsupported."));
                    }
                } else {
                    resolve(null);
                }
            });
        } else {
            return Promise.resolve(this.compareNewVer(luc?.remoteVersion ?? null));
        }
    }
}