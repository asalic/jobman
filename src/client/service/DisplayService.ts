import { marked } from "marked";
import util  from 'node:util';
import { Table } from "console-table-printer";
import RestService from "./RestService.js";
import type { SettingsClient } from "../model/SettingsClient.js";
import QueueResult from "../../common/model/QueueResult.js";
import { KubeOpReturn, KubeOpReturnStatus } from "../../common/model/KubeOpReturn.js";
import type ImageDetails from "../../common/model/ImageDetails.js";
import type ImageDetailsProps from "../../common/model/args/ImageDetailsProps.js";
import type SubmitProps from "../../common/model/args/SubmitProps.js";
import type DetailsProps from "../../common/model/args/DetailsProps.js";
import type LogProps from "../../common/model/args/LogProps.js";
import type DeleteProps from "../../common/model/args/DeleteProps.js";
import type { KubeResourcesFlavor } from "../../common/model/Settings.js";
import JobInfo from "../../common/model/JobInfo.js";
import TerminalRenderer from "marked-terminal";

type SimpleMsgCallbFunction = (...args: any[]) => void;


export default class DisplayService {
    
    /**
     * The default number of columns used by all commands that output a tABLE 
     */
    public static DEFAULT_NO_COLUMNS = 80;

    /**
     * The no of characters used to create a margin for a column
     */
    public static TABLE_COL_MARGIN = 8;

    protected km: RestService;

    protected options: Intl.DateTimeFormatOptions = {
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false,
        timeZoneName: 'short'
      };

    constructor(settings: SettingsClient, apiToken: string) {
        this.km = new RestService(settings, apiToken);
        util.inspect.defaultOptions.maxArrayLength = null;
    }

