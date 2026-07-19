import { mkdtemp, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatEnv, loadOkfEnv, parseEnv, resolveConfigValue, resolveProvider, resolveRetryAttempts, saveOkfEnv } from "./config.js";

describe("okf environment configuration", () => {
  it("round-trips quoted values", () => {
    const values = { OKF_MODEL: "model with spaces", OPENAI_API_KEY: 'a"b\\c' };
    expect(parseEnv(formatEnv(values))).toEqual(values);
  });

  it("lets the terminal environment override saved values and reports both", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "okf-config-"));
    const file = path.join(root, ".env");
    const environment: NodeJS.ProcessEnv = { OPENROUTER_API_KEY: "terminal-key" };
    await saveOkfEnv({ OPENROUTER_API_KEY: "saved-key" }, file, {});
    await loadOkfEnv(file, environment);
    expect(environment.OPENROUTER_API_KEY).toBe("terminal-key");
    expect(resolveConfigValue("OPENROUTER_API_KEY", undefined, environment).source).toBe("terminal over saved");
  });

  it("infers a provider only when exactly one provider credential exists", () => {
    expect(resolveProvider(undefined, { OPENAI_API_KEY: "secret" }).value).toBe("openai");
    expect(resolveProvider(undefined, { OPENAI_API_KEY: "a", ANTHROPIC_API_KEY: "b" }).value).toBeUndefined();
  });

  it("writes saved credentials with private permissions", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "okf-config-"));
    const directory = path.join(root, ".okf");
    const file = path.join(directory, ".env");
    await saveOkfEnv({ OPENAI_API_KEY: "secret" }, file, {});
    expect(await readFile(file, "utf8")).not.toContain("undefined");
    if (process.platform !== "win32") {
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      expect((await stat(file)).mode & 0o777).toBe(0o600);
    }
  });

  it("loads saved values only when the terminal has no value", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "okf-config-"));
    const file = path.join(root, ".env");
    const environment: NodeJS.ProcessEnv = {};
    await saveOkfEnv({ OKF_MODEL: "saved-model" }, file, {});
    await loadOkfEnv(file, environment);
    expect(environment.OKF_MODEL).toBe("saved-model");
    expect(resolveConfigValue("OKF_MODEL", undefined, environment).source).toBe("saved");
  });

  it("resets environment provenance between repeated loads", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "okf-config-"));
    const firstFile = path.join(root, "first.env");
    const secondFile = path.join(root, "second.env");
    await saveOkfEnv({ OKF_MODEL: "first-saved" }, firstFile, {});
    await loadOkfEnv(firstFile, { OKF_MODEL: "terminal-model" });
    expect(resolveConfigValue("OKF_MODEL", undefined, { OKF_MODEL: "terminal-model" }).source).toBe("terminal over saved");

    const secondEnvironment: NodeJS.ProcessEnv = {};
    await saveOkfEnv({ OKF_MODEL: "second-saved" }, secondFile, {});
    await loadOkfEnv(secondFile, secondEnvironment);
    expect(resolveConfigValue("OKF_MODEL", undefined, secondEnvironment).source).toBe("saved");
  });

  it("does not erase an inherited terminal value when saved preferences are reset", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "okf-config-"));
    const file = path.join(root, ".env");
    const environment: NodeJS.ProcessEnv = { OKF_MODEL: "terminal-model" };
    await saveOkfEnv({ OKF_MODEL: "saved-model" }, file, {});
    await loadOkfEnv(file, environment);
    await saveOkfEnv({ OKF_MODEL: "" }, file, environment);
    expect(environment.OKF_MODEL).toBe("terminal-model");
    expect(await readFile(file, "utf8")).not.toContain("OKF_MODEL");
  });

  it("validates retry configuration", () => {
    expect(resolveRetryAttempts({})).toBe(3);
    expect(resolveRetryAttempts({ OKF_RETRY_ATTEMPTS: "0" })).toBe(0);
    expect(() => resolveRetryAttempts({ OKF_RETRY_ATTEMPTS: "11" })).toThrow("0 to 10");
    expect(() => resolveRetryAttempts({ OKF_RETRY_ATTEMPTS: "many" })).toThrow("0 to 10");
  });
});
