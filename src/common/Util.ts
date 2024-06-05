
import path from 'path';
import { fileURLToPath } from 'url';

export default class Util {

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
}