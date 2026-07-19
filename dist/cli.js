#!/usr/bin/env node

// src/cli/cli.ts
import * as p3 from "@clack/prompts";
import boxen2 from "boxen";
import pc2 from "picocolors";
import { Command, CommanderError as CommanderError2, Option } from "commander";
import path12 from "path";

// src/core/existing-bundle.ts
import { readFile, readdir } from "fs/promises";
import path from "path";
import matter from "gray-matter";
async function inspectExistingBundle(directory) {
  const root = path.resolve(directory);
  try {
    const rootIndex = await readFile(path.join(root, "index.md"), "utf8");
    const parsed = matter(rootIndex);
    if (String(parsed.data.okf_version ?? "") !== "0.1") return void 0;
    const markdownFiles = await findMarkdownFiles(root);
    const relativeFiles = markdownFiles.map((file) => toPosix(path.relative(root, file)));
    const conceptPaths = relativeFiles.filter((file) => !["index.md", "log.md"].includes(path.posix.basename(file)));
    const conceptContents = Object.fromEntries(await Promise.all(conceptPaths.map(async (file) => {
      return [file, await readFile(path.join(root, file), "utf8")];
    })));
    const logPath = path.join(root, "log.md");
    const log2 = relativeFiles.includes("log.md") ? await readFile(logPath, "utf8") : void 0;
    return { root, markdownFiles: relativeFiles, conceptPaths, conceptContents, ...log2 === void 0 ? {} : { log: log2 } };
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
async function findMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findMarkdownFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files.sort();
}
function toPosix(value) {
  return value.split(path.sep).join("/");
}

// src/core/generate.ts
import path6 from "path";

// src/llm/providers.ts
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOpenRouter } from "@langchain/openrouter";
var providerNames = ["nebius", "openrouter", "ollama", "openai", "anthropic"];
var providers = {
  nebius: {
    label: "Nebius Token Factory",
    hint: "Hosted open-source models through an OpenAI-compatible API",
    envKey: "NEBIUS_API_KEY",
    defaultModel: "zai-org/GLM-5.2",
    requiresKey: true
  },
  openrouter: {
    label: "OpenRouter",
    hint: "Open and proprietary models through one routing API",
    envKey: "OPENROUTER_API_KEY",
    defaultModel: "openai/gpt-oss-120b",
    requiresKey: true,
    models: ["openai/gpt-oss-120b", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-flash"]
  },
  ollama: {
    label: "Ollama",
    hint: "Local models with no API key",
    defaultModel: "qwen3:8b",
    requiresKey: false,
    models: ["qwen3:8b", "llama3.2:3b", "mistral:7b"]
  },
  openai: {
    label: "OpenAI",
    hint: "OpenAI API models",
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-5.4-mini",
    requiresKey: true,
    models: ["gpt-5.4-mini", "gpt-4.1-mini"]
  },
  anthropic: {
    label: "Anthropic",
    hint: "Claude models through the Anthropic API",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-sonnet-4-6",
    requiresKey: true,
    models: ["claude-sonnet-4-6", "claude-haiku-4-5"]
  }
};
function createChatModel(options) {
  const temperature = options.temperature ?? 0.1;
  switch (options.provider) {
    case "nebius":
      return new ChatOpenAI({
        model: options.model,
        apiKey: requireApiKey(options),
        temperature,
        maxRetries: options.maxRetries,
        streamUsage: false,
        configuration: {
          baseURL: options.baseUrl ?? "https://api.tokenfactory.nebius.com/v1/"
        }
      });
    case "openrouter":
      return new ChatOpenRouter({
        model: options.model,
        apiKey: requireApiKey(options),
        temperature,
        maxRetries: options.maxRetries,
        siteName: "okf"
      });
    case "ollama":
      return new ChatOllama({
        model: options.model,
        baseUrl: options.baseUrl ?? "http://127.0.0.1:11434",
        temperature,
        maxRetries: options.maxRetries
      });
    case "openai":
      return new ChatOpenAI({
        model: options.model,
        apiKey: requireApiKey(options),
        temperature,
        maxRetries: options.maxRetries
      });
    case "anthropic":
      return new ChatAnthropic({
        model: options.model,
        anthropicApiKey: requireApiKey(options),
        temperature,
        maxRetries: options.maxRetries
      });
  }
}
function resolveApiKey(provider, explicit) {
  const envKey = providers[provider].envKey;
  return explicit?.trim() || (envKey ? process.env[envKey]?.trim() : void 0);
}
async function fetchNebiusModels(apiKey, baseUrl = "https://api.tokenfactory.nebius.com/v1/", fetchImpl = fetch) {
  const endpoint = new URL("models", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: {
      authorization: `Bearer ${apiKey}`,
      accept: "application/json"
    },
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) {
    const detail = response.status === 401 || response.status === 403 ? "Check that your API key is valid." : "Try again or verify the Token Factory endpoint.";
    throw new Error(`Could not load Nebius models (HTTP ${response.status}). ${detail}`);
  }
  const payload = await response.json();
  const models = [...new Set((payload.data ?? []).map((model) => typeof model.id === "string" ? model.id.trim() : "").filter(Boolean))];
  if (models.length === 0) throw new Error("Nebius returned an empty model catalog.");
  return models.sort((left, right) => formatModelLabel(left).localeCompare(formatModelLabel(right)));
}
function formatModelLabel(modelId) {
  const [rawOwner, ...modelParts] = modelId.split("/");
  if (modelParts.length === 0) return formatModelName(rawOwner ?? modelId);
  const owner = formatOwner(rawOwner ?? "");
  let modelName = formatModelName(modelParts.join("/"));
  if (owner === "Meta" && modelName.startsWith("Meta ")) modelName = modelName.slice(5);
  return `${modelName} (${owner})`;
}
function formatOwner(owner) {
  const known = {
    openai: "OpenAI",
    "meta-llama": "Meta",
    "deepseek-ai": "DeepSeek",
    qwen: "Qwen",
    moonshotai: "Moonshot AI",
    mistralai: "Mistral AI",
    microsoft: "Microsoft",
    google: "Google",
    nvidia: "NVIDIA"
  };
  return known[owner.toLowerCase()] ?? formatModelName(owner);
}
function formatModelName(value) {
  const acronyms = {
    ai: "AI",
    api: "API",
    coder: "Coder",
    gpt: "GPT",
    oss: "OSS",
    llm: "LLM",
    vl: "VL",
    vla: "VLA",
    r1: "R1",
    v2: "V2",
    v3: "V3",
    moe: "MoE"
  };
  return value.replace(/[_-]+/g, " ").replace(/\//g, " / ").split(/\s+/).filter(Boolean).map((token) => {
    const lower = token.toLowerCase();
    if (acronyms[lower]) return acronyms[lower];
    if (/^\d+(?:\.\d+)?[a-z]$/i.test(token)) return token.toUpperCase();
    if (/^[rv]\d+(?:\.\d+)*$/i.test(token)) return token.toUpperCase();
    return token.charAt(0).toUpperCase() + token.slice(1);
  }).join(" ");
}
function requireApiKey(options) {
  const apiKey = resolveApiKey(options.provider, options.apiKey);
  if (!apiKey) {
    throw new Error(`Missing API key for ${providers[options.provider].label}. Set ${providers[options.provider].envKey} or use --api-key.`);
  }
  return apiKey;
}

// src/llm/prompt.ts
function buildGenerationMessages(request, sourceContext, existingBundleContext = "") {
  return [
    {
      role: "system",
      content: `You are an information architect producing an Open Knowledge Format (OKF) v0.1 bundle plan.

Return ONLY valid JSON. Do not wrap it in markdown fences and do not add commentary.

The JSON shape is:
{
  "title": "Bundle title",
  "description": "One sentence bundle summary",
  "concepts": [
    {
      "path": "group/kebab-case-name.md",
      "type": "A descriptive concept type",
      "title": "Human-readable title",
      "description": "One-sentence summary",
      "resource": "optional canonical URI",
      "tags": ["short-tag"],
      "body": "Markdown body without YAML frontmatter",
      "metadata": { "optional_extension_key": "optional JSON-compatible value" }
    }
  ]
}

Requirements:
- Create between 1 and 100 focused concepts. Prefer a useful hierarchy over a single oversized document.
- Every path is relative, ends in .md, and never uses the reserved filenames index.md or log.md.
- Use structural Markdown in body: headings, lists, tables, and fenced examples when useful.
- Use # Schema, # Examples, and # Citations when applicable.
- Cross-link related concepts with bundle-absolute links such as /group/concept.md.
- Do not invent citations or factual claims. Preserve uncertainty and only cite sources present in the input.
- Do not put YAML frontmatter in body; it is rendered deterministically later.
- When an existing OKF bundle is supplied, return the complete improved replacement plan, not a patch or partial list.
- Preserve accurate existing knowledge, paths, metadata, and cross-links unless the request or newer source material justifies changing them.
- Consolidate duplication, correct stale material, and remove concepts only when they are obsolete or no longer useful.`
    },
    {
      role: "user",
      content: `Generation request:
${request}

Source material:
${sourceContext || "No additional source material was supplied."}

Existing OKF bundle to improve:
${existingBundleContext || "No existing OKF bundle was found. Create a new bundle."}`
    }
  ];
}

// src/core/schema.ts
import { z } from "zod";
var safeConceptPath = z.string().min(1).regex(/^[a-zA-Z0-9][a-zA-Z0-9_./-]*\.md$/, "must be a relative .md path").refine((value) => !value.startsWith("/") && !value.split("/").includes(".."), {
  message: "must remain inside the bundle"
}).refine((value) => !["index.md", "log.md"].includes(value.split("/").at(-1) ?? ""), {
  message: "index.md and log.md are reserved"
});
var conceptSchema = z.object({
  path: safeConceptPath,
  type: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  resource: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  body: z.string().trim().min(1),
  metadata: z.record(z.string(), z.json()).optional()
});
var bundlePlanSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  concepts: z.array(conceptSchema).min(1).max(100)
});

// src/utils/model-output.ts
function parseBundlePlan(content) {
  const text3 = extractText(content).trim();
  const candidates = [text3, stripFence(text3), extractJsonObject(text3)];
  let lastError;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return bundlePlanSchema.parse(JSON.parse(candidate));
    } catch (error) {
      lastError = error;
    }
  }
  const reason = lastError instanceof Error ? lastError.message : "No JSON object found";
  throw new Error(`The model did not return a valid OKF bundle plan: ${reason}`);
}
function extractText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") return part.text;
      return "";
    }).join("");
  }
  throw new Error("The model returned an unsupported content type");
}
function stripFence(value) {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}
function extractJsonObject(value) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  return start >= 0 && end > start ? value.slice(start, end + 1) : "";
}

