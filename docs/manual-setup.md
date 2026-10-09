# Manual setup

The [README](../README.md) prompt does all of this for you. Use this page to set things up by hand, or to connect Cursor or VS Code.

**Fastest by hand:** `./ordering login` signs you in through your browser and saves the key, with no copy-paste. Use `./ordering login --install` to also register detected MCP clients globally. Node.js 22+ and npm are required for installation. The steps below are for creating the key yourself.

## What you need

- **Your project ID.** Open the [Dashboard MCP settings](https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens) and copy the **Server URL**: `https://api.ordering.co/mcp/<project ID>`.
- **An MCP key.** Create it on the same page: accept the data notice and choose **Read**. Only administrators can open Settings; if you can't, ask yours.
- **`bash`, `curl` and `git`.** `jq` is recommended. On Windows, use WSL or Git Bash.

## Global registration in detected MCP clients

```bash
git clone https://github.com/Finitless-com/ordering-dev-quickstart.git ~/ordering-dev-quickstart
cd ~/ordering-dev-quickstart
./ordering init "<Server URL>"           # creates .env with your project; paste your key in it
./ordering doctor                        # checks project, key, scope and expiry
./ordering install                       # verifies the launcher and registers detected clients globally
```

Restart/reload running clients and open a new chat. To undo it, run `./ordering uninstall`.

If you get `Permission denied`, run `chmod +x ordering` or use `bash ordering doctor`.

### What `install` changes

The installer uses a locked version of [add-mcp](https://github.com/neon-solutions/add-mcp) to register Ordering in detected clients' user configurations. Supported formats include Claude Code, Claude Desktop, Codex, Cursor, OpenCode, VS Code and the other clients supported by that adapter. Pi additionally needs `pi-mcp-adapter` and is not automatically registered.

All clients launch the same `./ordering mcp` command. The helper loads the key from this checkout's private `.env` and connects through a locked [mcp-remote](https://github.com/punkpeye/mcp-remote) proxy. No key is copied into client configs or process arguments. The REST API key is not passed to the MCP proxy. The absolute Node path is saved so desktop apps do not depend on your terminal's PATH or shell environment.

The installer verifies authentication and the stdio launcher before editing configs, then reads back each registration. It preserves unrelated servers and settings and stores private config backups under `.clients/backups/`. A name collision or malformed config produces a partial result and a nonzero exit status. Use `./ordering clients` to check registration; this does not prove a running client has reloaded its tools.

Keep the checkout in the installation location. After moving it or changing your Node installation, rerun `./ordering install`. Rerunning install picks up newly installed clients. Running clients need restart/reload and their normal MCP trust approval.

The CLI equivalent provided by add-mcp is `npx add-mcp … -g`: `-g` means user-wide registration. We use its programmatic API to pass the launcher as structured data and keep credentials out of arguments. `npx skills add` installs skills separately; it does not complete MCP authentication.

### Only in this folder, without global registration

```bash
./ordering prepare   # prepares the launcher (Node.js 22+ and npm)
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

## Cursor, VS Code and OpenCode

Run `./ordering install` and confirm each client's result. Global registration works outside the quickstart folder. Restart running apps or reload their MCP settings, then try “Who am I in Ordering?”. VS Code must have MCP/Copilot enabled for the client to use the registered server. Policies or trust prompts are respected.

The checked-in `.mcp.json`, `.cursor/mcp.json` and `.vscode/mcp.json` use the same launcher inside the quickstart folder, so they cannot shadow the global server with a missing environment key. Run `./ordering prepare` first when using only these local configs.

## Desktop apps

The registered launcher loads its own key and uses absolute paths, so launching from the Dock is supported. Apps still need reload/restart to see newly registered tools. The WSL path targets clients running in WSL, not native Windows desktop apps. Cloud-only ChatGPT and other hosted assistants do not read your local client configs; this installer does not register remote cloud connectors.

## Disconnect or reset

```bash
./ordering logout      # alias: disconnect
```

Removes unchanged Ordering registrations from the recorded clients (and any legacy shell block), and clears `ORDERING_MCP_KEY` from `.env` (your project ID stays). It prints the key's name and a link to the Dashboard's MCP settings, where you can revoke it. **The key keeps working until you revoke it there**: `logout` only stops using it here.

`./ordering uninstall` does the same to Claude Code, Codex and your shell, but leaves `.env` and your key alone.

To sign in again right after, with a new key or after revoking the old one:

```bash
./ordering reset --client claude   # logout, then the same sign-in as ./ordering login
```

## Keep your fork up to date

```bash
git remote add upstream https://github.com/Finitless-com/ordering-dev-quickstart.git
git fetch upstream && git merge upstream/main
```
