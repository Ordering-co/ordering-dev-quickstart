# Security

## There is no sandbox

The REST API, the MCP server and the API Reference's **Test Request** button all work on your real project. Creating, updating or deleting data is immediate and real.

What this repo does about it:

- Every example is read-only.
- `./ordering api` refuses `POST`, `PUT`, `PATCH` and `DELETE` unless a person confirms: either by typing the project ID at an interactive terminal, or by an agent passing `--yes` after the person approved that exact request in the chat (the agent prints a one-line `CONFIRMED` audit line to stderr first). This stops accidental writes from agents and scripts. It is a guardrail, not a security boundary: anyone holding the key can call the API directly.
- Agents started with `./ordering claude` or `./ordering codex` don't receive the API key in their environment, and `.claude/settings.json` denies Claude Code access to `.env`. They can still use the REST API through `./ordering api`, which reads the key from `.env` itself at request time: the raw key never has to reach the agent's own environment.
- `AGENTS.md` tells agents to change data only through the MCP, or through `./ordering api` after you approve the exact request in the chat, never with a raw `curl` and the key. Keep your client set to ask before tool calls that write.

## Keys

- `.env` is in `.gitignore`. Never remove that line, and never force-add `.env`.
- MCP config files contain launcher paths, never keys. The helper loads the MCP key from private `.env` at runtime; the REST API key is removed before the MCP proxy starts. Private client configuration backups live in ignored `.clients/backups/`; never commit that directory.
- Never paste a key into an AI chat, an issue, a screenshot or a support ticket. The chat transcript keeps it.
- Use read-scoped MCP keys for everyday work, and short expiries for write keys.
- Keep API keys on servers. Never ship them in a website, a mobile app or any client-side code.
- **API keys have no scope and never expire.** They act with your full permissions until you revoke them in the Dashboard (Settings → Developers → API Keys). MCP read does not limit a REST key. Uncheck the REST option during pairing if it is not needed; revoke REST and MCP credentials independently in the Dashboard.

## If a key leaks

1. Delete it in the Dashboard immediately: MCP keys in **Apps & developers → API & integrations → MCP**, API keys in **Developers → API Keys**.
2. Run `./ordering login --install` for a replacement, review permissions, wait for the terminal result and reload your client. For manual credentials, use the private editor opened by `./ordering init`. Never put a replacement in chat or command arguments.
3. If it was committed to git, deleting the commit is not enough: the key is already exposed. Revoking it in step 1 is what protects you.
4. Review recent activity in your project for changes you don't recognize.

## Prompt injection

An AI agent reads data from your project: product descriptions, customer notes, order comments. Text in that data can try to instruct the agent. Read scope limits the damage. With a write key, review every write your client asks you to approve, and don't approve changes you didn't ask for.

To report a vulnerability, see [SECURITY.md](../SECURITY.md).
