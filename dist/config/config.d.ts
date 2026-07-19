import { type ProviderName } from "../llm/providers.js";
export declare const OKF_PROVIDER_ENV_KEY = "OKF_PROVIDER";
export declare const OKF_MODEL_ENV_KEY = "OKF_MODEL";
export declare const OKF_BASE_URL_ENV_KEY = "OKF_BASE_URL";
export declare const OKF_RETRY_ATTEMPTS_ENV_KEY = "OKF_RETRY_ATTEMPTS";
export declare const okfEnvDirectory: string;
export declare const okfEnvPath: string;
export declare const managedEnvKeys: readonly ["OKF_PROVIDER", "OKF_MODEL", "OKF_BASE_URL", "OKF_RETRY_ATTEMPTS", ...string[]];
type EnvMap = Record<string, string>;
export type ConfigSource = "flag" | "terminal" | "saved" | "terminal over saved" | "session" | "default" | "unset";
export interface ResolvedConfigValue {
    value?: string;
    source: ConfigSource;
    envKey?: string;
}
export declare function loadOkfEnv(filePath?: string, environment?: NodeJS.ProcessEnv): Promise<EnvMap>;
export declare function saveOkfEnv(updates: EnvMap, filePath?: string, environment?: NodeJS.ProcessEnv): Promise<void>;
export declare function setSessionConfig(key: string, value: string, environment?: NodeJS.ProcessEnv): void;
export declare function resolveConfigValue(key: string, explicit?: string, environment?: NodeJS.ProcessEnv): ResolvedConfigValue;
export declare function resolveProvider(explicit?: string, environment?: NodeJS.ProcessEnv): ResolvedConfigValue;
export declare function getCredentialStatus(provider: ProviderName, environment?: NodeJS.ProcessEnv): ResolvedConfigValue;
export declare function resolveRetryAttempts(environment?: NodeJS.ProcessEnv): number;
export declare function parseEnv(content: string): EnvMap;
export declare function formatEnv(environment: EnvMap): string;
export {};
//# sourceMappingURL=config.d.ts.map