    public queue(): void {
        this.km.queue()
            .then(r => this.simpleMsg(r,  () => {
                    if (r.payload) {
                        const enabledColumns: string[] = ["Flavor", "CPUs/Memory/GPUs", "Jobs pending", "Jobs running"];
                        const totalNoColsAvailable = this.getTerminalNoCols() - (enabledColumns.length  * DisplayService.TABLE_COL_MARGIN);
                        const t = new Table({
                            enabledColumns,
                            columns: [],
                            computedColumns:[
                                {
                                    name: "Flavor",
                                    maxLen: Math.floor(totalNoColsAvailable * 0.45),
                                    function: (row: QueueResult) => row.flavor ?? "<no label>",
                                    alignment: 'center'
                                },
                                {
                                    name: "CPUs/Memory/GPUs",
                                    maxLen: Math.floor(totalNoColsAvailable * 0.25),
                                    function: (row: QueueResult) => `${row.cpu ?? "-"}/${row.memory ?? "-"}/${row.gpu ?? "-"}`, 
                                    alignment: 'center'
                                },
                                {
                                    name: "Jobs pending",
                                    maxLen: Math.floor(totalNoColsAvailable * 0.15),
                                    function: (row: QueueResult) => row.totalPending,
                                    alignment: 'center'
                                },
                                {
                                    name: "Jobs running",
                                    maxLen: Math.floor(totalNoColsAvailable * 0.15),
                                    function: (row: QueueResult) => row.totalRunning,
                                    alignment: 'center'
                                }
                            ]
                        });
                        t.addRows(r.payload.result);
                        t.printTable();
                        console.log(`Last queue update on: ${new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(r.payload.updated))}`)
                    } else {
                        this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, "Queue of active jobs not available", null))
                    }
                }
            ))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));        
    }

    public images(): void {
        this.km.images().then(r => this.simpleMsg(r, 
                () => {
                    const enabledColumns: string[] = ["name", "Tags List"];
                    const totalNoColsAvailable = this.getTerminalNoCols() - (enabledColumns.length  * DisplayService.TABLE_COL_MARGIN);
                    
                    const t = new Table({
                        enabledColumns,
                        columns: [
                          {
                            name: "name",
                            maxLen: Math.floor(totalNoColsAvailable * 0.25),
                            title: "Image Name",
                            alignment: 'left'
                          }
                        ],
                        computedColumns:[
                            {
                                name: "Tags List",
                                maxLen: Math.floor(totalNoColsAvailable * 0.75),
                                function: (row: ImageDetails) => row.tags.join("  "), 
                                alignment: 'left'
                            }
                        ]
                    });
                    t.addRows(r.payload);
                    t.printTable();
                }))
                .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));
    }

    public imageDetails(props: ImageDetailsProps): void {
        //marked.use(markedTerminal());

        marked.setOptions({
            // Define custom renderer
            renderer: new TerminalRenderer()
          });
        this.km.imageDetails(props)
            .then(r => this.simpleMsg(r,  () => console.log(marked(r.payload ?? ""))))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));

    }

    public submit(props: SubmitProps): void {
        this.km.submit(props)
            .then(r => this.simpleMsg(r))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));
    }
    

    public list(): void {
        // marked.use(markedTerminal({
        //     width: this.getTerminalNoCols(),
        //     reflowText: true
        //   }));

        // marked.setOptions({
        //     renderer: new TerminalRenderer({
        //       width: this.getTerminalNoCols(),
        //       reflowText: true
        //     })
        //   });
        this.km.list()
            .then(r => this.simpleMsg(r, 
                () => {
                    const enabledColumns: string[] = ["name", "status", "flavor", "Launch Date"];
                    const totalNoColsAvailable = this.getTerminalNoCols() - (enabledColumns.length  * DisplayService.TABLE_COL_MARGIN);
                    const t = new Table({
                        enabledColumns,
                        columns: [
                          {
                            name: "name",
                            maxLen: Math.floor(totalNoColsAvailable * 0.50),
                            title: "Job Name",
                            alignment: 'left'
                          },
                          {
                            name: "flavor",
                            maxLen: Math.floor(totalNoColsAvailable * 0.10),
                            title: "Flavor",
                            alignment: 'center'
                          },
                          {
                            name: "status",
                            maxLen: Math.floor(totalNoColsAvailable * 0.10),
                            title: "Status",
                            alignment: 'center'
                          }
                        ],
                        computedColumns:[
                            {
                                name: "Launch Date",
                                maxLen: Math.floor(totalNoColsAvailable * 0.30),
                                function: (row: JobInfo) => new Intl.DateTimeFormat('en-GB', this.options)
                                                .format(row.dateLaunched),
                                alignment: 'center'
                            }
                        ]
                    });
                    t.addRows(r.payload);
                    t.printTable();
                }))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));
    }

    public details(props: DetailsProps): void {
        this.km.details(props)
            .then(r => this.simpleMsg(r, () => console.dir(r.payload, {depth: null})))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));

    }

    public log(props: LogProps): void {
        this.km.log(props)
            .then(r => this.simpleMsg(r, () => console.log("----Log begin----\n\n", "\x1b[36m", r.payload, "\x1b[0m", "\n----Log end----")))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));

    }

    public delete(props: DeleteProps): void {
        this.km.delete(props)
            .then(r => this.simpleMsg(r))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));
    }

    public resourcesFlavors(): void {
        this.km.resourcesFlavors()
            .then(r => this.simpleMsg(r, 
                () => {
                    const enabledColumns: string[] = ["name", "CPU*", "Memory*", "GPU**", "description"];
                    const totalNoColsAvailable = this.getTerminalNoCols() - (enabledColumns.length  * DisplayService.TABLE_COL_MARGIN);
                    
                    const t = new Table({
                        enabledColumns,
                        columns: [
                            {
                            name: "name",
                            maxLen: Math.floor(totalNoColsAvailable * 0.2),
                            title: "Name",
                            alignment: 'left'
                            },
                            {
                            name: "description",
                            maxLen: Math.floor(totalNoColsAvailable * 0.35),
                            title: "Description",
                            alignment: 'left'
                            }
                        ],
                        computedColumns:[
                            {
                                name: "CPU*",
                                maxLen: Math.floor(totalNoColsAvailable * 0.15),
                                function: (row: KubeResourcesFlavor) => `${row.resources?.requests?.["cpu"] ?? "-"} / ${row.resources?.limits?.["cpu"] ?? "-"}`,
                                alignment: 'center'
                            },
                            {
                                name: "Memory*",
                                maxLen: Math.floor(totalNoColsAvailable * 0.15),
                                function: (row: KubeResourcesFlavor) => `${row.resources?.requests?.["memory"] ?? "-"} / ${row.resources?.limits?.["memory"] ?? "-"}`,
                                alignment: 'center'
                            },
                            {
                                name: "GPU**",
                                maxLen: Math.floor(totalNoColsAvailable * 0.15),
                                function: (row: KubeResourcesFlavor) => 
                                    `${row.resources?.requests?.["nvidia.com/gpu"] ?? "-"}`
                                    + ` / ${row.resources?.requests?.["amd.com/gpu"] ?? "-"}`
                                    + ` / ${row.resources?.requests?.["intel.com/gpu"] ?? "-"}`,
                                alignment: 'center'
                            }
                        ]
                    });
                    t.addRows(r.payload);
                    t.printTable();
                    console.log();
                    console.log("*First value is for request, second for limits");
                    console.log("**First value represents the total count of NVIDIA GPUS, followed by that of AMD GPUs, and, finally, Intel's");
                }))
            .catch(e => this.simpleMsg(new KubeOpReturn(KubeOpReturnStatus.Error, e.message, null)));
    }

    protected simpleMsg(op: KubeOpReturn<any>, displayFunc: SimpleMsgCallbFunction | undefined = undefined): void {
        if (op.isOk()) {
            if (displayFunc) {
                displayFunc(op.payload);
            } else {
                console.log("\x1b[32m", "[SUCCESS]", "\x1b[0m", op.message);
            }
        } else if (op.isWarning()) {
            console.log("\x1b[33m", "[WARNING]", "\x1b[0m", op.message);
        } else {
            console.error("\x1b[31m", "[ERROR]", "\x1b[0m", op.message);
        }
    }

    protected getTerminalNoCols(): number {
        return process.stdout.columns && process.stdout.columns > 0 ? process.stdout.columns : DisplayService.DEFAULT_NO_COLUMNS;
    }

}