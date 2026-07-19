export interface SourceOptions {
    maxBytes?: number;
    fetchImpl?: typeof fetch;
    filter?: (absolutePath: string) => boolean;
}
export declare function loadSources(inputs: string[], options?: SourceOptions): Promise<string>;
//# sourceMappingURL=sources.d.ts.map