// src/core/render.ts
import { mkdir, readdir as readdir2, rmdir, unlink, writeFile } from "fs/promises";
import { isDeepStrictEqual } from "util";
import path2 from "path";
import matter2 from "gray-matter";
import { stringify } from "yaml";
async function renderBundle(plan, outputDirectory, options = {}) {
  const root = path2.resolve(outputDirectory);
  const existingBundle = await inspectExistingBundle(root);
  await assertWritableDestination(root, options.force ?? false, Boolean(existingBundle));
  await mkdir(root, { recursive: true });
  const now = options.now ?? /* @__PURE__ */ new Date();
  const files = [];
  for (const concept of plan.concepts) {
    const destination = safeDestination(root, concept.path);
    const existingContent = existingBundle?.conceptContents[concept.path];
    const unchanged = existingContent !== void 0 && changedConceptFields(existingContent, concept).length === 0;
    if (!unchanged) {
      await mkdir(path2.dirname(destination), { recursive: true });
      await writeFile(destination, renderConcept(concept, now), "utf8");
    }
    files.push(concept.path);
  }
  for (const [relativePath, content] of buildIndexes(plan)) {
    const destination = safeDestination(root, relativePath);
    await mkdir(path2.dirname(destination), { recursive: true });
    await writeFile(destination, content, "utf8");
    files.push(relativePath);
  }
  if (existingBundle) {
    await removeStaleGeneratedFiles(root, existingBundle, new Set(files));
  }
  if (options.includeLog !== false) {
    const log2 = renderLog(plan, now, existingBundle);
    await writeFile(path2.join(root, "log.md"), log2, "utf8");
    files.push("log.md");
  }
  return { mode: existingBundle ? "updated" : "created", files: files.sort() };
}
function renderConcept(concept, now = /* @__PURE__ */ new Date()) {
  const metadata = removeReservedMetadata(concept.metadata ?? {});
  const frontmatter = {
    ...metadata,
    type: concept.type,
    title: concept.title,
    description: concept.description,
    ...concept.resource ? { resource: concept.resource } : {},
    ...concept.tags.length > 0 ? { tags: concept.tags } : {},
    timestamp: now.toISOString()
  };
  return `---
${stringify(frontmatter).trimEnd()}
---

${concept.body.trim()}
`;
}
function buildIndexes(plan) {
  const conceptsByDirectory = /* @__PURE__ */ new Map();
  const childDirectories = /* @__PURE__ */ new Map();
  conceptsByDirectory.set("", []);
  for (const concept of plan.concepts) {
    const directory = path2.posix.dirname(concept.path) === "." ? "" : path2.posix.dirname(concept.path);
    const parts = directory ? directory.split("/") : [];
    conceptsByDirectory.set(directory, [...conceptsByDirectory.get(directory) ?? [], concept]);
    let parent = "";
    for (const part of parts) {
      const current = parent ? `${parent}/${part}` : part;
      if (!childDirectories.has(parent)) childDirectories.set(parent, /* @__PURE__ */ new Set());
      childDirectories.get(parent)?.add(current);
      if (!conceptsByDirectory.has(current)) conceptsByDirectory.set(current, []);
      parent = current;
    }
  }
  const indexes = /* @__PURE__ */ new Map();
  for (const directory of conceptsByDirectory.keys()) {
    const sections = [];
    const children = [...childDirectories.get(directory) ?? []].sort();
    if (children.length > 0) {
      sections.push("# Groups\n\n" + children.map((child) => {
        const name = path2.posix.basename(child);
        return `* [${humanize(name)}](${name}/) - Concepts grouped under ${humanize(name)}.`;
      }).join("\n"));
    }
    const concepts = (conceptsByDirectory.get(directory) ?? []).sort((a, b) => a.path.localeCompare(b.path));
    if (concepts.length > 0) {
      sections.push("# Concepts\n\n" + concepts.map((concept) => {
        return `* [${concept.title}](${path2.posix.basename(concept.path)}) - ${concept.description}`;
      }).join("\n"));
    }
    const body = sections.join("\n\n") + "\n";
    if (directory === "") {
      const rootFrontmatter = stringify({ okf_version: "0.1" }).trimEnd();
      indexes.set("index.md", `---
${rootFrontmatter}
---

# ${plan.title}

${plan.description}

${body}`);
    } else {
      indexes.set(`${directory}/index.md`, body);
    }
  }
  return indexes;
}
function removeReservedMetadata(metadata) {
  const result = { ...metadata };
  for (const key of ["type", "title", "description", "resource", "tags", "timestamp"]) delete result[key];
  return result;
}
function safeDestination(root, relativePath) {
  const destination = path2.resolve(root, relativePath);
  if (destination !== root && !destination.startsWith(root + path2.sep)) {
    throw new Error(`Refusing to write outside the bundle: ${relativePath}`);
  }
  return destination;
}
async function assertWritableDestination(root, force, updating) {
  let entries;
  try {
    entries = await readdir2(root);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  if (entries.length > 0 && !force && !updating) {
    throw new Error(`Output directory is not empty and is not an OKF v0.1 bundle: ${root}. Use --force to add or replace generated files.`);
  }
}
function renderLog(plan, now, existingBundle) {
  const date = now.toISOString().slice(0, 10);
  const timestamp = now.toISOString();
  if (!existingBundle) {
    const created = plan.concepts.map((concept) => `* **Creation**: At ${timestamp}, added ${conceptLink(concept.path)}.`).join("\n");
    return `# Directory Update Log

## ${date}
${created}
`;
  }
  const previousPaths = new Set(existingBundle.conceptPaths);
  const nextPaths = new Set(plan.concepts.map((concept) => concept.path));
  const changed = plan.concepts.flatMap((concept) => {
    if (!previousPaths.has(concept.path)) return [];
    const fields = changedConceptFields(existingBundle.conceptContents[concept.path], concept);
    return fields.length > 0 ? [{ path: concept.path, fields }] : [];
  });
  const added = [...nextPaths].filter((conceptPath) => !previousPaths.has(conceptPath));
  const removed = [...previousPaths].filter((conceptPath) => !nextPaths.has(conceptPath));
  const entries = [
    ...changed.map((change) => `* **Update**: At ${timestamp}, changed ${conceptLink(change.path)} (${change.fields.join(", ")}).`),
    ...added.map((conceptPath) => `* **Creation**: At ${timestamp}, added ${conceptLink(conceptPath)}.`),
    ...removed.map((conceptPath) => `* **Deprecation**: At ${timestamp}, removed ${conceptLink(conceptPath)}.`)
  ];
  if (entries.length === 0) entries.push(`* **Update**: At ${timestamp}, no concept content changed.`);
  return prependLogEntries(existingBundle.log, date, entries);
}
function prependLogEntries(existingLog, date, entries) {
  const history = existingLog?.trim() || "# Directory Update Log";
  const heading = `## ${date}`;
  const rootHeading = "# Directory Update Log";
  const body = history.startsWith(rootHeading) ? history.slice(rootHeading.length).trim() : history;
  if (body.startsWith(heading)) {
    return `${rootHeading}

${heading}
${entries.join("\n")}
${body.slice(heading.length).trimStart()}
`;
  }
  return `${rootHeading}

${heading}
${entries.join("\n")}

${body}
`;
}
function conceptLink(conceptPath) {
  return `[${conceptPath}](/${conceptPath.split("/").map(encodeURIComponent).join("/")})`;
}
function changedConceptFields(existingContent, concept) {
  if (!existingContent) return ["content"];
  const existing = matter2(existingContent);
  const fields = [];
  if (existing.data.type !== concept.type) fields.push("type");
  if (existing.data.title !== concept.title) fields.push("title");
  if (existing.data.description !== concept.description) fields.push("description");
  if ((existing.data.resource ?? void 0) !== (concept.resource ?? void 0)) fields.push("resource");
  if (!isDeepStrictEqual(existing.data.tags ?? [], concept.tags)) fields.push("tags");
  if (existing.content.trim() !== concept.body.trim()) fields.push("body");
  const existingMetadata = removeReservedMetadata(existing.data);
  delete existingMetadata.timestamp;
  if (!isDeepStrictEqual(existingMetadata, concept.metadata ?? {})) fields.push("metadata");
  return fields;
}
async function removeStaleGeneratedFiles(root, existingBundle, nextGeneratedFiles) {
  const staleFiles = existingBundle.markdownFiles.filter((relativePath) => {
    return path2.posix.basename(relativePath) !== "log.md" && !nextGeneratedFiles.has(relativePath);
  });
  for (const relativePath of staleFiles) {
    await unlink(safeDestination(root, relativePath));
  }
  const directories = [...new Set(staleFiles.map((relativePath) => path2.posix.dirname(relativePath)))].filter((directory) => directory !== ".").sort((a, b) => b.split("/").length - a.split("/").length);
  for (const directory of directories) {
    try {
      await rmdir(safeDestination(root, directory));
    } catch (error) {
      if (!["ENOENT", "ENOTEMPTY"].includes(error.code)) throw error;
    }
  }
}
function humanize(value) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

// src/llm/sources.ts
import { readFile as readFile2, readdir as readdir3, stat } from "fs/promises";
import path3 from "path";

// src/utils/version.ts
import { createRequire } from "module";
var VERSION = createRequire(import.meta.url)("../../package.json").version;

// src/llm/sources.ts
var supportedExtensions = /* @__PURE__ */ new Set([
  ".md",
  ".mdx",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".csv",
  ".tsv",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".py",
  ".sql",
  ".graphql",
  ".gql"
]);
var ignoredDirectories = /* @__PURE__ */ new Set([".git", "node_modules", "dist", "build", "coverage"]);
async function loadSources(inputs, options = {}) {
  const maxBytes = options.maxBytes ?? 1e6;
  const chunks = [];
  let usedBytes = 0;
  const append = (label, content) => {
    const bytes = Buffer.byteLength(content);
    if (usedBytes + bytes > maxBytes) {
      throw new Error(`Source material exceeds the ${maxBytes.toLocaleString()} byte limit.`);
    }
    chunks.push(`
===== SOURCE: ${label} =====
${content.trim()}
`);
    usedBytes += bytes;
  };
  for (const input of inputs) {
    if (/^https?:\/\//i.test(input)) {
      const content = await fetchSource(input, options.fetchImpl ?? fetch, maxBytes - usedBytes);
      append(input, content);
      continue;
    }
    const absolute = path3.resolve(input);
    const sourceStat = await stat(absolute);
    if (sourceStat.isFile()) {
      if (options.filter?.(absolute) !== false) append(input, await readFile2(absolute, "utf8"));
    } else if (sourceStat.isDirectory()) {
      for (const file of await findSourceFiles(absolute, options.filter)) {
        append(path3.relative(process.cwd(), file), await readFile2(file, "utf8"));
      }
    } else {
      throw new Error(`Unsupported source: ${input}`);
    }
  }
  return chunks.join("").trim();
}
async function fetchSource(url, fetchImpl, remainingBytes) {
  const response = await fetchImpl(url, {
    headers: { "user-agent": `okf/${VERSION}` },
    signal: AbortSignal.timeout(15e3),
    redirect: "follow"
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > remainingBytes) throw new Error(`Source ${url} exceeds the remaining input limit.`);
  const content = await response.text();
  if (Buffer.byteLength(content) > remainingBytes) {
    throw new Error(`Source ${url} exceeds the remaining input limit.`);
  }
  return content;
}
async function findSourceFiles(directory, filter) {
  const entries = await readdir3(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") || ignoredDirectories.has(entry.name)) continue;
    const absolute = path3.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findSourceFiles(absolute, filter));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!supportedExtensions.has(path3.extname(entry.name).toLowerCase())) continue;
    if (filter?.(absolute) === false) continue;
    files.push(absolute);
  }
  return files.sort();
}

// src/core/validate.ts
import { readFile as readFile3, readdir as readdir4 } from "fs/promises";
import path5 from "path";
import matter3 from "gray-matter";

// src/utils/link-target.ts
import path4 from "path";
function resolveMarkdownLinkTarget(from, rawTarget) {
  if (/^(?:[a-z][a-z\d+.-]*:)/i.test(rawTarget)) return { kind: "ignored" };
  let decoded;
  try {
    decoded = decodeURIComponent(rawTarget);
  } catch {
    return { kind: "invalid" };
  }
  const [rawPath = "", fragment] = decoded.split("#", 2);
  if (rawPath.endsWith("/") || rawPath && !rawPath.endsWith(".md")) return { kind: "ignored" };
  const target = !rawPath ? from : rawPath.startsWith("/") ? path4.posix.normalize(rawPath.slice(1)) : path4.posix.normalize(path4.posix.join(path4.posix.dirname(from), rawPath));
  return { kind: "resolved", path: target, fragment, hasMarkdownPath: rawPath.endsWith(".md") };
}

