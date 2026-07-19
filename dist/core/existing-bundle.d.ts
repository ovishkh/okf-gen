export interface ExistingBundle {
    root: string;
    markdownFiles: string[];
    conceptPaths: string[];
    conceptContents: Record<string, string>;
    log?: string;
}
export declare function inspectExistingBundle(directory: string): Promise<ExistingBundle | undefined>;
//# sourceMappingURL=existing-bundle.d.ts.map