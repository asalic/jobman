
import path from 'path';
import { fileURLToPath } from 'url';
import EAnnotationType from './model/EAnnotationType.js';
import UnhandledValueException from './model/exception/UnhandledValueException.js';
import type Annotation from './model/Annotation.js';
import { validate, version } from 'uuid';


export default class Util {

    public static getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        if (typeof error === "string") {
            return error;
        }

        return "An unknown error occurred";
    }


    public static getDirName(): string {
        return path.dirname(fileURLToPath(import.meta.url));
    }

    public static getExecDir(): string {
        const r = process.env['JOBMAN_EXEC_DIR'];
        if (!r) {
            throw new Error("Unable to determine the process exec dir. Please set eaan env var 'JOBMAN_EXEC_DIR' with the path.")
        }
        return r;
    }

    public static getKubeResourcesGPUsName(): string[] {
        return [
            "nvidia.com/gpu",
            "amd.com/gpu",
            "intel.com/gpu"
        ];
    }
    public static getK8sErrorCode(err: any): number | undefined {
        return (
            err?.statusCode ??
            err?.response?.statusCode ??
            err?.body?.code
        );
    }

    public static getAnnotationsFromSettings(annotations: Annotation[] | null | undefined) {
        const r = Object.create(null);
        if (annotations) {
            for (const a of annotations) {
                switch (a.valueType) {
                    case EAnnotationType.env: {
                        if (process.env[a.value])
                            r[a.key] = process.env[a.value];
                        break;
                    }
                    case EAnnotationType.string: r[a.key] = a.value; break;
                    default: throw new UnhandledValueException(`Annotation type '${a.valueType}' not handled for key '${a.key}' and value '${a.value}`);
                }
            }
        }
        return r;
    }

    public static isValidUUID(uuid: string, expectedVersion?: 1 | 3 | 4 | 5): boolean {
        if (!validate(uuid)) {
            return false; // Not a valid UUID format
        }
        if (expectedVersion !== undefined) {
            return version(uuid) === expectedVersion;
        }
        return true;
    }

    public static async fetchRetry(url: string, init?: RequestInit, retry = 3, delayMs = 8000): Promise<Response | null> {
        if (retry < 1) {
            throw new Error(`the retry value must be equal or higher to 1.`);
        }
        for (let a = 1; a <= retry; ++a) {
            try {
                const r = await fetch(url, init);
                return r;
            } catch (e: any) {
                console.error(e["code"]);
                // Throw the error if max attempts
                if (a === retry) {
                    throw e;
                } else {
                    // If code not one of these, throw error
                    if (!['EAI_AGAIN', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(e["code"])) {
                        throw e;
                    } else {
                        console.warn(`Error code '${e["code"]}' when instrospecting token, attempt ${a}/${retry}, sleeping ${delayMs}ms`);
                        await new Promise(r => setTimeout(r, delayMs));
                    }
                }
            }
        }
        return null;
    }

    // public static async getEntrypointAndCmd(registry: string, repo: string, tag: string) {
    //     const manifestRes = await fetch(`https://${registry}/v2/${repo}/manifests/${tag}`, {
    //         headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' }
    //     });
    //     const manifest = await manifestRes.json();
    //     const configDigest = manifest.config.digest;

    //     const configRes = await fetch(`https://${registry}/v2/${repo}/blobs/${configDigest}`);
    //     const config = await configRes.json();

    //     console.log('Entrypoint:', config.config.Entrypoint);
    //     console.log('Cmd:', config.config.Cmd);
    //     }
}