// src/core/validate.ts
async function validateBundle(directory) {
  const root = path5.resolve(directory);
  const files = await findMarkdownFiles2(root);
  const fileSet = new Set(files.map((file) => toPosix2(path5.relative(root, file))));
  const issues = [];
  const anchorsByFile = /* @__PURE__ */ new Map();
  const contentByFile = /* @__PURE__ */ new Map();
  for (const file of files) {
    const relative = toPosix2(path5.relative(root, file));
    const content = await readFile3(file, "utf8");
    contentByFile.set(relative, content);
    anchorsByFile.set(relative, headingAnchors(content));
  }
  for (const file of files) {
    const relative = toPosix2(path5.relative(root, file));
    const name = path5.basename(file);
    const content = contentByFile.get(relative);
    if (name === "index.md") validateIndex(relative, content, issues);
    else if (name === "log.md") validateLog(relative, content, issues);
    else validateConcept(relative, content, issues);
    validateLinks(relative, content, fileSet, anchorsByFile, issues);
  }
  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    filesChecked: files.length,
    issues
  };
}
function validateConcept(file, content, issues) {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    issues.push({ severity: "error", file, message: "Concept must begin with YAML frontmatter." });
    return;
  }
  try {
    const parsed = matter3(content);
    if (typeof parsed.data.type !== "string" || !parsed.data.type.trim()) {
      issues.push({ severity: "error", file, message: "Frontmatter must contain a non-empty type field." });
    }
  } catch (error) {
    issues.push({ severity: "error", file, message: `Frontmatter is not parseable YAML: ${errorMessage(error)}` });
  }
}
function validateIndex(file, content, issues) {
  let body = content;
  if (content.startsWith("---")) {
    if (file !== "index.md") {
      issues.push({ severity: "error", file, message: "Only the bundle-root index.md may contain frontmatter." });
    }
    try {
      const parsed = matter3(content);
      body = parsed.content;
      if (file === "index.md" && parsed.data.okf_version !== void 0 && String(parsed.data.okf_version) !== "0.1") {
        issues.push({ severity: "warning", file, message: `Declared OKF version ${String(parsed.data.okf_version)} is not supported by this validator.` });
      }
    } catch (error) {
      issues.push({ severity: "error", file, message: `Index frontmatter is not parseable YAML: ${errorMessage(error)}` });
      return;
    }
  }
  if (!/^#\s+\S/m.test(body)) {
    issues.push({ severity: "error", file, message: "Index must contain at least one section heading." });
  }
  if (!/^\s*[*-]\s+\[[^\]]+\]\([^)]+\)(?:\s+-\s+.+)?\s*$/m.test(body)) {
    issues.push({ severity: "warning", file, message: "Index has no linked list entries with descriptions." });
  }
}
function validateLog(file, content, issues) {
  if (!/^#\s+\S/m.test(content)) {
    issues.push({ severity: "error", file, message: "Log must begin with a title heading." });
  }
  const dateHeadings = [...content.matchAll(/^##\s+(.+)\s*$/gm)].map((match) => match[1]?.trim() ?? "");
  if (dateHeadings.length === 0) {
    issues.push({ severity: "error", file, message: "Log must contain at least one date heading." });
  }
  for (const date of dateHeadings) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      issues.push({ severity: "error", file, message: `Log date heading must use YYYY-MM-DD: ${date}` });
    }
  }
  const validDates = dateHeadings.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)));
  for (let index = 1; index < validDates.length; index += 1) {
    if (validDates[index] > validDates[index - 1]) {
      issues.push({ severity: "error", file, message: "Log date groups must be ordered newest first." });
      break;
    }
  }
}
function validateLinks(file, content, files, anchorsByFile, issues) {
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget) continue;
    const resolved = resolveMarkdownLinkTarget(file, rawTarget);
    if (resolved.kind === "invalid") {
      issues.push({ severity: "warning", file, message: `Link target is not valid URL encoding: ${rawTarget}` });
      continue;
    }
    if (resolved.kind === "ignored") continue;
    if (resolved.hasMarkdownPath && !files.has(resolved.path)) {
      issues.push({ severity: "warning", file, message: `Broken concept link: ${rawTarget}` });
    } else if (resolved.fragment && !anchorsByFile.get(resolved.path)?.has(slugify(resolved.fragment))) {
      issues.push({ severity: "warning", file, message: `Broken heading anchor: ${rawTarget}` });
    }
  }
}
function headingAnchors(content) {
  const anchors = /* @__PURE__ */ new Set();
  const counts = /* @__PURE__ */ new Map();
  for (const match of content.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slugify(match[1] ?? "");
    const count = counts.get(base) ?? 0;
    anchors.add(count === 0 ? base : `${base}-${count}`);
    counts.set(base, count + 1);
  }
  return anchors;
}
function slugify(value) {
  return value.trim().toLocaleLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s+/g, "-");
}
async function findMarkdownFiles2(directory) {
  const entries = await readdir4(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path5.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findMarkdownFiles2(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files.sort();
}
function toPosix2(value) {
  return value.split(path5.sep).join("/");
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/core/generate.ts
async function generateBundle(options) {
  options.onProgress?.({ stage: "inspect", message: "Checking the output directory" });
  const existingBundle = await inspectExistingBundle(options.outputDirectory);
  options.onProgress?.({ stage: "sources", message: options.sources?.length ? `Reading ${options.sources.length} source${options.sources.length === 1 ? "" : "s"}` : "Preparing generation context" });
  const context = await loadSources(options.sources ?? []);
  const existingLogPath = existingBundle ? path6.join(existingBundle.root, "log.md") : void 0;
  const existingBundleContext = existingBundle ? await loadSources([existingBundle.root], {
    filter: (file) => file !== existingLogPath
  }) : "";
  const messages = buildGenerationMessages(options.request, context, existingBundleContext);
  const model = options.modelInstance ?? createChatModel(options);
  options.onProgress?.({ stage: "model", message: existingBundle ? "Asking the model to improve the bundle" : "Asking the model to design the bundle" });
  const plan = await invokeForPlan(model, messages, options.onProgress);
  options.onProgress?.({ stage: "write", message: `Writing ${plan.concepts.length} concept${plan.concepts.length === 1 ? "" : "s"}` });
  const rendered = await renderBundle(plan, options.outputDirectory, {
    force: options.force,
    includeLog: options.includeLog
  });
  options.onProgress?.({ stage: "validate", message: "Validating OKF v0.1 conformance" });
  const validation = await validateBundle(options.outputDirectory);
  if (!validation.valid) {
    const errors = validation.issues.filter((issue) => issue.severity === "error");
    throw new Error(`Generated bundle failed validation: ${errors.map((issue) => `${issue.file}: ${issue.message}`).join("; ")}`);
  }
  return { mode: rendered.mode, plan, files: rendered.files, validation };
}
async function invokeForPlan(model, messages, onProgress) {
  const response = await model.invoke(messages);
  try {
    return parseBundlePlan(response.content);
  } catch (firstError) {
    onProgress?.({ stage: "repair", message: "Repairing the model response" });
    const repairMessages = [
      ...messages,
      { role: "assistant", content: textContent(response.content).slice(0, 5e4) },
      {
        role: "user",
        content: `Your response was not valid for the required JSON shape. Correct it and return only the complete JSON object. Validation error: ${errorMessage2(firstError)}`
      }
    ];
    const repaired = await model.invoke(repairMessages);
    return parseBundlePlan(repaired.content);
  }
}
function textContent(content) {
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}
function errorMessage2(error) {
  return error instanceof Error ? error.message : String(error);
}

// src/config/config.ts
import { chmod, mkdir as mkdir2, readFile as readFile4, writeFile as writeFile2 } from "fs/promises";
import os from "os";
import path7 from "path";
var OKF_PROVIDER_ENV_KEY = "OKF_PROVIDER";
var OKF_MODEL_ENV_KEY = "OKF_MODEL";
var OKF_BASE_URL_ENV_KEY = "OKF_BASE_URL";
var OKF_RETRY_ATTEMPTS_ENV_KEY = "OKF_RETRY_ATTEMPTS";
var okfEnvDirectory = path7.join(os.homedir(), ".okf");
var okfEnvPath = path7.join(okfEnvDirectory, ".env");
var managedEnvKeys = [
  OKF_PROVIDER_ENV_KEY,
  OKF_MODEL_ENV_KEY,
  OKF_BASE_URL_ENV_KEY,
  OKF_RETRY_ATTEMPTS_ENV_KEY,
  ...providerNames.flatMap((name) => providers[name].envKey ? [providers[name].envKey] : [])
];
var savedEnv = {};
var inheritedKeys = /* @__PURE__ */ new Set();
var inheritedValues = /* @__PURE__ */ new Map();
var sessionKeys = /* @__PURE__ */ new Set();
async function loadOkfEnv(filePath = okfEnvPath, environment = process.env) {
  inheritedKeys.clear();
  inheritedValues.clear();
  savedEnv = await readEnvFile(filePath);
  for (const [key, value] of Object.entries(savedEnv)) {
    if (environment[key] === void 0) environment[key] = value;
    else {
      inheritedKeys.add(key);
      inheritedValues.set(key, environment[key]);
    }
  }
  for (const key of managedEnvKeys) {
    if (environment[key] !== void 0 && savedEnv[key] === void 0) {
      inheritedKeys.add(key);
      inheritedValues.set(key, environment[key]);
    }
  }
  return { ...savedEnv };
}
async function saveOkfEnv(updates, filePath = okfEnvPath, environment = process.env) {
  const current = await readEnvFile(filePath);
  const next = { ...current };
  for (const [key, value] of Object.entries(updates)) {
    if (value.trim()) next[key] = value.trim();
    else delete next[key];
  }
  await mkdir2(path7.dirname(filePath), { recursive: true, mode: 448 });
  await chmod(path7.dirname(filePath), 448);
  await writeFile2(filePath, formatEnv(next), { encoding: "utf8", mode: 384 });
  await chmod(filePath, 384);
  savedEnv = next;
  for (const [key, value] of Object.entries(updates)) {
    const clean = value.trim();
    if (clean && (environment[key] === void 0 || environment[key] === current[key])) environment[key] = clean;
    if (!clean) {
      const inherited = inheritedValues.get(key);
      if (inherited !== void 0) environment[key] = inherited;
      else if (environment[key] === current[key]) delete environment[key];
      sessionKeys.delete(key);
    }
  }
}
function setSessionConfig(key, value, environment = process.env) {
  environment[key] = value.trim();
  sessionKeys.add(key);
}
function resolveConfigValue(key, explicit, environment = process.env) {
  const cleanExplicit = explicit?.trim();
  if (cleanExplicit) return { value: cleanExplicit, source: "flag" };
  const value = environment[key]?.trim();
  if (!value) return { source: "unset", envKey: key };
  if (sessionKeys.has(key)) return { value, source: "session", envKey: key };
  if (inheritedKeys.has(key) && savedEnv[key] !== void 0) return { value, source: "terminal over saved", envKey: key };
  if (inheritedKeys.has(key)) return { value, source: "terminal", envKey: key };
  if (savedEnv[key] !== void 0) return { value, source: "saved", envKey: key };
  return { value, source: "terminal", envKey: key };
}
function resolveProvider(explicit, environment = process.env) {
  if (explicit) return { value: explicit, source: "flag" };
  const configured = resolveConfigValue(OKF_PROVIDER_ENV_KEY, void 0, environment);
  if (configured.value) return configured;
  const detected = providerNames.filter((name) => {
    const key = providers[name].envKey;
    return key && environment[key]?.trim();
  });
  if (detected.length === 1) {
    const provider = detected[0];
    return { value: provider, source: resolveConfigValue(providers[provider].envKey, void 0, environment).source, envKey: providers[provider].envKey };
  }
  return { source: "unset", envKey: OKF_PROVIDER_ENV_KEY };
}
function getCredentialStatus(provider, environment = process.env) {
  const key = providers[provider].envKey;
  return key ? resolveConfigValue(key, void 0, environment) : { source: "default" };
}
function resolveRetryAttempts(environment = process.env) {
  const raw = resolveConfigValue(OKF_RETRY_ATTEMPTS_ENV_KEY, void 0, environment).value;
  if (!raw) return 3;
  const attempts = Number(raw);
  if (!Number.isInteger(attempts) || attempts < 0 || attempts > 10) {
    throw new Error(`${OKF_RETRY_ATTEMPTS_ENV_KEY} must be an integer from 0 to 10.`);
  }
  return attempts;
}
function parseEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) continue;
    const rawValue = line.slice(equals + 1).trim();
    result[key] = parseEnvValue(rawValue);
  }
  return result;
}
function formatEnv(environment) {
  const order = new Map(managedEnvKeys.map((key, index) => [key, index]));
  return Object.entries(environment).sort(([left], [right]) => (order.get(left) ?? 1e4) - (order.get(right) ?? 1e4) || left.localeCompare(right)).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join("\n") + (Object.keys(environment).length ? "\n" : "");
}
async function readEnvFile(filePath) {
  try {
    return parseEnv(await readFile4(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}
function parseEnvValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
  return value;
}

// src/utils/diagnostics.ts
import * as p from "@clack/prompts";
var PromptCancelledError = class extends Error {
  constructor() {
    super("Operation cancelled");
    this.name = "PromptCancelledError";
  }
};
function unwrapPrompt(value) {
  if (p.isCancel(value)) {
    p.cancel("Operation cancelled");
    throw new PromptCancelledError();
  }
  return value;
}
var runtimeSecrets = /* @__PURE__ */ new Map();
function registerDiagnosticSecret(key, value) {
  if (value.trim()) runtimeSecrets.set(key, value.trim());
}
function sanitizeDiagnosticText(input, environment = process.env) {
  let output = input;
  for (const name of providerNames) {
    const key = providers[name].envKey;
    const secret = key ? environment[key]?.trim() : void 0;
    if (secret) output = output.split(secret).join(`[REDACTED:${key}]`);
  }
  for (const [key, secret] of runtimeSecrets) output = output.split(secret).join(`[REDACTED:${key}]`);
  return output.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]").replace(/\bsk-(?:or-v1-)?[A-Za-z0-9_-]+/gi, "[REDACTED:API_KEY]");
}
function friendlyError(error) {
  const raw = sanitizeDiagnosticText(error instanceof Error ? error.message : String(error));
  const status = typeof error === "object" && error !== null ? Number(error.status ?? error.statusCode) : void 0;
  if (status === 401 || status === 403 || /unauthori[sz]ed|invalid api key/i.test(raw)) {
    return "The provider rejected the credential. Check the exported API key or update it with /api-key.";
  }
  if (status === 404) return "The provider could not find that model or endpoint. Check /model and /status.";
  if (status === 429 || /rate.?limit/i.test(raw)) return "The provider rate limit was reached. Wait briefly, then retry or switch models with /model.";
  if (status && status >= 500 || /internal server error|service unavailable/i.test(raw)) {
    return "The provider is temporarily unavailable. Retry the command or switch models with /model.";
  }
  if (/timeout|timed out|abort/i.test(raw)) return "The provider did not respond in time. Check the endpoint and try again.";
  return raw;
}

// src/cli/interactive.ts
import boxen from "boxen";
import pc from "picocolors";
import { mkdir as mkdir3, writeFile as writeFile4 } from "fs/promises";
import { createInterface } from "readline/promises";
import { homedir } from "os";
import path9 from "path";
import { CommanderError } from "commander";
import * as p2 from "@clack/prompts";

// src/config/project-config.ts
import { access, readFile as readFile5, writeFile as writeFile3 } from "fs/promises";
import path8 from "path";
import { parse } from "yaml";
import { z as z2 } from "zod";
var DEFAULT_PROJECT_CONFIG = "okf.config.yml";
var projectConfigSchema = z2.object({
  provider: z2.enum(providerNames).optional(),
  model: z2.string().trim().min(1).optional(),
  sources: z2.array(z2.string().trim().min(1)).default([]),
  output: z2.string().trim().min(1).default("./okf-bundle"),
  baseUrl: z2.url().optional(),
  retries: z2.number().int().min(0).max(10).optional(),
  log: z2.boolean().default(true)
});
async function findProjectConfig(startDirectory = process.cwd()) {
  let directory = path8.resolve(startDirectory);
  while (true) {
    const candidate = path8.join(directory, DEFAULT_PROJECT_CONFIG);
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = path8.dirname(directory);
    if (parent === directory) return void 0;
    directory = parent;
  }
}
async function loadProjectConfig(filePath) {
  const resolvedPath = filePath ? path8.resolve(filePath) : await findProjectConfig();
  if (!resolvedPath) return { config: projectConfigSchema.parse({}) };
  let document;
  try {
    document = parse(await readFile5(resolvedPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Configuration file not found: ${resolvedPath}`);
    throw error;
  }
  const result = projectConfigSchema.safeParse(document ?? {});
  if (!result.success) throw new Error(`Invalid ${path8.basename(resolvedPath)}: ${result.error.issues.map((issue) => `${issue.path.join(".") || "configuration"}: ${issue.message}`).join("; ")}`);
  return { config: result.data, path: resolvedPath };
}
async function createProjectConfig(filePath = DEFAULT_PROJECT_CONFIG, force = false) {
  const resolvedPath = path8.resolve(filePath);
  if (!force) {
    try {
      await access(resolvedPath);
      throw new Error(`${path8.basename(resolvedPath)} already exists. Use --force to replace it.`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  const content = `# okf project configuration
# Nebius is the hosted default. Set NEBIUS_API_KEY in your environment.
provider: nebius
model: zai-org/GLM-5.2

# To use a local model instead, replace the two lines above with:
# provider: ollama
# model: qwen3:8b
# Other supported providers: openrouter, openai, anthropic

# Add files, directories, or URLs that okf should use as source material.
sources:
  - ./docs
output: ./okf-bundle
log: true
`;
  await writeFile3(resolvedPath, content, "utf8");
  return resolvedPath;
}

// src/cli/interactive.ts
var shellActive = false;
var session = {};
var shellCommands = [
  { syntax: "/generate [request]", name: "generate", description: "Create or update an OKF bundle" },
  { syntax: "/update [request]", name: "update", description: "Refresh the last generated bundle" },
  { syntax: "/view [directory]", name: "view", description: "Open the local document explorer" },
  { syntax: "/validate [directory]", name: "validate", description: "Check an existing bundle" },
  { syntax: "/providers", name: "providers", description: "List providers and API-key variables" },
  { syntax: "/provider [name]", name: "provider", description: "Change provider for this session" },
  { syntax: "/model [id]", name: "model", description: "Change model for this session" },
  { syntax: "/api-key", name: "api-key", description: "Enter or replace a credential" },
  { syntax: "/status", name: "status", description: "Show effective config and its sources" },
  { syntax: "/config save|reset", name: "config", description: "Manage saved provider/model defaults" },
  { syntax: "/commands", name: "commands", description: "Show the complete command guide" },
  { syntax: "/exit", name: "exit", description: "Close okf" }
];
var WORDMARK = [
  "   ____  __ __ ______",
  "  / __ \\/ //_// ____/___ ____  ____",
  " / / / / ,<  / /_  / __  / _ \\/ __ \\",
  "/ /_/ / /| |/ __/ / /_/ /  __/ / / /",
  "\\____/_/ |_/_/    \\__, /\\___/_/ /_/",
  "                 /____/"
].join("\n");
function firstRunMarkerPath(environment = process.env) {
  const home = environment.HOME || homedir();
  return path9.join(home, ".okf", "welcome-shown");
}
async function showFirstRunWordmark(markerPath = firstRunMarkerPath()) {
  try {
    await writeFile4(markerPath, "", { flag: "wx" });
  } catch (error) {
    const code = error.code;
    if (code === "ENOENT") {
      await mkdir3(path9.dirname(markerPath), { recursive: true });
      return showFirstRunWordmark(markerPath);
    }
    if (code === "EEXIST") return false;
    return false;
  }
  showWordmark();
  return true;
}
function showWordmark() {
  process.stdout.write(`${pc.cyan(WORDMARK)}

`);
}
function splitCommandLine(input) {
  const tokens = [];
  let token = "";
  let quote;
  let escaped = false;
  for (const character of input.trim()) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = void 0;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) {
        tokens.push(token);
        token = "";
      }
    } else {
      token += character;
    }
  }
  if (escaped) token += "\\";
  if (quote) throw new Error("Unclosed quote");
  if (token) tokens.push(token);
  return tokens;
}
function commandSuggestions(input) {
  if (!input.startsWith("/") || /\s/.test(input)) return [];
  const query = input.slice(1).toLowerCase();
  return shellCommands.filter((command) => command.name.startsWith(query));
}
async function startInteractiveShell(program2, version) {
  shellActive = true;
  await showFirstRunWordmark();
  const project = await loadProjectConfig();
  const startupProvider = resolveProvider();
  const configuredProvider = startupProvider.value ?? project.config.provider ?? "nebius";
  const startupProviderName = providerNames.includes(configuredProvider) ? configuredProvider : "nebius";
  const startupModel = resolveConfigValue(OKF_MODEL_ENV_KEY);
  const configuredModel = startupModel.value ?? project.config.model ?? providers[startupProviderName].defaultModel;
  console.log(boxen([
    `${pc.cyan(">_")}  ${pc.bold("okf")}  ${pc.dim(`v${version}  Open Knowledge Format toolkit`)}`,
    "",
    `${pc.dim("model:")}     ${configuredModel ? pc.bold(configuredModel) : pc.dim("choose during /generate")}  ${pc.cyan("/model to change")}`,
    `${pc.dim("directory:")} ${pc.bold(formatHomePath(process.cwd()))}`
  ].join("\n"), { borderStyle: "round", borderColor: "cyan", padding: { left: 1, right: 1 }, margin: { bottom: 1 } }));
  console.log(`${pc.dim("Built with love by")} ${terminalLink("Ovi Shekh", "https://github.com/ovishkh")}`);
  console.log(`${pc.dim("\u2014")} ${pc.cyan("Ready")} ${pc.dim("\u2014 /generate to start \xB7 /commands for everything")}`);
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const input = (await questionWithCommandHints(terminal, `
${pc.cyan(">")} `)).trim();
      if (!input) continue;
      if (!input.startsWith("/")) {
        console.log(pc.yellow("Use a slash command to get started."));
        console.log(`${pc.dim("Hint:")} ${pc.cyan('/generate "Document our API" --source ./docs')}`);
        continue;
      }
      let args;
      try {
        args = splitCommandLine(input.slice(1));
      } catch (error) {
        console.log(pc.red(error instanceof Error ? error.message : String(error)));
        continue;
      }
      const [command, ...rest] = args;
      if (!command) continue;
      if (command === "exit" || command === "quit") break;
      if (command === "help" || command === "commands") {
        printCommandHelp();
        continue;
      }
      try {
        if (command === "status" || command === "config") {
          if (rest[0] === "save") await savePreferences();
          else if (rest[0] === "reset") await resetPreferences();
          else printStatus();
          continue;
        }
        if (command === "provider") {
          await changeProvider(rest[0]);
          continue;
        }
        if (command === "model") {
          await changeModel(rest.join(" "));
          continue;
        }
        if (command === "api-key") {
          await changeApiKey();
          continue;
        }
      } catch (error) {
        if (!(error instanceof PromptCancelledError)) {
          console.log(`${pc.red("Could not update configuration:")} ${friendlyError(error)}`);
        }
        continue;
      }
      if (!["generate", "update", "view", "validate", "providers"].includes(command)) {
        console.log(pc.yellow(`Unknown command /${command}.`));
        console.log(`${pc.dim("Hint:")} Type ${pc.cyan("/commands")} to see the available commands.`);
        continue;
      }
      try {
        const invocation = shellInvocation(command, rest);
        await program2.parseAsync(["node", "okf", ...invocation]);
        const hint = commandHint(invocation[0] ?? command);
        if (hint) console.log(`
${pc.dim("Next:")} ${hint}`);
      } catch (error) {
        if (error instanceof PromptCancelledError) continue;
        if (error instanceof CommanderError) {
          if (error.exitCode !== 0) console.log(`${pc.dim("Hint:")} Run ${pc.cyan("/commands")} for syntax and examples.`);
          continue;
        }
        console.log(`${pc.red("Could not run command:")} ${friendlyError(error)}`);
        console.log(`${pc.dim("Hint:")} Run ${pc.cyan(`/commands`)} for syntax and examples.`);
      }
    }
  } finally {
    shellActive = false;
    terminal.close();
  }
  console.log(pc.dim("Goodbye."));
}
function terminalLink(label, url) {
  return `\x1B]8;;${url}\x07${pc.cyan(label)}\x1B]8;;\x07`;
}
function isInteractiveShellActive() {
  return shellActive;
}
function rememberGeneration(output, sources) {
  session.output = output;
  session.sources = [...sources];
}
function commandHelpText() {
  return [
    `${pc.bold("Commands")}`,
    ...shellCommands.map((command) => `  ${pc.cyan(command.syntax.padEnd(28))}${command.description}`),
    "",
    `${pc.bold("Examples")}`,
    `  ${pc.dim('/generate "Document our payments API" --source ./docs')}`,
    `  ${pc.dim('/generate "Refresh this bundle" --output ./knowledge')}`,
    `  ${pc.dim("/validate ./knowledge")}`,
    `  ${pc.dim("/view ./knowledge --port 4400")}`,
    "",
    `${pc.dim("Tip: quote requests or paths that contain spaces.")}`
  ].join("\n");
}
async function questionWithCommandHints(terminal, prompt) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return terminal.question(prompt);
  let active = true;
  let renderPending = false;
  const render = () => {
    renderPending = false;
    if (!active) return;
    const suggestions = commandSuggestions(terminal.line);
    process.stdout.write("\x1B7\n\x1B[0J");
    if (suggestions.length > 0) {
      process.stdout.write(suggestions.map(
        (command) => `  ${pc.cyan(command.syntax.padEnd(28))}${pc.dim(command.description)}`
      ).join("\n"));
    }
    process.stdout.write("\x1B8");
  };
  const onKeypress = () => {
    if (renderPending) return;
    renderPending = true;
    setImmediate(render);
  };
  process.stdin.on("keypress", onKeypress);
  try {
    return await terminal.question(prompt);
  } finally {
    active = false;
    process.stdin.off("keypress", onKeypress);
    process.stdout.write("\x1B7\n\x1B[0J\x1B8");
  }
}
function shellInvocation(command, rest) {
  if ((command === "view" || command === "validate") && rest.length === 0 && session.output) return [command, session.output];
  if (command === "update") {
    if (!session.output) throw new Error("There is no previous bundle in this session. Run /generate first.");
    const request = rest.length ? rest : ["Refresh this bundle from the latest source material"];
    return ["generate", ...request, "--output", session.output, ...session.sources?.length ? ["--source", ...session.sources] : []];
  }
  return [command, ...rest];
}
function printStatus() {
  const providerResult = resolveProvider();
  const provider = providerResult.value && providerNames.includes(providerResult.value) ? providerResult.value : void 0;
  const model = resolveConfigValue(OKF_MODEL_ENV_KEY);
  const credential = provider ? getCredentialStatus(provider) : void 0;
  console.log(boxen([
    `${pc.bold("Provider")}    ${provider ? providers[provider].label : pc.dim("not selected")}  ${sourceLabel(providerResult.source, providerResult.envKey)}`,
    `${pc.bold("Model")}       ${model.value ?? pc.dim("provider default")}  ${sourceLabel(model.source, model.envKey)}`,
    `${pc.bold("Credential")}  ${provider && providers[provider].requiresKey ? credential?.value ? pc.green("detected") : pc.yellow("missing") : pc.dim("not required")}  ${credential ? sourceLabel(credential.source, credential.envKey) : ""}`,
    `${pc.bold("Output")}      ${session.output ?? pc.dim("not generated in this session")}`
  ].join("\n"), { title: "Effective configuration", borderStyle: "round", borderColor: "gray", padding: { left: 1, right: 1 } }));
}
async function changeProvider(input) {
  const previousProvider = resolveProvider().value;
  const selected = input || unwrapPrompt(await p2.select({
    message: "Provider for this session",
    options: providerNames.map((name) => ({ value: name, label: providers[name].label, hint: getCredentialStatus(name).value ? "credential detected" : providers[name].hint }))
  }));
  if (!providerNames.includes(selected)) throw new Error(`Unsupported provider: ${selected}`);
  setSessionConfig(OKF_PROVIDER_ENV_KEY, selected);
  if (previousProvider && previousProvider !== selected) setSessionConfig(OKF_MODEL_ENV_KEY, "");
  console.log(`${pc.green("Selected")} ${providers[selected].label}. Use ${pc.cyan("/model")} to choose its model.`);
}
async function changeModel(input) {
  const model = input?.trim() || unwrapPrompt(await p2.text({ message: "Model ID", validate: (value) => String(value ?? "").trim() ? void 0 : "A model ID is required" }));
  setSessionConfig(OKF_MODEL_ENV_KEY, model);
  console.log(`${pc.green("Selected model")} ${model}`);
}
async function changeApiKey() {
  let result = resolveProvider();
  if (!result.value || !providerNames.includes(result.value)) {
    await changeProvider();
    result = resolveProvider();
  }
  const provider = result.value;
  const key = providers[provider].envKey;
  if (!key) {
    console.log(`${providers[provider].label} does not require an API key.`);
    return;
  }
  const value = unwrapPrompt(await p2.password({ message: `${providers[provider].label} API key`, mask: "*", validate: (input) => String(input ?? "").trim() ? void 0 : "An API key is required" }));
  registerDiagnosticSecret(key, value);
  setSessionConfig(key, value);
  const persist = unwrapPrompt(await p2.confirm({ message: `Save it to ~/.okf/.env for future sessions?`, initialValue: false }));
  if (persist) await saveOkfEnv({ [key]: value });
  console.log(persist ? pc.green(`Saved ${key} with private file permissions.`) : pc.green(`${key} is available for this session only.`));
}
async function savePreferences() {
  const provider = resolveProvider().value;
  const model = resolveConfigValue(OKF_MODEL_ENV_KEY).value;
  const updates = {};
  if (provider) updates[OKF_PROVIDER_ENV_KEY] = provider;
  if (model) updates[OKF_MODEL_ENV_KEY] = model;
  if (Object.keys(updates).length === 0) throw new Error("Choose a provider or model before saving preferences.");
  await saveOkfEnv(updates);
  console.log(pc.green("Saved provider and model preferences to ~/.okf/.env."));
}
async function resetPreferences() {
  await saveOkfEnv({ [OKF_PROVIDER_ENV_KEY]: "", [OKF_MODEL_ENV_KEY]: "" });
  console.log(pc.green("Cleared saved provider and model preferences."));
}
function sourceLabel(source, envKey) {
  if (source === "unset" || source === "default") return pc.dim(`(${source})`);
  return pc.dim(`(${source}${envKey ? `: ${envKey}` : ""})`);
}
function printCommandHelp() {
  console.log(`
${commandHelpText()}`);
}
function commandHint(command) {
  if (command === "providers") return `Run ${pc.cyan("/generate")} and choose one of these providers.`;
  if (command === "validate") return `Run ${pc.cyan("/view [directory]")} to explore a valid bundle.`;
  return void 0;
}
function formatHomePath(directory) {
  const home = homedir();
  return directory === home ? "~" : directory.startsWith(`${home}${path9.sep}`) ? `~${directory.slice(home.length)}` : directory;
}

// src/core/lint.ts
import { readFile as readFile6, readdir as readdir5 } from "fs/promises";
import path10 from "path";
import matter4 from "gray-matter";
async function lintBundle(directory, options = {}) {
  const root = path10.resolve(directory);
  const validation = await validateBundle(root);
  const issues = validation.issues.map((issue) => ({ ...issue, rule: "okf-conformance" }));
  const files = await findConceptFiles(root);
  const documents = await Promise.all(files.map((file) => readConcept(root, file)));
  const conceptSet = new Set(documents.map((document) => document.file));
  reportDuplicateTitles(documents, issues);
  reportOrphans(documents, conceptSet, issues);
  for (const document of documents) {
    reportThinContent(document, issues);
    reportHeadingHierarchy(document, issues);
  }
  return {
    valid: !issues.some((issue) => issue.severity === "error" || options.strict && issue.severity === "warning"),
    filesChecked: validation.filesChecked,
    issues
  };
}
function reportDuplicateTitles(documents, issues) {
  const titles = /* @__PURE__ */ new Map();
  for (const document of documents) {
    if (!document.title) continue;
    const normalized = document.title.trim().toLocaleLowerCase();
    titles.set(normalized, [...titles.get(normalized) ?? [], document.file]);
  }
  for (const duplicates of titles.values()) {
    if (duplicates.length < 2) continue;
    for (const file of duplicates) issues.push({ severity: "warning", file, rule: "unique-title", message: `Duplicate concept title also used by: ${duplicates.filter((item) => item !== file).join(", ")}` });
  }
}
function reportOrphans(documents, concepts, issues) {
  if (documents.length < 2) return;
  const connected = /* @__PURE__ */ new Set();
  for (const document of documents) {
    for (const target of document.links) {
      const resolved = resolveLink(document.file, target);
      if (resolved && concepts.has(resolved)) {
        connected.add(document.file);
        connected.add(resolved);
      }
    }
  }
  for (const document of documents) {
    if (!connected.has(document.file)) issues.push({ severity: "warning", file: document.file, rule: "no-orphan-concepts", message: "Concept has no links to or from another concept." });
  }
}
function reportThinContent(document, issues) {
  const words = document.body.replace(/[`*_#>\[\](){}|-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  if (words < 40) issues.push({ severity: "warning", file: document.file, rule: "substantive-content", message: `Concept body is unusually thin (${words} words; recommended minimum is 40).` });
}
function reportHeadingHierarchy(document, issues) {
  const levels = [...document.body.matchAll(/^(#{1,6})\s+\S/gm)].map((match) => match[1].length);
  for (let index = 1; index < levels.length; index += 1) {
    if (levels[index] > levels[index - 1] + 1) {
      issues.push({ severity: "warning", file: document.file, rule: "heading-order", message: `Heading level jumps from H${levels[index - 1]} to H${levels[index]}.` });
      return;
    }
  }
}
async function readConcept(root, absolute) {
  const file = toPosix3(path10.relative(root, absolute));
  const content = await readFile6(absolute, "utf8");
  try {
    const parsed = matter4(content);
    return {
      file,
      title: typeof parsed.data.title === "string" ? parsed.data.title : void 0,
      body: parsed.content,
      links: [...parsed.content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1].trim())
    };
  } catch {
    return { file, body: content, links: [] };
  }
}
function resolveLink(from, rawTarget) {
  const target = resolveMarkdownLinkTarget(from, rawTarget);
  return target.kind === "resolved" && target.hasMarkdownPath ? target.path : void 0;
}
async function findConceptFiles(directory) {
  const entries = await readdir5(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path10.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findConceptFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md") && !["index.md", "log.md"].includes(entry.name)) files.push(absolute);
  }
  return files.sort();
}
function toPosix3(value) {
  return value.split(path10.sep).join("/");
}

// src/viewer/viewer.ts
import { createServer } from "http";
import { readFile as readFile7, readdir as readdir6 } from "fs/promises";
import { createRequire as createRequire2 } from "module";
import path11 from "path";
import matter5 from "gray-matter";
import { marked } from "marked";
import open from "open";
import sanitizeHtml from "sanitize-html";
var require2 = createRequire2(import.meta.url);
async function buildViewerData(directory) {
  const root = path11.resolve(directory);
  const files = await findMarkdownFiles3(root);
  const conceptFiles = files.filter((file) => !["index.md", "log.md"].includes(path11.basename(file)));
  if (conceptFiles.length === 0) throw new Error(`No OKF concept documents found in ${root}`);
  const records = await Promise.all(conceptFiles.map(async (file) => {
    const id = toPosix4(path11.relative(root, file));
    const raw = await readFile7(file, "utf8");
    const parsed = matter5(raw);
    const title = stringValue(parsed.data.title) || humanize2(path11.basename(id, ".md"));
    return {
      concept: {
        id,
        title,
        description: stringValue(parsed.data.description),
        type: stringValue(parsed.data.type) || "Concept",
        tags: Array.isArray(parsed.data.tags) ? parsed.data.tags.map(String) : [],
        ...stringValue(parsed.data.resource) ? { resource: stringValue(parsed.data.resource) } : {},
        ...stringValue(parsed.data.timestamp) ? { updatedAt: stringValue(parsed.data.timestamp) } : {},
        html: sanitizeHtml(await marked.parse(parsed.content), {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "h4", "h5", "h6"]),
          allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, a: ["href", "title"], img: ["src", "alt", "title"] },
          allowedSchemes: ["http", "https", "mailto"]
        })
      },
      raw
    };
  }));
  const ids = new Set(records.map(({ concept }) => concept.id));
  const edgeKeys = /* @__PURE__ */ new Set();
  const edges = [];
  for (const { concept, raw } of records) {
    for (const match of raw.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const href = match[1]?.trim().split(/[?#]/)[0] ?? "";
      if (!href || /^(?:[a-z][a-z\d+.-]*:|#)/i.test(href)) continue;
      const target = href.startsWith("/") ? path11.posix.normalize(href.slice(1)) : path11.posix.normalize(path11.posix.join(path11.posix.dirname(concept.id), href));
      if (!ids.has(target) || target === concept.id) continue;
      const key = `${concept.id}\0${target}`;
      if (!edgeKeys.has(key)) {
        edgeKeys.add(key);
        edges.push({ source: concept.id, target });
      }
    }
  }
  return {
    title: await readBundleTitle(root),
    directory: root,
    concepts: records.map(({ concept }) => concept).sort((a, b) => a.title.localeCompare(b.title)),
    edges
  };
}
async function startViewer(options) {
  const data = await buildViewerData(options.directory);
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 4173;
  const cytoscapePath = require2.resolve("cytoscape/dist/cytoscape.min.js");
  const cytoscapeSource = await readFile7(cytoscapePath, "utf8");
  const dataJson = JSON.stringify(data).replace(/</g, "\\u003c");
  const server = createServer((request, response) => {
    const url2 = request.url?.split("?")[0] ?? "/";
    if (url2 === "/assets/cytoscape.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=86400" });
      response.end(cytoscapeSource);
      return;
    }
    if (url2 === "/" || url2 === "/index.html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(viewerHtml(dataJson));
      return;
    }
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : requestedPort;
  const url = `http://${host}:${port}`;
  if (options.openBrowser !== false) await open(url);
  return { url, server };
}
async function findMarkdownFiles3(directory) {
  const entries = await readdir6(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path11.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findMarkdownFiles3(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(absolute);
  }
  return files.sort();
}
async function readBundleTitle(root) {
  try {
    const content = await readFile7(path11.join(root, "index.md"), "utf8");
    const heading = matter5(content).content.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return heading || humanize2(path11.basename(root));
  } catch {
    return humanize2(path11.basename(root));
  }
}
function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}
function humanize2(value) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
function toPosix4(value) {
  return value.split(path11.sep).join("/");
}
function viewerHtml(dataJson) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>okf Explorer</title>
  <script>try{document.documentElement.dataset.theme=localStorage.getItem('okf-theme')||'light'}catch(e){document.documentElement.dataset.theme='light'}</script>
  <style>
    :root{color-scheme:light;--canvas:#f7f7f8;--surface:#fff;--surface-2:#f4f4f5;--surface-3:#eeeef0;--ink:#1b1b1f;--muted:#707078;--subtle:#96969f;--line:#e3e3e7;--line-strong:#cfcfd5;--accent:#5e6ad2;--accent-hover:#4f5bc4;--accent-soft:#f0f1fb;--code:#f2f2f4;--graph-edge:#a7a7b0;--graph-grid:rgba(94,106,210,.07);--graph-glow:rgba(94,106,210,.14);--shadow:0 8px 24px rgba(18,18,22,.08);--shadow-float:0 18px 50px rgba(18,18,22,.12);--nav:284px;--duration-stagger:40ms;--duration-micro:80ms;--duration-quick:150ms;--duration-fast:250ms;--duration-medium:350ms;--duration-slow:400ms;--duration-very-slow:500ms;--ease-smooth-out:cubic-bezier(.22,1,.36,1);--ease-in-out:ease-in-out;--ease-out:ease-out;--ease-linear:linear;--ease-bounce:cubic-bezier(.34,1.36,.64,1);--distance-micro:4px;--distance-base:8px;--distance-medium:12px;--scale-large:.96;--scale-medium:.97;--scale-small:.98;--blur-small:2px;--blur-medium:3px}
    html[data-theme="dark"]{color-scheme:dark;--canvas:#0b0b0d;--surface:#111113;--surface-2:#171719;--surface-3:#1d1d20;--ink:#f3f3f5;--muted:#aaaab2;--subtle:#777780;--line:#27272b;--line-strong:#38383e;--accent:#828fff;--accent-hover:#9aa4ff;--accent-soft:#202136;--code:#1b1b1e;--graph-edge:#5c5c65;--graph-grid:rgba(130,143,255,.065);--graph-glow:rgba(94,106,210,.18);--shadow:0 8px 28px rgba(0,0,0,.3);--shadow-float:0 22px 60px rgba(0,0,0,.42)}
    *{box-sizing:border-box}html,body{height:100%;margin:0}body{font-family:Inter,"SF Pro Text",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--canvas);color:var(--ink);letter-spacing:0;transition:background-color var(--duration-quick) var(--ease-in-out),color var(--duration-quick) var(--ease-in-out)}button,input{font:inherit}button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
    .app{display:grid;grid-template-columns:var(--nav) minmax(0,1fr);height:100vh;min-height:0;overflow:hidden}.sidebar{background:var(--surface);color:var(--ink);border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}.brand{height:68px;flex:0 0 68px;padding:0 18px;display:flex;align-items:center;border-bottom:1px solid var(--line)}.brand h1{font-size:14px;font-weight:700;margin:0;line-height:1.25;letter-spacing:.02em}.search-wrap{flex:0 0 auto;padding:14px 12px 9px}.search{width:100%;height:36px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink);border-radius:8px;padding:0 11px;outline:none;font-size:13px}.search:focus{border-color:var(--accent);background:var(--surface);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)}.search::placeholder{color:var(--subtle)}.concept-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:2px 7px 18px}.concept-btn{width:100%;text-align:left;color:var(--ink);background:transparent;border:0;border-radius:7px;padding:9px 10px;cursor:pointer;display:block}.concept-btn:hover{background:var(--surface-2)}.concept-btn.active{background:var(--accent-soft);color:var(--accent)}.concept-title{font-size:13px;font-weight:600;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.concept-meta{font-size:11px;color:var(--subtle);margin-top:3px;display:block}.concept-btn.active .concept-meta{color:var(--accent)}.sidebar-foot{flex:0 0 auto;border-top:1px solid var(--line);padding:12px 17px;color:var(--subtle);font-size:10px;line-height:1.45}.sidebar-foot #directory{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sidebar-foot a{color:var(--muted);text-decoration:none}.sidebar-foot a:hover{color:var(--accent)}
    .main{display:grid;grid-template-rows:60px minmax(0,1fr);min-width:0;min-height:0;height:100%;overflow:hidden}.toolbar{background:color-mix(in srgb,var(--surface) 94%,transparent);border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 18px;gap:16px}.tabs{position:relative;display:grid;grid-template-columns:1fr 1fr;width:150px;background:var(--surface-2);padding:3px;border:1px solid var(--line);border-radius:9px}.tabs::before{content:"";position:absolute;z-index:0;top:3px;bottom:3px;left:3px;width:calc(50% - 3px);border-radius:6px;background:var(--surface);box-shadow:0 1px 3px rgba(18,18,22,.08);transform:translateX(0);transition:transform var(--duration-fast) var(--ease-smooth-out)}.tabs[data-active="graph"]::before{transform:translateX(100%)}.tab{position:relative;z-index:1;border:0;background:transparent;color:var(--muted);height:30px;padding:0 9px;border-radius:6px;cursor:pointer;font-weight:500;font-size:12px;transition:color var(--duration-quick) var(--ease-in-out)}.tab:hover{color:var(--ink)}.tab.active{color:var(--ink)}.toolbar-meta{display:flex;align-items:center;gap:12px}.stats{font-size:11px;color:var(--subtle)}.theme-toggle,.mobile-menu{width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:8px;cursor:pointer;transition:color var(--duration-quick) var(--ease-in-out),background-color var(--duration-quick) var(--ease-in-out),border-color var(--duration-quick) var(--ease-in-out)}.theme-toggle:hover,.mobile-menu:hover{color:var(--ink);border-color:var(--line-strong);background:var(--surface-2)}.theme-toggle{position:relative;overflow:hidden}.theme-icon{position:absolute;display:grid;place-items:center;transition:opacity var(--duration-fast) var(--ease-in-out),transform var(--duration-fast) var(--ease-in-out),filter var(--duration-fast) var(--ease-in-out)}.theme-icon-sun{opacity:0;transform:scale(.8) rotate(-18deg);filter:blur(var(--blur-small))}.theme-icon-moon{opacity:1;transform:scale(1) rotate(0);filter:blur(0)}html[data-theme="dark"] .theme-icon-sun{opacity:1;transform:scale(1) rotate(0);filter:blur(0)}html[data-theme="dark"] .theme-icon-moon{opacity:0;transform:scale(.8) rotate(18deg);filter:blur(var(--blur-small))}.mobile-menu{display:none;font-size:16px}
    .content{min-height:0;position:relative;overflow:hidden}.view{position:absolute;inset:0;height:100%;min-height:0;opacity:0;visibility:hidden;pointer-events:none;transform:translateY(var(--distance-base));filter:blur(var(--blur-small));transition:opacity var(--duration-fast) var(--ease-in-out),transform var(--duration-fast) var(--ease-smooth-out),filter var(--duration-fast) var(--ease-in-out),visibility 0s linear var(--duration-fast)}.view.active{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0);filter:blur(0);transition-delay:0s}.document-view{overflow-y:auto;overscroll-behavior:contain;background:var(--canvas)}.document-shell{max-width:880px;margin:0 auto;padding:54px 56px 88px}.document-view.is-revealing .document-header,.document-view.is-revealing .markdown,.document-view.is-revealing .outline{animation:content-reveal var(--duration-very-slow) var(--ease-smooth-out) both}.document-view.is-revealing .markdown{animation-delay:var(--duration-stagger)}.document-view.is-revealing .outline{animation-delay:calc(var(--duration-stagger) * 2)}@keyframes content-reveal{from{opacity:0;transform:translateY(var(--distance-medium));filter:blur(var(--blur-medium))}to{opacity:1;transform:translateY(0);filter:blur(0)}}.eyebrow{color:var(--accent);font-family:"SFMono-Regular",Consolas,monospace;font-size:11px;font-weight:500;text-transform:uppercase;margin-bottom:14px}.document-title{font-size:36px;font-weight:600;line-height:1.16;margin:0 0 12px}.document-description{font-size:16px;color:var(--muted);line-height:1.55;margin:0 0 20px;max-width:720px}.tags{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 32px}.tag{font-size:10px;padding:4px 7px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--muted)}.resource{display:inline-block;color:var(--accent);font-size:12px;margin-bottom:24px;text-decoration:none}.resource:hover{text-decoration:underline}.markdown{border-top:1px solid var(--line);padding-top:30px;font-size:15px;line-height:1.72;color:var(--ink)}.markdown h1,.markdown h2,.markdown h3{line-height:1.25;margin:1.9em 0 .7em;font-weight:600}.markdown h1{font-size:24px}.markdown h2{font-size:19px}.markdown h3{font-size:16px}.markdown a{color:var(--accent);text-decoration-color:color-mix(in srgb,var(--accent) 40%,transparent);text-underline-offset:3px}.markdown code{font-family:"SFMono-Regular",Consolas,monospace;font-size:.86em;background:var(--code);padding:2px 5px;border:1px solid var(--line);border-radius:4px}.markdown pre{overflow:auto;background:var(--surface-2);color:var(--ink);padding:16px;border:1px solid var(--line);border-radius:8px}.markdown pre code{background:transparent;padding:0;border:0}.markdown table{width:100%;border-collapse:collapse;font-size:13px}.markdown th,.markdown td{border-bottom:1px solid var(--line);padding:10px 9px;text-align:left}.markdown th{background:var(--surface-2);font-weight:600}.markdown blockquote{border-left:2px solid var(--accent);margin-left:0;padding-left:16px;color:var(--muted)}
    .document-shell{display:grid;grid-template-columns:minmax(0,1fr) 190px;column-gap:54px;max-width:1120px}.document-header{grid-column:1/-1;padding-bottom:30px}.document-title{font-size:38px;line-height:1.12;letter-spacing:-.8px}.document-updated{display:block;color:var(--subtle);font-size:12px;margin-bottom:20px}.tags{margin-bottom:18px}.resource{margin-bottom:0}.markdown h1,.markdown h2,.markdown h3{scroll-margin-top:24px}.markdown pre{padding:18px;box-shadow:inset 0 1px 0 color-mix(in srgb,var(--ink) 4%,transparent)}.outline{border-left:1px solid var(--line);padding-left:18px;align-self:start;position:sticky;top:24px;max-height:calc(100vh - 110px);overflow:auto}.outline-title{font-size:11px;font-weight:600;color:var(--ink);margin:0 0 12px}.outline-list{display:flex;flex-direction:column;gap:9px}.outline-link{border:0;background:transparent;color:var(--subtle);font-size:11px;text-align:left;padding:0;cursor:pointer;line-height:1.35}.outline-link:hover,.outline-link.active{color:var(--accent)}.outline-link[data-level="3"]{padding-left:10px}
    .graph-view{position:absolute;background:var(--canvas);isolation:isolate;overflow:hidden}.graph-view::before{content:"";position:absolute;z-index:-2;inset:0;background-image:linear-gradient(var(--graph-grid) 1px,transparent 1px),linear-gradient(90deg,var(--graph-grid) 1px,transparent 1px);background-size:32px 32px;mask-image:linear-gradient(to bottom,rgba(0,0,0,.64),transparent 88%)}.graph-view::after{content:"";position:absolute;z-index:-1;width:680px;height:680px;left:50%;top:48%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,var(--graph-glow),transparent 66%);pointer-events:none}.graph-heading{position:absolute;z-index:3;left:22px;top:20px;max-width:300px;pointer-events:none}.graph-kicker{display:flex;align-items:center;gap:7px;margin:0 0 7px;color:var(--accent);font-size:10px;font-weight:700;letter-spacing:.11em;text-transform:uppercase}.graph-kicker::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 12%,transparent)}.graph-heading h2{font-size:20px;line-height:1.2;letter-spacing:-.35px;margin:0 0 5px}.graph-heading p{font-size:11px;line-height:1.5;color:var(--subtle);margin:0}.graph-toolbar{position:absolute;z-index:4;right:18px;top:18px;display:flex;gap:7px}.graph-btn{display:flex;align-items:center;gap:6px;border:1px solid var(--line);background:color-mix(in srgb,var(--surface) 92%,transparent);backdrop-filter:blur(12px);color:var(--muted);height:34px;padding:0 11px;border-radius:9px;cursor:pointer;box-shadow:var(--shadow);font-size:11px;font-weight:600;transition:color var(--duration-quick) var(--ease-in-out),background-color var(--duration-quick) var(--ease-in-out),border-color var(--duration-quick) var(--ease-in-out),transform var(--duration-fast) var(--ease-smooth-out)}.graph-btn svg{width:13px;height:13px;stroke:currentColor}.graph-btn:hover{color:var(--ink);border-color:var(--line-strong);background:var(--surface);transform:translateY(-1px)}.graph-btn:active{transform:translateY(0) scale(var(--scale-small))}.graph-btn.is-running svg{animation:graph-spin var(--duration-very-slow) var(--ease-smooth-out)}@keyframes graph-spin{to{transform:rotate(180deg)}}.graph-legend{position:absolute;z-index:3;left:22px;bottom:18px;display:flex;align-items:center;gap:11px;background:color-mix(in srgb,var(--surface) 90%,transparent);backdrop-filter:blur(12px);border:1px solid var(--line);border-radius:9px;padding:9px 11px;font-size:10px;color:var(--subtle);box-shadow:var(--shadow)}.graph-legend span{display:flex;align-items:center;gap:6px}.graph-legend span+span::before{content:"";width:1px;height:12px;background:var(--line);margin-right:5px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--accent)}.edge-mark{display:inline-block;width:18px;height:1px;background:var(--graph-edge);position:relative}.edge-mark::after{content:"";position:absolute;right:-1px;top:-2px;border-left:4px solid var(--graph-edge);border-top:2.5px solid transparent;border-bottom:2.5px solid transparent}.graph-inspector{position:absolute;z-index:5;right:18px;bottom:18px;width:min(310px,calc(100% - 36px));background:color-mix(in srgb,var(--surface) 94%,transparent);backdrop-filter:blur(18px);border:1px solid var(--line);border-radius:14px;padding:18px;box-shadow:var(--shadow-float);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(var(--distance-medium)) scale(var(--scale-large));filter:blur(var(--blur-small));transform-origin:bottom right;transition:opacity var(--duration-fast) var(--ease-in-out),transform var(--duration-fast) var(--ease-smooth-out),filter var(--duration-fast) var(--ease-in-out),visibility 0s linear var(--duration-fast)}.graph-inspector[data-open="true"]{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1);filter:blur(0);transition-delay:0s}.graph-inspector-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.graph-type{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--accent);background:var(--accent-soft);border-radius:999px;padding:5px 8px}.graph-close{display:grid;place-items:center;width:26px;height:26px;border:0;border-radius:7px;background:transparent;color:var(--subtle);cursor:pointer;font-size:17px;line-height:1;transition:color var(--duration-quick) var(--ease-in-out),background-color var(--duration-quick) var(--ease-in-out),transform var(--duration-fast) var(--ease-smooth-out)}.graph-close:hover{color:var(--ink);background:var(--surface-2);transform:rotate(4deg)}.graph-inspector h3{font-size:17px;letter-spacing:-.25px;margin:0 0 7px}.graph-inspector p{font-size:12px;line-height:1.55;color:var(--muted);margin:0 0 15px}.graph-inspector-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:13px;gap:12px}.graph-degree{font-size:10px;color:var(--subtle)}.graph-open{border:0;border-radius:8px;background:var(--ink);color:var(--surface);height:31px;padding:0 11px;font-size:10px;font-weight:700;cursor:pointer;transition:transform var(--duration-fast) var(--ease-smooth-out),opacity var(--duration-quick) var(--ease-in-out)}.graph-open:hover{transform:translateY(-1px)}.graph-open:active{transform:scale(var(--scale-small))}#graph{position:absolute;inset:0;width:100%;height:100%;cursor:grab}#graph:active{cursor:grabbing}.empty{padding:28px 10px;color:var(--subtle);font-size:12px}
    .sidebar,.toolbar,.document-view,.graph-view,.search,.concept-btn,.tag,.graph-btn,.graph-legend,.markdown pre,.markdown code{transition:background-color var(--duration-quick) var(--ease-in-out),border-color var(--duration-quick) var(--ease-in-out),color var(--duration-quick) var(--ease-in-out)}
    .search-row{position:relative}.search-clear{position:absolute;right:6px;top:4px;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:var(--subtle);cursor:pointer;opacity:0;pointer-events:none;transition:opacity var(--duration-quick) var(--ease-in-out),color var(--duration-quick) var(--ease-in-out)}.search-row.has-value .search-clear{opacity:1;pointer-events:auto}.search-clear:hover{color:var(--ink);background:var(--surface-3)}.search-meta{height:18px;padding:5px 2px 0;color:var(--subtle);font-size:10px}
    @media(max-width:760px){.app{grid-template-columns:1fr}.sidebar{position:fixed;z-index:10;inset:0 16% 0 0;transform:translateX(-105%);transition:transform var(--duration-slow) var(--ease-smooth-out),background-color var(--duration-quick) var(--ease-in-out),border-color var(--duration-quick) var(--ease-in-out),color var(--duration-quick) var(--ease-in-out);box-shadow:var(--shadow)}.sidebar.open{transform:translateX(0)}.main{height:100vh}.mobile-menu{display:grid}.toolbar{padding:0 12px}.stats{display:none}.toolbar-meta{gap:7px}.document-shell{padding:34px 20px 64px}.document-title{font-size:29px}.graph-heading{left:14px;top:14px}.graph-heading p{display:none}.graph-toolbar{right:12px;top:12px}.graph-btn{width:34px;padding:0;justify-content:center}.graph-btn-label{display:none}.graph-legend{display:none}.graph-inspector{right:12px;bottom:12px;width:calc(100% - 24px);transform-origin:bottom center}}
    @media(max-width:760px){.document-shell{display:block;padding:34px 20px 64px}.document-header{padding-bottom:28px}.document-title{font-size:29px;letter-spacing:-.4px}.outline{display:none}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar" id="sidebar">
      <div class="brand"><h1>OKF</h1></div>
      <div class="search-wrap"><div class="search-row"><input class="search" id="search" type="search" placeholder="Search concepts..." aria-label="Search concepts"><button class="search-clear" id="search-clear" type="button" aria-label="Clear search" title="Clear search">\xD7</button></div><div class="search-meta" id="search-meta"></div></div>
      <nav class="concept-list" id="concept-list" aria-label="Concepts"></nav>
      <div class="sidebar-foot"><div id="directory"></div><div style="margin-top:7px">Built with love by <a href="https://github.com/ovishkh" target="_blank" rel="noreferrer">Ovi Shekh</a></div></div>
    </aside>
    <main class="main">
      <header class="toolbar"><div style="display:flex;align-items:center;gap:8px"><button class="mobile-menu" id="menu" aria-label="Open navigation" title="Open navigation">\u2630</button><div class="tabs" id="view-tabs" data-active="document"><button class="tab active" data-view="document">Document</button><button class="tab" data-view="graph">Graph</button></div></div><div class="toolbar-meta"><div class="stats" id="stats"></div><button class="theme-toggle" id="theme-toggle" aria-label="Switch to dark theme" title="Switch theme"><span class="theme-icon theme-icon-moon" aria-hidden="true">\u263E</span><span class="theme-icon theme-icon-sun" aria-hidden="true">\u2600</span></button></div></header>
      <div class="content">
        <section class="view document-view active" id="document-view"><article class="document-shell"><header class="document-header"><div class="eyebrow" id="concept-type"></div><h2 class="document-title" id="concept-title"></h2><p class="document-description" id="concept-description"></p><span class="document-updated" id="document-updated"></span><div class="tags" id="tags"></div><a class="resource" id="resource" target="_blank" rel="noreferrer"></a></header><div class="markdown" id="markdown"></div><aside class="outline" id="outline"><p class="outline-title">On this page</p><nav class="outline-list" aria-label="On this page"></nav></aside></article></section>
        <section class="view graph-view" id="graph-view">
          <header class="graph-heading"><div class="graph-kicker">Knowledge map</div><h2>Explore connections</h2><p>Select a concept to trace its references and open its details.</p></header>
          <div class="graph-toolbar">
            <button class="graph-btn" id="fit" aria-label="Fit graph to view" title="Fit graph to view"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 2H2v4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="graph-btn-label">Fit view</span></button>
            <button class="graph-btn" id="relayout" aria-label="Re-layout graph" title="Re-layout graph"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.2 6A5.5 5.5 0 1 0 13 10.6M13.2 6V2.8M13.2 6H10" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="graph-btn-label">Re-layout</span></button>
          </div>
          <div id="graph" role="application" aria-label="Interactive concept relationship graph"></div>
          <div class="graph-legend" aria-hidden="true"><span><i class="dot"></i>Concept</span><span><i class="edge-mark"></i>Reference</span><span>Drag \xB7 scroll to zoom</span></div>
          <aside class="graph-inspector" id="graph-inspector" data-open="false" aria-live="polite">
            <div class="graph-inspector-top"><span class="graph-type" id="graph-type"></span><button class="graph-close" id="graph-close" aria-label="Close concept details">\xD7</button></div>
            <h3 id="graph-title"></h3><p id="graph-description"></p>
            <div class="graph-inspector-foot"><span class="graph-degree" id="graph-degree"></span><button class="graph-open" id="graph-open">Open document \u2192</button></div>
          </aside>
        </section>
      </div>
    </main>
  </div>
  <script src="/assets/cytoscape.js"></script>
  <script>window.OKF_DATA=${dataJson};</script>
  <script>
    (function(){
      var data=window.OKF_DATA, current=data.concepts[0], cy, selectedGraphId='';
      var list=document.getElementById('concept-list'), search=document.getElementById('search'), searchRow=document.querySelector('.search-row'), searchMeta=document.getElementById('search-meta'), sidebar=document.getElementById('sidebar'), themeToggle=document.getElementById('theme-toggle'), graphInspector=document.getElementById('graph-inspector');
      document.getElementById('directory').textContent=data.directory;
      document.getElementById('stats').textContent=data.concepts.length+' concepts \xB7 '+data.edges.length+' connections';
      function renderList(query){
        var q=(query||'').toLowerCase(); list.innerHTML=''; var matches=data.concepts.filter(function(c){return !q||[c.title,c.description,c.type,c.tags.join(' ')].join(' ').toLowerCase().indexOf(q)>=0});
        searchRow.classList.toggle('has-value',Boolean(q)); searchMeta.textContent=q?(matches.length+' result'+(matches.length===1?'':'s')):'Press / to search';
        matches.forEach(function(c){
          var b=document.createElement('button'); b.className='concept-btn'+(current&&current.id===c.id?' active':''); b.dataset.id=c.id;
          var t=document.createElement('span'); t.className='concept-title'; t.textContent=c.title; var m=document.createElement('span'); m.className='concept-meta'; m.textContent=c.type;
          b.appendChild(t); b.appendChild(m); b.onclick=function(){selectConcept(c.id); sidebar.classList.remove('open')}; list.appendChild(b);
        });
        if(!list.children.length){var e=document.createElement('div');e.className='empty';e.textContent='No matching concepts';list.appendChild(e)}
      }
      function selectConcept(id){
        var found=data.concepts.find(function(c){return c.id===id}); if(!found)return; current=found;
        document.getElementById('concept-type').textContent=found.type+' \xB7 '+found.id;
        document.getElementById('concept-title').textContent=found.title;
        document.getElementById('concept-description').textContent=found.description;
        var updated=document.getElementById('document-updated'); if(found.updatedAt){var date=new Date(found.updatedAt);updated.textContent=Number.isNaN(date.getTime())?'Last updated '+found.updatedAt:'Last updated '+date.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'})}else{updated.textContent=''}
        var tags=document.getElementById('tags'); tags.innerHTML=''; found.tags.forEach(function(tag){var s=document.createElement('span');s.className='tag';s.textContent=tag;tags.appendChild(s)});
        var r=document.getElementById('resource'); if(found.resource){r.href=found.resource;r.textContent='Open canonical resource \u2197';r.style.display='inline-block'}else{r.style.display='none'}
        document.getElementById('markdown').innerHTML=found.html; buildOutline(); renderList(search.value);
        var documentView=document.getElementById('document-view');documentView.classList.remove('is-revealing');void documentView.offsetWidth;documentView.classList.add('is-revealing');
        if(cy){cy.elements().removeClass('selected');var node=cy.getElementById(id);node.addClass('selected');cy.animate({center:{eles:node},duration:motionMs('--duration-fast',250)})}
        showView('document');
      }
      function buildOutline(){var nav=document.querySelector('#outline .outline-list');nav.innerHTML='';document.querySelectorAll('#markdown h1,#markdown h2,#markdown h3').forEach(function(heading,index){var id='section-'+index;heading.id=id;var link=document.createElement('button');link.className='outline-link';link.dataset.level=heading.tagName.slice(1);link.textContent=heading.textContent;link.onclick=function(){document.getElementById(id).scrollIntoView({behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})};nav.appendChild(link)})}
      function showView(name){document.getElementById('view-tabs').dataset.active=name;document.querySelectorAll('.view').forEach(function(el){el.classList.toggle('active',el.id===name+'-view')});document.querySelectorAll('.tab').forEach(function(el){var active=el.dataset.view===name;el.classList.toggle('active',active);el.setAttribute('aria-selected',String(active))});if(name==='graph'){initGraph();window.OKF_CY=cy;setTimeout(function(){cy.resize();fitGraph(false);updateGraphOverlapState()},40)}}
      function graphColors(){var dark=document.documentElement.dataset.theme==='dark';return{ink:dark?'#f3f3f5':'#1b1b1f',muted:dark?'#aaaab2':'#707078',edge:dark?'#5c5c65':'#a7a7b0',edgeActive:dark?'#9aa4ff':'#5e6ad2',border:dark?'#111113':'#fff',label:dark?'#111113':'#fff'}}
      function typeColor(type){var value=(type||'').toLowerCase();if(value.indexOf('api')>=0)return'#8b5cf6';if(value.indexOf('metric')>=0)return'#0ea5a4';if(value.indexOf('guide')>=0||value.indexOf('playbook')>=0)return'#e06c4f';if(value.indexOf('schema')>=0||value.indexOf('model')>=0)return'#d79a28';return'#5e6ad2'}
      function graphStyle(compact){var color=graphColors();return[
        {selector:'node',style:{'background-color':'data(color)','label':'data(label)','font-size':compact?10:11,'font-weight':600,'font-family':'Inter,system-ui,sans-serif','color':color.ink,'text-wrap':'wrap','text-max-width':compact?86:128,'text-valign':'bottom','text-margin-y':10,'text-background-color':color.label,'text-background-opacity':compact?0:.88,'text-background-padding':4,'text-background-shape':'roundrectangle','width':compact?28:32,'height':compact?28:32,'border-width':4,'border-color':color.border,'overlay-color':'data(color)','overlay-opacity':0,'overlay-padding':8,'transition-property':'width height border-width opacity overlay-opacity background-color','transition-duration':'250ms','transition-timing-function':'ease-out-cubic'}},
        {selector:'edge',style:{'width':1.5,'opacity':.58,'line-color':color.edge,'target-arrow-color':color.edge,'target-arrow-shape':'triangle','curve-style':'bezier','arrow-scale':.68,'transition-property':'width opacity line-color target-arrow-color','transition-duration':'250ms','transition-timing-function':'ease-out-cubic'}},
        {selector:'node.hovered',style:{'width':39,'height':39,'border-width':5,'overlay-opacity':.1}},
        {selector:'node.selected',style:{'width':43,'height':43,'border-width':5,'overlay-opacity':.14}},
        {selector:'node.neighbor',style:{'border-width':5}},
        {selector:'edge.selected-path',style:{'width':2.5,'opacity':1,'line-color':color.edgeActive,'target-arrow-color':color.edgeActive,'arrow-scale':.86}},
        {selector:'.dimmed',style:{'opacity':.14}},
        {selector:'.is-entering',style:{'opacity':0}}
      ]}
      function applyGraphTheme(){if(!cy)return;cy.style(graphStyle(window.innerWidth<760))}
      function motionMs(token,fallback){if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;var raw=getComputedStyle(document.documentElement).getPropertyValue(token).trim();if(!raw)return fallback;return raw.endsWith('ms')?parseFloat(raw):parseFloat(raw)*1000}
      function simpleGraph(){return data.concepts.length<=8}
      function graphHasOverlaps(){if(!cy)return false;var nodes=cy.nodes().toArray();for(var i=0;i<nodes.length;i++){var a=nodes[i].renderedBoundingBox();for(var j=i+1;j<nodes.length;j++){var b=nodes[j].renderedBoundingBox();if(a.x1<b.x2+10&&a.x2>b.x1-10&&a.y1<b.y2+10&&a.y2>b.y1-10)return true}}return false}
      function updateGraphOverlapState(){if(!cy)return;window.OKF_GRAPH_OVERLAPS=graphHasOverlaps();var graph=document.getElementById('graph');if(graph)graph.dataset.overlaps=window.OKF_GRAPH_OVERLAPS?'true':'false'}
      function graphLayout(animate){if(simpleGraph()){var container=document.getElementById('graph'),radius=Math.min(window.innerWidth<760?118:168,72+data.concepts.length*28),cx=container.clientWidth/2,cyCenter=container.clientHeight/2;return{name:'circle',animate:animate,animationDuration:motionMs('--duration-slow',400),fit:false,radius:radius,boundingBox:{x1:cx-radius,y1:cyCenter-radius,w:radius*2,h:radius*2},startAngle:-Math.PI/2,clockwise:true}}return{name:'cose',animate:animate,animationDuration:motionMs('--duration-very-slow',500),fit:true,padding:window.innerWidth<760?70:105,nodeRepulsion:9000,idealEdgeLength:125,edgeElasticity:90,nestingFactor:1.2,gravity:.7,numIter:900}}
      function fitGraph(animated){if(!cy)return;var duration=animated===false?0:motionMs('--duration-fast',250);if(simpleGraph()){cy.animate({center:{eles:cy.nodes()},zoom:window.innerWidth<760?.82:1,duration:duration,easing:'ease-out-cubic'})}else{cy.animate({fit:{eles:cy.elements(),padding:window.innerWidth<760?70:105},duration:duration,easing:'ease-out-cubic'})}}
      function revealGraph(){if(!cy||motionMs('--duration-fast',250)===0)return;var nodes=cy.nodes(),edges=cy.edges();nodes.addClass('is-entering');edges.addClass('is-entering');nodes.forEach(function(node,index){setTimeout(function(){node.removeClass('is-entering')},index*motionMs('--duration-stagger',40))});setTimeout(function(){edges.removeClass('is-entering')},Math.min(nodes.length,8)*motionMs('--duration-stagger',40))}
      function clearGraphClasses(){if(!cy)return;cy.elements().removeClass('dimmed neighbor selected-path hovered selected')}
      function paintGraphFocus(id){if(!cy)return;clearGraphClasses();var node=cy.getElementById(id);if(!node||node.empty())return;var neighborhood=node.closedNeighborhood();cy.elements().difference(neighborhood).addClass('dimmed');neighborhood.nodes().difference(node).addClass('neighbor');neighborhood.edges().addClass('selected-path');node.addClass('selected')}
      function showGraphInspector(id){var concept=data.concepts.find(function(c){return c.id===id});if(!concept)return;var degree=data.edges.filter(function(e){return e.source===id||e.target===id}).length;document.getElementById('graph-type').textContent=concept.type;document.getElementById('graph-title').textContent=concept.title;document.getElementById('graph-description').textContent=concept.description||'Open this concept to read the complete document.';document.getElementById('graph-degree').textContent=degree+' direct '+(degree===1?'connection':'connections');graphInspector.dataset.open='true'}
      function selectGraphNode(id){selectedGraphId=id;paintGraphFocus(id);showGraphInspector(id)}
      function clearGraphSelection(){selectedGraphId='';clearGraphClasses();graphInspector.dataset.open='false'}
      function initGraph(){if(cy)return;var compact=window.innerWidth<760;cy=cytoscape({container:document.getElementById('graph'),minZoom:.3,maxZoom:2.2,boxSelectionEnabled:false,elements:data.concepts.map(function(c){return{data:{id:c.id,label:c.title,type:c.type,color:typeColor(c.type)}}}).concat(data.edges.map(function(e,i){return{data:{id:'e'+i,source:e.source,target:e.target}}})),style:graphStyle(compact),layout:graphLayout(false)});revealGraph();cy.on('tap','node',function(event){selectGraphNode(event.target.id())});cy.on('tap',function(event){if(event.target===cy)clearGraphSelection()});cy.on('mouseover','node',function(event){if(!selectedGraphId){paintGraphFocus(event.target.id());event.target.addClass('hovered')}});cy.on('mouseout','node',function(){if(selectedGraphId)paintGraphFocus(selectedGraphId);else clearGraphClasses()})}
      search.addEventListener('input',function(){renderList(search.value)});document.getElementById('search-clear').onclick=function(){search.value='';renderList('');search.focus()};document.addEventListener('keydown',function(event){if(event.key==='/'&&document.activeElement!==search&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){event.preventDefault();search.focus()}if(event.key==='Escape'&&document.activeElement===search){search.value='';renderList('');search.blur()}});document.getElementById('menu').onclick=function(){sidebar.classList.toggle('open')};
      function syncThemeButton(){var dark=document.documentElement.dataset.theme==='dark';themeToggle.setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme')}
      themeToggle.onclick=function(){var next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('okf-theme',next)}catch(e){}syncThemeButton();applyGraphTheme()};syncThemeButton();
      document.querySelectorAll('.tab').forEach(function(tab){tab.onclick=function(){showView(tab.dataset.view)}});
      document.getElementById('fit').onclick=function(){fitGraph(true)};document.getElementById('relayout').onclick=function(){var button=this;button.classList.add('is-running');var layout=cy.layout(graphLayout(true));layout.one('layoutstop',function(){fitGraph(true);setTimeout(function(){button.classList.remove('is-running')},motionMs('--duration-fast',250))});layout.run()};
      document.getElementById('graph-close').onclick=clearGraphSelection;document.getElementById('graph-open').onclick=function(){if(selectedGraphId)selectConcept(selectedGraphId)};
      var resizeTimer;window.addEventListener('resize',function(){clearTimeout(resizeTimer);resizeTimer=setTimeout(function(){if(!cy)return;cy.resize();applyGraphTheme();if(document.getElementById('graph-view').classList.contains('active'))fitGraph(false)},80)});
      document.getElementById('markdown').addEventListener('click',function(event){var a=event.target.closest('a');if(!a)return;var href=a.getAttribute('href')||'';if(!href.endsWith('.md'))return;event.preventDefault();var base=current.id.split('/').slice(0,-1).join('/');var target=href.charAt(0)==='/'?href.slice(1):(base?base+'/':'')+href;var parts=[];target.split('/').forEach(function(p){if(p==='..')parts.pop();else if(p!=='.')parts.push(p)});selectConcept(parts.join('/'))});
      renderList(''); if(current)selectConcept(current.id);
    })();
  </script>
</body>
</html>`;
}

// src/cli/cli.ts
var program = new Command().name("okf").description("Generate and validate Open Knowledge Format bundles with your preferred LLM").version(VERSION).exitOverride().showHelpAfterError().configureHelp({ sortOptions: true, sortSubcommands: true });
program.hook("preAction", async () => {
  const machineReadable = cliArguments.includes("--json") || cliArguments.includes("--print");
  if (process.stdin.isTTY && process.stdout.isTTY && !machineReadable && !isInteractiveShellActive()) {
    await showInteractiveBranding(true);
  }
});
program.command("provider").description("Configure the default LLM provider and model").argument("[provider]", "LLM provider").addOption(new Option("-m, --model <model>", "provider model ID")).option("--api-key <key>", "provider API key (prefer a masked prompt)").option("--base-url <url>", "override the provider base URL").action(async (providerArgument, flags) => {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const provider = providerArgument ? parseProvider(providerArgument) : await promptProvider(interactive);
  let apiKey = resolveApiKey(provider, flags.apiKey);
  if (providers[provider].requiresKey && !apiKey) {
    if (!interactive) throw new Error(`Set ${providers[provider].envKey} or use --api-key.`);
    apiKey = unwrapPrompt(await p3.password({
      message: `Paste your ${providers[provider].label} API key`,
      mask: "*",
      validate: (value) => String(value ?? "").trim() ? void 0 : "An API key is required"
    }));
    registerDiagnosticSecret(providers[provider].envKey ?? "API_KEY", apiKey);
  }
  const baseUrl = resolveConfigValue(OKF_BASE_URL_ENV_KEY, flags.baseUrl).value;
  let model = flags.model?.trim();
  if (!model) {
    if (interactive) model = await promptModel(provider, apiKey, baseUrl);
    else if (provider === "nebius") throw new Error("Choose a Nebius model with --model when running non-interactively.");
    else model = requireDefaultModel(provider);
  }
  const updates = {
    [OKF_PROVIDER_ENV_KEY]: provider,
    [OKF_MODEL_ENV_KEY]: model
  };
  if (baseUrl) updates[OKF_BASE_URL_ENV_KEY] = baseUrl;
  if (apiKey && providers[provider].envKey) {
    const shouldSaveKey = interactive ? unwrapPrompt(await p3.confirm({ message: "Save the API key to ~/.okf/.env for future sessions?", initialValue: false })) : false;
    if (shouldSaveKey) updates[providers[provider].envKey] = apiKey;
  }
  await saveOkfEnv(updates);
  p3.log.success(`Saved ${providers[provider].label} with model ${model}`);
});
program.command("generate", { isDefault: true }).alias("update").description("Generate an OKF v0.1 knowledge bundle").argument("[request]", "what knowledge the bundle should capture").addOption(new Option("-p, --provider <provider>", "LLM provider").choices([...providerNames])).option("-m, --model <model>", "provider model ID").option("--api-key <key>", "provider API key (prefer the provider environment variable in automation)").option("-o, --output <directory>", "bundle output directory").option("-s, --source <source...>", "source files, directories, or URLs").option("--config <file>", "project configuration file").option("--base-url <url>", "override the provider base URL").option("--force", "write into a non-empty directory that is not an existing OKF bundle").option("--no-log", "do not generate log.md").option("--view", "open the generated bundle in the visual explorer").option("--view-port <port>", "visual explorer port", "4173").option("--print", "run once and print the machine-readable result").action(async (request, flags) => {
  const project = await loadProjectConfig(flags.config);
  const configDirectory = project.path ? path12.dirname(project.path) : process.cwd();
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !flags.print);
  const environmentProvider = resolveProvider(flags.provider);
  const providerResolution = environmentProvider.value ? environmentProvider : {
    value: project.config.provider,
    source: project.config.provider ? "default" : "unset"
  };
  const provider = providerResolution.value ? parseProvider(providerResolution.value) : "nebius";
  if (interactive && providerResolution.value && providerResolution.source !== "flag") {
    p3.log.info(`${providers[provider].label} selected from ${providerResolution.envKey ?? providerResolution.source}`);
  }
  let apiKey = resolveApiKey(provider, flags.apiKey);
  if (apiKey) registerDiagnosticSecret(providers[provider].envKey ?? "API_KEY", apiKey);
  if (providers[provider].requiresKey && !apiKey) {
    if (!interactive) {
      throw new Error(`Set ${providers[provider].envKey} before running non-interactively.`);
    }
    apiKey = unwrapPrompt(await p3.password({
      message: `Paste your ${providers[provider].label} API key`,
      mask: "*",
      validate: (value) => String(value ?? "").trim() ? void 0 : "An API key is required"
    }));
    registerDiagnosticSecret(providers[provider].envKey ?? "API_KEY", apiKey);
    const shouldSaveKey = unwrapPrompt(await p3.confirm({
      message: `Save it to ~/.okf/.env for future sessions?`,
      initialValue: false
    }));
    if (shouldSaveKey) {
      await saveOkfEnv({ [providers[provider].envKey]: apiKey });
      p3.log.success(`Saved ${providers[provider].envKey} with private file permissions`);
    } else {
      p3.log.info(`${pc2.dim("Hint:")} Your key is used for this run only and is never saved.`);
    }
  } else if (interactive && providers[provider].requiresKey) {
    p3.log.success(`${providers[provider].envKey} detected \xB7 credential value remains hidden`);
  }
  const baseUrl = resolveConfigValue(OKF_BASE_URL_ENV_KEY, flags.baseUrl).value ?? project.config.baseUrl;
  let model = resolveConfigValue(OKF_MODEL_ENV_KEY, flags.model).value ?? project.config.model;
  if (!model) {
    if (interactive) model = await promptModel(provider, apiKey, baseUrl);
    else if (provider === "nebius") throw new Error("Choose a Nebius model with --model when running non-interactively.");
    else model = requireDefaultModel(provider);
  }
  const generationRequest = request ?? (interactive ? unwrapPrompt(await p3.text({
    message: "What knowledge should this bundle capture?",
    placeholder: "Document our payments API from the supplied OpenAPI file",
    validate: (value) => String(value ?? "").trim() ? void 0 : "Describe the bundle you want to create"
  })) : void 0);
  if (!generationRequest) throw new Error("Provide a generation request as an argument.");
  let sources = (flags.source ?? project.config.sources).map((source) => resolveProjectPath(source, configDirectory));
  if (interactive && sources.length === 0) {
    const sourceInput = unwrapPrompt(await p3.text({
      message: "Source material (optional)",
      placeholder: "docs/, schema.sql, URL \u2014 comma-separated"
    }));
    sources = sourceInput.trim() ? sourceInput.split(",").map((value) => value.trim()).filter(Boolean) : [];
  }
  const configuredOutput = resolveProjectPath(flags.output ?? project.config.output, configDirectory);
  const outputDirectory = interactive ? unwrapPrompt(await p3.text({
    message: "Where should the bundle be written?",
    placeholder: configuredOutput,
    defaultValue: configuredOutput,
    validate: (value) => String(value ?? "").trim() ? void 0 : "An output directory is required"
  })) : configuredOutput;
  const includeLog = interactive ? unwrapPrompt(await p3.confirm({ message: "Create a generation log.md?", initialValue: flags.log && project.config.log })) : flags.log && project.config.log;
  const existingBundle = await inspectExistingBundle(outputDirectory);
  const shouldView = flags.view ?? (interactive ? unwrapPrompt(await p3.confirm({ message: "Open the visual explorer after generation?", initialValue: true })) : false);
  if (interactive) {
    if (existingBundle) {
      p3.log.info(`Existing OKF bundle found \xB7 ${existingBundle.conceptPaths.length} concepts will be improved and log.md will be maintained`);
    } else if (sources.length === 0) {
      p3.log.warn("No source material selected \xB7 the bundle will be based only on your request");
    }
    console.log(boxen2([
      `${pc2.bold("Mode")}      ${existingBundle ? pc2.cyan("Update existing OKF bundle") : "Create new OKF bundle"}`,
      `${pc2.bold("Provider")}  ${providers[provider].label}`,
      `${pc2.bold("Model")}     ${model}`,
      `${pc2.bold("Sources")}   ${sources.length ? sources.join(", ") : pc2.dim("none")}`,
      `${pc2.bold("Output")}    ${path12.resolve(outputDirectory)}`
    ].join("\n"), { borderStyle: "single", borderColor: "gray", padding: 1, margin: { bottom: 1 } }));
  }
  const spin = interactive ? p3.spinner() : void 0;
  spin?.start(existingBundle ? "Improving existing knowledge bundle" : "Generating knowledge bundle");
  let result;
  try {
    result = await generateBundle({
      request: generationRequest,
      provider,
      model,
      apiKey,
      baseUrl,
      maxRetries: resolveConfigValue(OKF_RETRY_ATTEMPTS_ENV_KEY).value ? resolveRetryAttempts() : project.config.retries ?? resolveRetryAttempts(),
      outputDirectory,
      sources,
      force: flags.force,
      includeLog,
      onProgress: (event) => spin?.message(event.message)
    });
    spin?.stop(`${result.mode === "updated" ? "Updated" : "Generated"} ${result.plan.concepts.length} concepts`);
  } catch (error) {
    spin?.stop("Generation stopped before completion");
    throw error;
  }
  if (interactive) rememberGeneration(outputDirectory, sources);
  let viewer;
  if (shouldView) {
    try {
      viewer = await startViewer({ directory: outputDirectory, port: parsePort(flags.viewPort), openBrowser: true });
    } catch (error) {
      const warning = `The bundle is ready, but the viewer could not start: ${friendlyError(error)}`;
      if (interactive) p3.log.warn(warning);
      else process.stderr.write(`${warning}
`);
    }
  }
  const warnings = result.validation.issues.filter((issue) => issue.severity === "warning");
  if (interactive) {
    for (const warning of warnings.slice(0, 3)) p3.log.warn(`${warning.file}: ${warning.message}`);
    if (warnings.length > 3) p3.log.warn(`${warnings.length - 3} more warnings \xB7 run okf validate ${outputDirectory} for details`);
    p3.note(
      [
        `Provider  ${providers[provider].label}`,
        `Model     ${model}`,
        `Files     ${result.files.length}`,
        `Warnings  ${warnings.length}`,
        `Output    ${path12.resolve(outputDirectory)}`,
        ...viewer ? [`Viewer    ${viewer.url}`] : []
      ].join("\n"),
      result.mode === "updated" ? "Bundle updated" : "Bundle ready"
    );
    p3.outro(viewer ? `Explorer running at ${viewer.url} \xB7 press Ctrl+C to stop` : `Validation passed \xB7 next: okf view ${outputDirectory}`);
  } else {
    process.stdout.write(`${JSON.stringify({
      output: path12.resolve(outputDirectory),
      mode: result.mode,
      concepts: result.plan.concepts.length,
      files: result.files.length,
      warnings: warnings.length
    })}
`);
  }
});
program.command("init").description("Create an okf project configuration").argument("[file]", "configuration file", DEFAULT_PROJECT_CONFIG).option("--force", "replace an existing configuration").action(async (file, flags) => {
  const created = await createProjectConfig(file, flags.force);
  p3.log.success(`Created ${path12.relative(process.cwd(), created) || path12.basename(created)}`);
  p3.log.info(`Edit the sources and model, then run ${pc2.bold('okf generate "Describe this knowledge"')}`);
});
program.command("view").description("Browse an OKF bundle with a document reader and relationship graph").argument("[directory]", "bundle directory", ".").option("--host <host>", "server host", "127.0.0.1").option("--port <port>", "server port", "4173").option("--no-open", "do not open the browser automatically").action(async (directory, flags) => {
  const result = await validateBundle(directory);
  if (!result.valid) throw new Error(`Cannot view an invalid OKF bundle. Run okf validate ${directory} for details.`);
  const viewer = await startViewer({
    directory,
    host: flags.host,
    port: parsePort(flags.port),
    openBrowser: flags.open
  });
  p3.log.success(`okf Explorer is running at ${viewer.url}`);
  p3.log.info("Press Ctrl+C to stop the server");
});
program.command("validate").description("Validate an existing OKF bundle").argument("[directory]", "bundle directory", ".").option("--json", "print machine-readable JSON").action(async (directory, flags) => {
  const result = await validateBundle(directory);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
  } else {
    for (const issue of result.issues) {
      const label = issue.severity === "error" ? pc2.red("error") : pc2.yellow("warn ");
      process.stdout.write(`${label}  ${pc2.bold(issue.file)}: ${issue.message}
`);
    }
    const status = result.valid ? pc2.green("valid") : pc2.red("invalid");
    process.stdout.write(`${status}  ${result.filesChecked} Markdown files checked \xB7 ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}
`);
    if (result.valid) process.stdout.write(`${pc2.dim("Hint:")} Explore it with okf view ${directory}
`);
  }
  if (!result.valid) process.exitCode = 1;
});
program.command("lint").description("Check an OKF bundle for structural and editorial quality issues").argument("[directory]", "bundle directory", ".").option("--json", "print machine-readable JSON").option("--strict", "treat warnings as failures").action(async (directory, flags) => {
  const result = await lintBundle(directory, { strict: flags.strict });
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}
`);
  } else {
    for (const issue of result.issues) {
      const label = issue.severity === "error" ? pc2.red("error") : pc2.yellow("warn ");
      process.stdout.write(`${label}  ${pc2.bold(issue.file)} [${issue.rule}]: ${issue.message}
`);
    }
    const status = result.valid ? pc2.green("clean") : pc2.red("failed");
    process.stdout.write(`${status}  ${result.filesChecked} Markdown files checked \xB7 ${result.issues.length} issue${result.issues.length === 1 ? "" : "s"}
`);
  }
  if (!result.valid) process.exitCode = 1;
});
program.command("providers").description("List supported model providers and credential variables").action(() => {
  process.stdout.write(`${pc2.bold("Provider")}     ${pc2.bold("Name")}                    ${pc2.bold("Credential")}
`);
  for (const name of providerNames) {
    const provider = providers[name];
    process.stdout.write(`${name.padEnd(12)} ${provider.label.padEnd(23)} ${provider.envKey ?? "no key required"}
`);
  }
  process.stdout.write(`
${pc2.dim("Hint:")} Set the credential in your environment, or paste it securely during /generate.
`);
});
var cliArguments = process.argv.slice(2);
var run = loadOkfEnv().then(async () => {
  if (process.stdin.isTTY && process.stdout.isTTY && cliArguments.length === 0) await startInteractiveShell(program, VERSION);
  else await program.parseAsync();
});
run.catch((error) => {
  if (error instanceof CommanderError2) {
    process.exitCode = error.exitCode;
    return;
  }
  if (error instanceof PromptCancelledError) return;
  const message = friendlyError(error);
  p3.log.error(message);
  process.exitCode = 1;
});
async function promptProvider(interactive) {
  if (!interactive) throw new Error("Choose a provider with --provider.");
  return unwrapPrompt(await p3.select({
    message: "Choose an LLM provider",
    options: providerNames.map((name) => ({
      value: name,
      label: providers[name].label,
      hint: providers[name].hint
    }))
  }));
}
async function promptModel(provider, apiKey, baseUrl) {
  if (provider === "nebius") {
    if (!apiKey) throw new Error("A Nebius API key is required before loading models.");
    const spin = p3.spinner();
    spin.start("Loading models from Nebius Token Factory");
    try {
      const models = await fetchNebiusModels(apiKey, baseUrl);
      spin.stop(`Found ${models.length} available models`);
      const selected2 = unwrapPrompt(await p3.autocomplete({
        message: "Choose a Nebius model",
        placeholder: "Type to filter models",
        maxItems: 8,
        options: [
          ...models.map((model) => ({ value: model, label: formatModelLabel(model), hint: model })),
          { value: "__custom__", label: "Enter a custom model ID", hint: "Use an ID not shown above" }
        ]
      }));
      if (selected2 !== "__custom__") return selected2;
    } catch (error) {
      spin.stop("Could not load Nebius models");
      throw error;
    }
    return promptCustomModel();
  }
  const defaultModel = requireDefaultModel(provider);
  const presets = providers[provider].models ?? [defaultModel];
  const selected = unwrapPrompt(await p3.select({
    message: "Choose a model",
    options: [
      ...presets.map((model) => ({ value: model, label: model, hint: model === defaultModel ? "recommended" : void 0 })),
      { value: "__custom__", label: "Enter a custom model ID", hint: "for hosted or local models" }
    ]
  }));
  if (selected !== "__custom__") return selected;
  return promptCustomModel(defaultModel);
}
async function promptCustomModel(placeholder) {
  return unwrapPrompt(await p3.text({
    message: "Model ID",
    placeholder,
    validate: (value) => String(value ?? "").trim() ? void 0 : "A model ID is required"
  }));
}
function parseProvider(value) {
  if (!providerNames.includes(value)) throw new Error(`Unsupported provider: ${value}`);
  return value;
}
function requireDefaultModel(provider) {
  const model = providers[provider].defaultModel;
  if (!model) throw new Error(`Choose a ${providers[provider].label} model explicitly.`);
  return model;
}
function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid port: ${value}`);
  return port;
}
function resolveProjectPath(value, configDirectory) {
  if (/^https?:\/\//i.test(value) || path12.isAbsolute(value)) return value;
  return path12.resolve(configDirectory, value);
}
async function showInteractiveBranding(alwaysShowWordmark = false) {
  if (alwaysShowWordmark) showWordmark();
  else await showFirstRunWordmark();
  const project = await loadProjectConfig();
  const configuredProvider = resolveProvider().value ?? project.config.provider ?? "nebius";
  const provider = parseProvider(configuredProvider);
  const model = resolveConfigValue(OKF_MODEL_ENV_KEY).value ?? project.config.model ?? requireDefaultModel(provider);
  console.log(boxen2([
    `${pc2.cyan(">_")}  ${pc2.bold("okf")}  ${pc2.dim(`v${VERSION}`)}`,
    "",
    `${pc2.dim("model:")}     ${pc2.bold(model)}  ${pc2.cyan("/model to change")}`,
    `${pc2.dim("directory:")} ${pc2.bold(formatHomePath(process.cwd()))}`
  ].join("\n"), {
    borderStyle: "round",
    borderColor: "cyan",
    padding: { left: 1, right: 1 },
    margin: { top: 1, bottom: 1 }
  }));
  console.log(`${pc2.dim("Built with love by")} ${terminalLink2("Ovi Shekh", "https://github.com/ovishkh")}`);
}
function terminalLink2(label, url) {
  return `\x1B]8;;${url}\x07${pc2.cyan(label)}\x1B]8;;\x07`;
}
//# sourceMappingURL=cli.js.map