# Manual setup

The [README](../README.md) prompt does all of this for you. Use this page to set things up by hand, or to connect Cursor or VS Code.

## What you need

- **Your project ID.** Open the [Dashboard MCP settings](https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens) and copy the **Server URL**: `https://api.ordering.co/mcp/<project ID>`.
- **An MCP key.** Create it on the same page: accept the data notice and choose **Read**. Only administrators can open Settings; if you can't, ask yours.
- **`bash`, `curl` and `git`.** `jq` is recommended. On Windows, use WSL or Git Bash.

## Claude Code and Codex

```bash
git clone https://github.com/Finitless-com/ordering-dev-quickstart.git ~/ordering-dev-quickstart
cd ~/ordering-dev-quickstart
cp .env.example .env && chmod 600 .env   # fill in ORDERING_PROJECT and ORDERING_MCP_KEY
./ordering doctor                        # checks project, key, scope and expiry
./ordering install                       # adds the server to Claude Code and Codex
```

Open a new terminal and start `claude` or `codex`. To undo it, run `./ordering uninstall`.

If you get `Permission denied`, run `chmod +x ordering` or use `bash ordering doctor`.

### What `install` changes

- **Claude Code:** adds a user-level `ordering` server whose header reads `Bearer ${ORDERING_MCP_KEY}`, so the key itself is never stored in Claude's config.
- **Codex:** adds an `ordering` server with `bearer_token_env_var = "ORDERING_MCP_KEY"`.
- **Your shell:** adds a marked block to `~/.zshrc`, `~/.bash_profile` or `~/.bashrc`, so new terminals load `ORDERING_PROJECT` and `ORDERING_MCP_KEY` from this repo's `.env`. Your REST API key is never loaded this way.

### Only in this folder, without `install`

```bash
./ordering claude    # Claude Code, using this repo's .mcp.json (approve it once)
./ordering codex     # Codex, with the server passed on the command line
```

### Without this repo

```bash
export ORDERING_MCP_KEY=...   # in your shell startup file, or a secrets file it loads
claude mcp add --transport http --scope user ordering \
  "https://api.ordering.co/mcp/<project ID>" \
  --header 'Authorization: Bearer ${ORDERING_MCP_KEY}'
codex mcp add ordering --url "https://api.ordering.co/mcp/<project ID>" \
  --bearer-token-env-var ORDERING_MCP_KEY
```

Keep the single quotes in the Claude command so the key stays a variable reference.

## Cursor

1. Install the `cursor` shell command (Command Palette → *Shell Command: Install 'cursor' command*).
2. Fill in `.env` as above, quit Cursor completely, and run `./ordering cursor`.
3. Open **Settings → MCP**: the `ordering` server comes from this repo's `.cursor/mcp.json`.

Cursor reads the key from its environment. If Cursor was already open, it keeps the old environment, so quit it first.

## VS Code

1. Open this folder in VS Code.
2. Open `.vscode/mcp.json` and select **Start** above the `ordering` server.
3. Enter your project ID and MCP key when asked. VS Code stores them securely, so you don't need `.env`.
4. Use the tools in Copilot Chat, in **Agent** mode.

## Desktop apps

Apps started from the Dock or Start menu don't read your shell startup file, so they don't see `ORDERING_MCP_KEY`. Start them from a terminal, or set the key in the app's own MCP settings.

## Keep your fork up to date

```bash
git remote add upstream https://github.com/Finitless-com/ordering-dev-quickstart.git
git fetch upstream && git merge upstream/main
```
