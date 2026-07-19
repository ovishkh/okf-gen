export declare class PromptCancelledError extends Error {
    constructor();
}
export declare function unwrapPrompt<T>(value: T | symbol): T;
export declare function registerDiagnosticSecret(key: string, value: string): void;
export declare function sanitizeDiagnosticText(input: string, environment?: NodeJS.ProcessEnv): string;
export declare function friendlyError(error: unknown): string;
//# sourceMappingURL=diagnostics.d.ts.map