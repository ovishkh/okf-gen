import { type ValidationIssue } from "./validate.js";
export interface LintIssue extends ValidationIssue {
    rule: string;
}
export interface LintResult {
    valid: boolean;
    filesChecked: number;
    issues: LintIssue[];
}
export declare function lintBundle(directory: string, options?: {
    strict?: boolean;
}): Promise<LintResult>;
//# sourceMappingURL=lint.d.ts.map