import { type Command } from "commander";
declare const shellCommands: readonly [{
    readonly syntax: "/generate [request]";
    readonly name: "generate";
    readonly description: "Create or update an OKF bundle";
}, {
    readonly syntax: "/update [request]";
    readonly name: "update";
    readonly description: "Refresh the last generated bundle";
}, {
    readonly syntax: "/view [directory]";
    readonly name: "view";
    readonly description: "Open the local document explorer";
}, {
    readonly syntax: "/validate [directory]";
    readonly name: "validate";
    readonly description: "Check an existing bundle";
}, {
    readonly syntax: "/providers";
    readonly name: "providers";
    readonly description: "List providers and API-key variables";
}, {
    readonly syntax: "/provider [name]";
    readonly name: "provider";
    readonly description: "Change provider for this session";
}, {
    readonly syntax: "/model [id]";
    readonly name: "model";
    readonly description: "Change model for this session";
}, {
    readonly syntax: "/api-key";
    readonly name: "api-key";
    readonly description: "Enter or replace a credential";
}, {
    readonly syntax: "/status";
    readonly name: "status";
    readonly description: "Show effective config and its sources";
}, {
    readonly syntax: "/config save|reset";
    readonly name: "config";
    readonly description: "Manage saved provider/model defaults";
}, {
    readonly syntax: "/commands";
    readonly name: "commands";
    readonly description: "Show the complete command guide";
}, {
    readonly syntax: "/exit";
    readonly name: "exit";
    readonly description: "Close okf";
}];
export declare function firstRunMarkerPath(environment?: NodeJS.ProcessEnv): string;
export declare function showFirstRunWordmark(markerPath?: string): Promise<boolean>;
export declare function showWordmark(): void;
export declare function splitCommandLine(input: string): string[];
export declare function commandSuggestions(input: string): typeof shellCommands[number][];
export declare function startInteractiveShell(program: Command, version: string): Promise<void>;
export declare function isInteractiveShellActive(): boolean;
export declare function rememberGeneration(output: string, sources: string[]): void;
export declare function commandHelpText(): string;
export declare function formatHomePath(directory: string): string;
export {};
//# sourceMappingURL=interactive.d.ts.map