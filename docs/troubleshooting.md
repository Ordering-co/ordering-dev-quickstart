# Troubleshooting

Start with `./ordering doctor`. It names the problem; this page explains the fix.

## Project

**`Project '…' was not accepted` / `This project does not exist`**
`ORDERING_PROJECT` is wrong. It is lowercase with no spaces and is the last part of your MCP Server URL in the Dashboard.

**`Could not reach https://api.ordering.co`**
Check your internet connection, VPN or corporate proxy.

## MCP

**`Invalid MCP token`**
The key is wrong, expired or revoked, or it is an older key created before the data notice existed. Run `./ordering login` to get a new one. The manual alternative is to create a key in the Dashboard and replace `ORDERING_MCP_KEY` in `.env`.

## Sign-in (`./ordering login`)

**`Could not start the sign-in`**
The sign-in service on docs.ordering.co can't be reached. Use the manual path in [manual-setup.md](manual-setup.md).

**`Still waiting`**
You haven't finished in the browser yet. Finish there, then run `./ordering login wait`. The link lasts 10 minutes.

**`The sign-in link expired`**
Run `./ordering login` again.

**`could not be verified`**
The key that arrived wasn't created for your sign-in. Nothing was saved. Revoke keys you don't recognize in the Dashboard's MCP settings, then run `./ordering login` again.

**The page says you need administrator or business manager access**
Only those roles can create MCP keys. Ask your project administrator.

**The page says the notice is being updated**
The data notice changed and the page hasn't caught up yet. Try again later, or create the key in the Dashboard.

**`An MCP token is required`**
The key did not reach the server. Usually the agent was started without your `.env` loaded. Start it with `./ordering claude`, `./ordering codex` or `./ordering cursor`.

**Claude Code says `ORDERING_PROJECT` or `ORDERING_MCP_KEY` is missing**
The agent started before your `.env` was filled in, or without `./ordering`. Fill in `.env`, quit, and start again with `./ordering claude`.

**The agent doesn't show the `ordering` tools after `./ordering install`**
Open a **new** terminal: the terminal you used for setup doesn't have the key yet. Then start `claude` or `codex` again.

**The agent doesn't show the `ordering` tools**
- **Claude Code:** run `/mcp`. If `ordering` is pending, approve it. If it failed, quit and start again with `./ordering claude`.
- **Codex:** start it with `./ordering codex`; plain `codex` doesn't load this repo's server.
- **Cursor:** quit Cursor completely, then run `./ordering cursor`. A Cursor window that was already open keeps its old environment.
- **VS Code:** open `.vscode/mcp.json` and select **Start**. Tools appear in Copilot Chat in **Agent** mode only.

**The agent works in the terminal but not in a desktop app**
Desktop apps started from the Dock or Start menu don't read your `.env` or your shell profile. Start them from this folder with `./ordering`, or configure the key in the app's own settings.

**`Key belongs to project 'x', but ORDERING_PROJECT is 'y'`**
Each MCP key is tied to one project. Use the key from the project you want, or fix `ORDERING_PROJECT`.

**`Scope: write` warning**
Not an error. It reminds you that the agent can change real data. Use a read key unless you need writes.

**`Permission denied` when running `./ordering`**
The file lost its executable bit (common with ZIP downloads). Run `chmod +x ordering`, or use `bash ordering doctor`.

## REST API

**`401` with `"Permission denied"`**
Missing or wrong API key, or the key can't use that operation. Check `ORDERING_API_KEY` and the operation's security block in the [API Reference](https://docs.ordering.co/api-reference/).

**`ORDERING_API_KEY holds an MCP key`**
MCP keys (`ord_mcp_…`) and API keys are different. Put each in its own variable.

**`… needs confirmation at an interactive terminal`**
You, or an agent, ran a non-`GET` request without a terminal. Run it yourself in a terminal and type the project ID to confirm.

**`200` but an empty `result`**
The request worked but matched nothing. Check `where` filters, `mode`, and the `language` part of the URL (`ORDERING_LANG`).

**CORS error in the browser**
Call the API from your server, not from browser code. An API key in a web page is visible to anyone who opens it.
