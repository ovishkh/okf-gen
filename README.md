<div align="center">
  <h1>🚀 okf</h1>
  <p><strong>Portable Open Knowledge Format (OKF) bundles from your docs, code, and URLs</strong></p>

  [![npm version](https://img.shields.io/npm/v/okf.svg?style=flat-square)](https://www.npmjs.org/package/okf)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
  [![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green.svg?style=flat-square)](https://nodejs.org/)
  [![GitHub issues](https://img.shields.io/github/issues/ovishkh/okf?style=flat-square)](https://github.com/ovishkh/okf/issues)

  <p>
    <a href="#-what-it-does">What It Does</a> •
    <a href="#-install">Install</a> •
    <a href="#-interactive-mode">Interactive Mode</a> •
    <a href="#-command-reference">Commands</a> •
    <a href="#-community--security">Community</a>
  </p>
</div>

---

**okf** generates portable [Open Knowledge Format (OKF) v0.1](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) bundles from your documentation, schemas, source code, and URLs. It uses [LangChain](https://js.langchain.com/) so you can choose a hosted open-source model, a local Ollama model, or a proprietary provider without changing the generation pipeline.

The npm package and installed command are both **`okf`**.

## ✨ What It Does

1. **Collects** source material from files, directories, or HTTP(S) URLs.
2. **Detects** an existing OKF v0.1 bundle at the output path and includes it as update context.
3. **Sends** a structured generation or improvement prompt to the selected LangChain chat model.
4. **Parses** the model response into a validated bundle plan.
5. **Renders** Markdown concepts with YAML frontmatter deterministically.
6. **Creates** progressive-disclosure `index.md` files and maintains an optional `log.md` history.
7. **Validates** the finished bundle against the OKF v0.1 conformance rules.
8. **Explores:** Optionally opens a searchable document explorer with an interactive relationship graph.

> 🛡️ **Safety First:** The model never writes files directly. This keeps frontmatter, paths, reserved filenames, and output boundaries under CLI control.

## 📦 Install

```bash
npm install -g okf
```

Node.js 20 or newer is required. For local development:

```bash
git clone https://github.com/ovishkh/okf.git
cd okf
npm install
npm run build
npm link
```

## 💻 Interactive Mode

Run `okf` with a terminal attached to open the interactive command center:

```bash
okf
```

The persistent shell shows the large okf wordmark on its first run, followed by a compact startup panel with the effective model and working directory. Direct interactive commands show the same branding and context before their prompts. Type `/` to see live command suggestions with short descriptions; the list filters as you continue typing. Every action in the persistent shell uses a slash command:

- `/generate [request]` starts the guided generation flow
- `/update [request]` refreshes the last generated bundle with its remembered sources
- `/view [directory]` opens a bundle explorer
- `/validate [directory]` validates a bundle
- `/providers` lists model providers and credential variables
- `/provider [name]` changes the provider for the current session
- `/model [id]` changes the model for the current session
- `/api-key` securely enters or replaces the current provider credential
- `/status` shows effective configuration and where each value came from
- `/config save` persists provider/model defaults; `/config reset` clears them
- `/commands` (or `/help`) shows syntax, examples, and hints
- `/exit` closes the shell

Quoted arguments work as expected, for example `/generate "Document our payments API" --source ./docs`. You can still run `okf generate` directly for the original one-shot guided flow. It lets you select a provider, choose a model, paste a missing API key into a masked prompt, add sources, choose an output directory, and review a final configuration panel before generation. If the output directory already contains an OKF v0.1 bundle, the panel switches to update mode and reports how many existing concepts will be improved.

API keys entered during a run stay in memory unless you explicitly choose to save them.

### ⚙️ Configuration and credentials

okf resolves settings in this order: command flags, exported terminal environment, `~/.okf/.env`, project configuration, then interactive prompts and provider defaults. If no provider is configured, Nebius is used. If exactly one supported provider credential is exported, the interactive CLI selects that provider automatically. `/status` reports the effective provider, model, credential status, and source without displaying secrets.

```bash
export OPENROUTER_API_KEY="..."
export OKF_PROVIDER="openrouter"
export OKF_MODEL="openai/gpt-oss-120b"
okf
```

When a key is entered through a masked prompt or `/api-key`, okf asks whether to save it. Saving is opt-in. The `~/.okf` directory is protected with mode `0700` and its `.env` file with `0600` on supported platforms. Exported terminal variables always override saved values.

Managed settings are `OKF_PROVIDER`, `OKF_MODEL`, `OKF_BASE_URL`, and `OKF_RETRY_ATTEMPTS`. Provider requests default to three retries; the retry setting accepts values from `0` through `10`.

Configure and save a provider/model pair without starting generation:

```bash
okf provider
```

In an interactive terminal, this command selects a provider and model, prompts securely for a missing credential, and optionally saves that credential. Provider and model defaults are written to `~/.okf/.env`. For scripted setup, pass the provider and model explicitly; credentials supplied with `--api-key` are used for setup but are not persisted non-interactively:

```bash
okf provider openrouter --model openai/gpt-oss-120b --api-key "$OPENROUTER_API_KEY"
```

## 🤖 Providers

| Provider | Default model | Environment variable | Notes |
| --- | --- | --- | --- |
| **Nebius Token Factory** | `zai-org/GLM-5.2` | `NEBIUS_API_KEY` | Hosted default; interactive selection uses the live model catalog |
| **OpenRouter** | `openai/gpt-oss-120b` | `OPENROUTER_API_KEY` | Open and proprietary models through one router |
| **Ollama** | `qwen3:8b` | None | Local models; Ollama must be running |
| **OpenAI** | `gpt-5.4-mini` | `OPENAI_API_KEY` | OpenAI API models |
| **Anthropic** | `claude-sonnet-4-6` | `ANTHROPIC_API_KEY` | Claude API models |

Set a provider key before an automated run:

```bash
export NEBIUS_API_KEY="..."
```

`--api-key` is available for one-off runs, but environment variables are safer because shell history and CI logs can expose command arguments.

For Nebius, an interactive model-selection flow validates the API key by loading the current Token Factory model catalog. The searchable selector shows readable names such as `GPT OSS 120B (OpenAI)` while retaining the exact model ID as a hint. New project configurations pin `zai-org/GLM-5.2`, so they work consistently in automation. A non-interactive Nebius run without a configured model still requires `--model`.

## 🛠️ Command Reference

### Initialize a project

Create a reusable project configuration:

```bash
okf init
```

This writes `okf.config.yml`. Generation automatically discovers that file in the current directory or a parent directory:

```yaml
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
```

Paths are resolved relative to the configuration file. Command flags override environment or saved settings, which override project configuration. Use `--config <file>` to select another file and `okf init --force` to replace an existing one.

### Generate a bundle

```bash
okf generate "Document our payments API" \
  --provider nebius \
  --model meta-llama/Llama-3.3-70B-Instruct \
  --source ./docs ./openapi.yaml \
  --output ./payments-okf
```

**Options:**
- `-p, --provider`: `nebius`, `openrouter`, `ollama`, `openai`, or `anthropic`
- `-m, --model`: provider model ID
- `--api-key`: one-off provider key
- `-s, --source`: one or more files, directories, or HTTP(S) URLs
- `--config`: explicit `okf.config.yml` path
- `-o, --output`: output directory, default `./okf-bundle`
- `--base-url`: override an OpenAI-compatible or Ollama endpoint
- `--force`: allow writing into a non-empty directory that is not an existing OKF bundle
- `--no-log`: skip `log.md`

Without a TTY, `generate` prints a compact JSON summary, making it suitable for CI. Use `--print` to force this one-shot behavior even when a terminal is attached.

### Update an existing bundle

Run the same generation command with an existing OKF v0.1 bundle as the output directory:

```bash
okf generate "Refresh this knowledge from the latest source material" \
  --source ./docs \
  --output ./payments-okf
```

okf automatically supplies the current bundle to the model as context and asks for a complete improved plan. It updates changed concepts, adds new concepts, removes stale OKF Markdown files, rebuilds indexes, and appends a timestamped, per-document change summary to the existing `log.md`. Unrelated non-Markdown files are left untouched. `--force` is not required for recognized OKF bundles. Updates happen only when you run this command; okf does not install or require a scheduled job.

### Validate a bundle

```bash
okf validate ./payments-okf
okf validate ./payments-okf --json
```

Validation checks frontmatter, required `type` fields, reserved files, index/log structure, and reports broken internal links as warnings.

### Lint bundle quality

Run editorial and graph-quality checks in addition to OKF conformance validation:

```bash
okf lint ./payments-okf
okf lint ./payments-okf --strict
okf lint ./payments-okf --json
```

Linting detects duplicate concept titles, orphan concepts, thin content, skipped heading levels, broken Markdown links, and broken heading anchors. Warnings are informational by default; `--strict` treats them as failures for CI.

### Explore a bundle

```bash
okf view ./payments-okf
```

The explorer runs locally and provides two connected views:

- 📄 **Document** renders sanitized Markdown with searchable concept navigation.
- 🕸️ **Graph** visualizes every concept as a node and every internal Markdown link as a directed edge. Selecting a node opens its document.
- 🎨 **Theme** defaults to a clean light interface and includes a persistent dark mode toggle.

Use `--port` and `--host` to control the local server, or `--no-open` to start it without launching a browser:

```bash
okf view ./payments-okf --port 4400 --no-open
```

To open the explorer immediately after generation:

```bash
okf generate "Document this repository" --source . --view
```

### List providers

```bash
okf providers
```

Configure the default provider and model without starting generation. Omit the provider in a terminal for guided selection, or provide it with `--model` for scripted setup:

```bash
okf provider
okf provider ollama --model qwen3:8b
```

## 📂 Generated Bundle

An output directory looks like this:

```text
payments-okf/
├── index.md
├── log.md
├── api/
│   ├── index.md
│   └── authentication.md
└── schemas/
    ├── index.md
    └── payments.md
```

Every concept document contains OKF frontmatter with a non-empty `type`, followed by ordinary Markdown. The root index declares `okf_version: "0.1"`; nested indexes contain linked directory listings. The log keeps the original creation entry and subsequent update entries with counts for improved, added, and removed concepts.

## 🔌 TypeScript API

```ts
import { generateBundle } from "okf";

const result = await generateBundle({
  provider: "nebius",
  model: "meta-llama/Llama-3.3-70B-Instruct",
  apiKey: process.env.NEBIUS_API_KEY,
  request: "Document the catalog represented by these files",
  sources: ["./catalog"],
  outputDirectory: "./catalog-okf",
});

console.log(result.mode, result.validation.valid, result.files);
```

The exported API also includes `createChatModel`, `renderBundle`, `validateBundle`, provider metadata, and the Zod schemas.

## 🧠 Coding Agents

The published package includes [SKILL.md](./.agents/skills/okf/SKILL.md), which gives Codex, Claude Code, Cursor, and other coding agents a safe workflow for generating, validating, and visualizing OKF bundles. Agents can read that file directly from the repository or installed package.

## 🛑 Safety and Limits

- Source input is capped at 1 MB per run.
- Hidden directories, `.git`, dependencies, and build output are skipped during directory ingestion.
- Remote sources use a 15-second timeout and are size-checked after download.
- Concept paths are constrained to remain inside the output directory.
- Automatic updates only activate when the destination root declares `okf_version: "0.1"`; other non-empty directories remain protected unless `--force` is explicit.
- Update cleanup only removes stale OKF Markdown documents and indexes. Other files are preserved.
- API keys are persisted only after explicit confirmation, in the private `~/.okf/.env` file; exported terminal values take precedence.
- Model output is parsed and validated before any files are written.

## 🚧 Development

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

Before publishing, confirm the package name is available and run:

```bash
npm login
npm publish --access public
```

## 🤝 Community & Security

We welcome contributions and feedback! Please check out our [Issue Templates](https://github.com/ovishkh/okf/issues/new/choose) if you've found a bug or have a feature request.

- **Security:** Please review our [Security Policy](./.github/SECURITY.md) for how to report vulnerabilities responsibly.
- **Code of Conduct:** We are committed to fostering a welcoming community. Please read our [Code of Conduct](./.github/CODE_OF_CONDUCT.md).
- **Contributing:** See our [Contributing Guidelines](./.github/CONTRIBUTING.md) for local setup and PR flows.

## 📜 License

MIT. See [LICENSE](./LICENSE).

Built with ❤️ by [Ovi Shekh](https://github.com/ovishkh).
