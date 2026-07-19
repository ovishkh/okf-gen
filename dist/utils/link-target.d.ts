export type MarkdownLinkTarget = {
    kind: "ignored";
} | {
    kind: "invalid";
} | {
    kind: "resolved";
    path: string;
    fragment?: string;
    hasMarkdownPath: boolean;
};
export declare function resolveMarkdownLinkTarget(from: string, rawTarget: string): MarkdownLinkTarget;
//# sourceMappingURL=link-target.d.ts.map