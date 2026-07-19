import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
export declare const providerNames: readonly ["nebius", "openrouter", "ollama", "openai", "anthropic"];
export type ProviderName = (typeof providerNames)[number];
export interface ProviderDefinition {
    label: string;
    hint: string;
    envKey?: string;
    defaultModel?: string;
    requiresKey: boolean;
    models?: string[];
}
export declare const providers: Record<ProviderName, ProviderDefinition>;
export interface ModelOptions {
    provider: ProviderName;
    model: string;
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxRetries?: number;
}
export declare function createChatModel(options: ModelOptions): BaseChatModel;
export declare function resolveApiKey(provider: ProviderName, explicit?: string): string | undefined;
export declare function fetchNebiusModels(apiKey: string, baseUrl?: string, fetchImpl?: typeof fetch): Promise<string[]>;
export declare function formatModelLabel(modelId: string): string;
//# sourceMappingURL=providers.d.ts.map