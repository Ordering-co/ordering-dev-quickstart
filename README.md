# Ordering.co developer quickstart

Connect an AI agent, or your own code, to your Ordering.co project in about 5 minutes.

- **Operate with AI:** ask Claude Code, Codex, Cursor or VS Code about your orders, businesses and reports through the Ordering.co **MCP** server.
- **Build software:** call the Ordering.co **REST API** from your code, starting with ready-to-run requests.

This repo is the runnable part. The [developer docs](https://docs.ordering.co/docs/developers/) explain concepts, and the [API Reference](https://docs.ordering.co/api-reference/) is the full contract.

| Works with | How it connects |
|---|---|
| Claude Code | `.mcp.json` in this repo |
| Codex | `./ordering codex` |
| Cursor | `.cursor/mcp.json` in this repo |
| VS Code (Copilot agent mode) | `.vscode/mcp.json` in this repo |
| Your code, Postman, REST clients | `./ordering api`, [`requests/`](requests/), [OpenAPI spec](https://docs.ordering.co/api-reference/openapi.json) |

## Which one do I need?

| I want to… | Use | Credential |
|---|---|---|
| Ask my AI agent about my orders, businesses or reports | **MCP** | MCP key (`ord_mcp_…`). Start with a **read** key |
| Build an integration that runs on its own (ERP sync, my own app) | **REST API** | API key (`X-Api-Key` header) |
| Have my agent help me **write code** against the API | **REST API + [`AGENTS.md`](AGENTS.md)** | API key, kept in `.env` |
| Act on behalf of an end customer who logs in | **REST API with a session** | Bearer token from `POST /auth` |

More detail: [docs/credentials.md](docs/credentials.md).

> [!WARNING]
> **There is no sandbox.** The API, the MCP and the API Reference's "Test Request" all work on your real project. Start with read-only access. `./ordering api` asks you to confirm before any request that is not a `GET`.

## Before you start

You need:

1. **An Ordering.co project, and its project ID.** Open the [Dashboard MCP settings](https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens) and copy the **Server URL**: `https://api.ordering.co/mcp/<project ID>`. The part after `/mcp/` is your project ID (the docs also call it the project code).
2. **At least one key**, depending on what you want to do:
   - **MCP key:** in the same [MCP settings](https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens) (**Settings → Apps & developers → API & integrations → MCP (Claude Code & Codex)**). Accept the data notice, choose **read** scope, and copy the key: it is shown once.
   - **API key:** Dashboard → **Settings → Developers → API Keys → Add API key**.

   Creating keys requires an administrator, because Settings is limited to them. If you can't open Settings, ask your project administrator. Don't use someone else's key.
3. **`bash` and `curl`.** `jq` is recommended. macOS and Linux work as is; on Windows, use WSL or Git Bash.

## Option A: let your agent set it up

Fork or clone this repo, then start your agent from its folder with `./ordering claude` or `./ordering codex`, and paste this prompt. Until your keys are in place, the agent will report the `ordering` MCP server as failed. That is expected.

```text
Set up this repository so I can use Ordering.co. Follow AGENTS.md.
Create my .env from .env.example and tell me which values to fill in.
I will paste my keys into the file myself: never ask me to paste a key in this chat.
When I say I'm done, run ./ordering doctor and explain the result.
```

The agent will walk you through it. When it's done, quit and start the agent again with `./ordering claude` or `./ordering codex` so it loads the server. More prompts: [`prompts/`](prompts/).

## Option B: three commands

```bash
cp .env.example .env && chmod 600 .env   # then fill in your project and key(s)
./ordering doctor         # checks your project, keys, scope and expiry
./ordering claude         # start Claude Code with the Ordering MCP (or: ./ordering codex)
```

If you get `Permission denied`, run `chmod +x ordering` or use `bash ordering doctor`.

`./ordering doctor` tells you what works and what to fix:

```text
Project
  ✔ Project 'yourproject' found · language 'en' · from .env

MCP (AI agents)
  ✔ Connected as Jane Doe (administrator) · key ord_mcp_…ab12 from .env
  ✔ Scope: read
  ⚠ Key expires in 2 day(s), on 2026-10-13. Create a new one before then.

REST API (your code)
  ✔ API key …7a1d accepted (GET /orders) · from .env
```

### Why `./ordering claude` and not just `claude`?

Claude Code, Codex and Cursor read keys from **environment variables**, not from `.env`. `./ordering` loads your `.env` and then starts the tool, so you never put keys in your shell profile or in a config file. If you already export `ORDERING_*` variables in your shell, those win over `.env`.

Agents started this way get your MCP key but not your API key. When an agent runs `./ordering api`, the script reads the API key from `.env` and still asks you to confirm any write.

## Try it

With the MCP connected, ask your agent:

- *Who am I in Ordering?*
- *List my last 5 orders with their status and total.*
- *Which businesses are enabled in my project?*

With an API key, from your terminal:

```bash
./ordering api GET "/orders?orderBy=-id&page=1&page_size=5&mode=dashboard"
```

## Each client in detail

<details>
<summary><b>Claude Code</b></summary>

1. Run `./ordering claude` from this folder.
2. Approve the `ordering` server the first time Claude Code asks. It comes from this repo's `.mcp.json`.
3. Run `/mcp` inside Claude Code: `ordering` should show as connected.

Want Ordering in every folder, not only this one? Install it for your user, with the key read from your environment:

```bash
claude mcp add --transport http --scope user ordering \
  "https://api.ordering.co/mcp/<your-project>" \
  --header 'Authorization: Bearer ${ORDERING_MCP_KEY}'
```

Keep the single quotes so the key stays a variable reference.
</details>

<details>
<summary><b>Codex</b></summary>

Run `./ordering codex`. It passes the server to Codex on the command line, so there is nothing to edit.

To install it for your user instead:

```bash
codex mcp add ordering --url "https://api.ordering.co/mcp/<your-project>" \
  --bearer-token-env-var ORDERING_MCP_KEY
```

Then make sure `ORDERING_MCP_KEY` is exported wherever you start Codex.
</details>

<details>
<summary><b>Cursor</b></summary>

1. Install the `cursor` shell command (Command Palette → *Shell Command: Install 'cursor' command*).
2. Quit Cursor, then run `./ordering cursor` so Cursor starts with your `.env` loaded.
3. Open **Settings → MCP**: `ordering` comes from this repo's `.cursor/mcp.json`.

If Cursor was already open, it keeps its old environment. Quit it completely first.
</details>

<details>
<summary><b>VS Code</b></summary>

1. Open this folder in VS Code.
2. Open `.vscode/mcp.json` and select **Start** above the `ordering` server.
3. VS Code asks for your project ID and MCP key and stores them securely. No `.env` needed.
4. Use the tools from Copilot Chat in **Agent** mode.
</details>

## REST API

- **Base URL:** `https://api.ordering.co/v400/<language>/<project>/`, for example `https://api.ordering.co/v400/en/yourproject/orders`.
- **Auth:** `X-Api-Key: <your-api-key>`. Some operations take a session token instead (`Authorization: Bearer <token>` from `POST /auth`). Each operation's security block in the [API Reference](https://docs.ordering.co/api-reference/) says which.
- **Responses** use one envelope: `{"error": false, "result": …, "pagination": …}`. Check `error` as well as the HTTP status.

Ways to call it from this repo:

| Tool | How |
|---|---|
| Terminal | `./ordering api GET "/business?params=id,name&mode=dashboard"` |
| VS Code [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) | Open the files in [`requests/`](requests/). Start VS Code with `./ordering code` so they can read your `.env` |
| Postman or Insomnia | Import `https://docs.ordering.co/api-reference/openapi.json` |
| Your own code | `./ordering spec` downloads the OpenAPI spec to `spec/` for client generation |

## Security

- **Your `.env` is gitignored.** Keep it that way, especially in a public fork.
- **Use read scope** for everyday agent work. A write key lets an agent change real data. Keep your client set to ask before each tool call that writes.
- **Keys expire.** MCP keys last 7 days by default. `./ordering doctor` warns you before they do.
- **Never paste a key into an AI chat.** Paste it into `.env`.
- **If a key leaks,** delete it in the Dashboard right away and create a new one. See [SECURITY.md](SECURITY.md).

More: [docs/security.md](docs/security.md) · Problems: [docs/troubleshooting.md](docs/troubleshooting.md)

## What's in this repo

```text
ordering                 helper: doctor | claude | codex | cursor | code | api | spec
.env.example             template for your keys (copy to .env)
.claude/settings.json    stops Claude Code from reading .env
.gitleaks.toml           secret-scanning rules used by CI
.mcp.json                Claude Code MCP config
.cursor/mcp.json         Cursor MCP config
.vscode/mcp.json         VS Code MCP config
AGENTS.md, CLAUDE.md     instructions for AI agents working in this repo
requests/                ready-to-run REST API requests
prompts/                 prompts to paste into your agent
docs/                    credentials, security, troubleshooting
```

## Keep your fork up to date

```bash
git remote add upstream https://github.com/Finitless-com/ordering-dev-quickstart.git
git fetch upstream && git merge upstream/main
```

## Links

- [Developer docs](https://docs.ordering.co/docs/developers/) · [MCP guide](https://docs.ordering.co/docs/developers/mcp/) · [API Reference](https://docs.ordering.co/api-reference/) · [Docs index for LLMs](https://docs.ordering.co/llms.txt)
- Issues and ideas: [open an issue](../../issues). Contributions: [CONTRIBUTING.md](CONTRIBUTING.md).

Licensed under [MIT](LICENSE).
