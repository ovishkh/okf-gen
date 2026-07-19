import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { type ModelOptions } from "../llm/providers.js";
import { type ValidationResult } from "./validate.js";
import type { BundlePlan } from "./schema.js";
export interface GenerateOptions extends ModelOptions {
    request: string;
    outputDirectory: string;
    sources?: string[];
    force?: boolean;
    includeLog?: boolean;
    modelInstance?: BaseChatModel;
    onProgress?: (event: GenerationProgress) => void;
}
export interface GenerationProgress {
    stage: "inspect" | "sources" | "model" | "repair" | "write" | "validate";
    message: string;
}
export interface GenerateResult {
    mode: "created" | "updated";
    plan: BundlePlan;
    files: string[];
    validation: ValidationResult;
}
export declare function generateBundle(options: GenerateOptions): Promise<GenerateResult>;
//# sourceMappingURL=generate.d.ts.map