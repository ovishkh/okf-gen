import { z } from "zod";
export declare const DEFAULT_PROJECT_CONFIG = "okf.config.yml";
export declare const projectConfigSchema: z.ZodObject<{
    provider: z.ZodOptional<z.ZodEnum<{
        anthropic: "anthropic";
        nebius: "nebius";
        ollama: "ollama";
        openai: "openai";
        openrouter: "openrouter";
    }>>;
    model: z.ZodOptional<z.ZodString>;
    sources: z.ZodDefault<z.ZodArray<z.ZodString>>;
    output: z.ZodDefault<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodURL>;
    retries: z.ZodOptional<z.ZodNumber>;
    log: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export declare function findProjectConfig(startDirectory?: string): Promise<string | undefined>;
export declare function loadProjectConfig(filePath?: string): Promise<{
    config: ProjectConfig;
    path?: string;
}>;
export declare function createProjectConfig(filePath?: string, force?: boolean): Promise<string>;
//# sourceMappingURL=project-config.d.ts.map