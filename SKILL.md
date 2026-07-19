---
name: okf
description: Generate, validate, inspect, and visualize Open Knowledge Format bundles with okf. Use when a coding agent needs to turn repositories, documentation, schemas, APIs, or URLs into OKF v0.1 knowledge, check an existing OKF bundle, automate OKF generation in CI, or open the document and relationship graph explorer.
---

# Use okf

Use `okf` when installed globally. Otherwise run the same commands with `npx okf`.

## Generate knowledge

Inspect the requested sources before generation. Select only relevant text based files and never include secrets, credentials, dependency folders, build output, or private data the user did not authorize.

Use interactive mode when a person is present:

```bash
okf
```

Use explicit flags for agent and CI runs:

```bash
okf generate "Document the architecture, public interfaces, and operating procedures" \
  --provider nebius \
  --model meta-llama/Llama-3.3-70B-Instruct \
  --source ./src ./docs ./openapi.yaml \
  --output ./knowledge
```

Supported providers are `nebius`, `openrouter`, `ollama`, `openai`, and `anthropic`. Run `okf providers` to see credential environment variables. Prefer environment variables over `--api-key`; never print, commit, or copy API keys into generated knowledge.

okf reads exported provider credentials and `OKF_PROVIDER`, `OKF_MODEL`, `OKF_BASE_URL`, and `OKF_RETRY_ATTEMPTS`. Exported values override `~/.okf/.env`. Interactive users may opt in to saving a masked credential there; never save or modify credentials without that explicit confirmation.

Nebius is the default provider, and new `okf.config.yml` files pin `zai-org/GLM-5.2`. Interactive Nebius model selection loads the live catalog after credential entry. In non-interactive or CI runs, ensure the model comes from `--model`, `OKF_MODEL`, saved settings, or project configuration; an unconfigured Nebius run requires an explicit model.

Initialize reusable project settings when the repository does not already have them:

```bash
okf init
```

This creates `okf.config.yml` with Nebius and `zai-org/GLM-5.2`, example sources, and an output path. Inspect and adjust its sources before generation. Paths in this file are relative to the configuration file.

To configure user-level provider and model defaults without generating a bundle, use the standalone setup command:

```bash
okf provider
```

Use its masked interactive credential prompt when a person is present. For automation, pass the provider and model explicitly, for example `okf provider ollama --model qwen3:8b`. Never persist a credential non-interactively or place one in project configuration.

Use `--base-url` only for an explicitly requested compatible endpoint. When the output directory is an existing OKF v0.1 bundle, generation automatically improves it, rebuilds its indexes, removes stale OKF documents, and appends to `log.md`. Do not add `--force` for that normal update path. Use `--force` only after inspecting a non-OKF non-empty output directory and confirming files may be replaced.

## Verify every bundle

Always validate after generation or manual edits:

```bash
okf validate ./knowledge
```

For automation, use JSON output and treat a nonzero exit code as failure:

```bash
okf validate ./knowledge --json
```

Fix conformance errors before completing the task. Report broken link warnings and fix them when the target should exist. Do not reject unknown concept types or producer metadata because OKF permits extensions.

## Open the explorer

Launch the local document reader and relationship graph:

```bash
okf view ./knowledge
```

In headless environments, prevent browser launch and report the URL:

```bash
okf view ./knowledge --host 127.0.0.1 --port 4173 --no-open
```

Use `--view` during generation only when an interactive browser session is useful:

```bash
okf generate "Document this repository" --source . --output ./knowledge --view
```

The graph derives directed edges from internal Markdown links. Improve a disconnected graph by adding meaningful bundle relative links between concepts, not by inventing relationships.

## Preserve OKF semantics

- Keep each concept in a UTF-8 Markdown file with parseable YAML frontmatter.
- Require a non-empty `type` field for every concept.
- Reserve `index.md` for directory listings and `log.md` for dated updates.
- Prefer bundle absolute links such as `/api/orders.md` for cross-concept relationships.
- Use structural Markdown and include `# Schema`, `# Examples`, and `# Citations` where applicable.
- Cite only supplied or verified sources. Preserve uncertainty instead of fabricating facts.
- Keep generated knowledge portable; do not depend on the visual explorer to understand it.

## Finish the task

Run validation, summarize the output directory and concept count, report warnings, and state how to launch the explorer. Do not claim generation succeeded if the provider call or OKF validation failed.
