export interface ValidationIssue {
    severity: "error" | "warning";
    file: string;
    message: string;
}
export interface ValidationResult {
    valid: boolean;
    filesChecked: number;
    issues: ValidationIssue[];
}
export declare function validateBundle(directory: string): Promise<ValidationResult>;
//# sourceMappingURL=validate.d.ts.map