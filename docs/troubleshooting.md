# Troubleshooting

Start with `./ordering doctor`. It names the problem; this page explains the fix.

## Project

**`Project '…' was not accepted` / `This project does not exist`**
`ORDERING_PROJECT` is wrong. It is lowercase with no spaces and is the last part of your MCP Server URL in the Dashboard.

**`Could not reach https://api.ordering.co`**
Check your internet connection, VPN or corporate proxy.

## MCP

**`Invalid MCP token`**
The key is wrong, expired or revoked, or it is an older key created before the data notice existed. Run `./ordering login --install` to get a new one, then reload your client. The manual alternative is to create a key in the Dashboard and replace `ORDERING_MCP_KEY` in `.env`.

## Sign-in (`./ordering login`)

**`Could not start the sign-in`**
The sign-in service on docs.ordering.co can't be reached. Use the manual path in [manual-setup.md](manual-setup.md).

**`Still waiting`**
You haven't finished in the browser yet. Finish there, then run `./ordering login wait`. The link lasts 10 minutes.

**`The sign-in link expired`**
Run `./ordering login` again.

**`could not be verified`**
The key that arrived wasn't created for your sign-in. Nothing was saved. Revoke keys you don't recognize in the Dashboard's MCP settings, then run `./ordering login` again.

**The page asks for a code I don't have**
Ask your agent to run `./ordering login code`. It re-prints the current code and the minutes left, without opening the browser and without showing your key. If it says no sign-in is in progress, run `./ordering login` again.

**The page says you need administrator or business manager access**
Only those roles can create MCP keys. Ask your project administrator.

**The page says the notice is being updated**
The data notice changed and the page hasn't caught up yet. Try again later, or create the key in the Dashboard.

**`An MCP token is required`**
The key did not reach the server. Usually the agent was started without your `.env` loaded. Start it with `./ordering claude`, `./ordering codex` or `./ordering cursor`.

**Claude Code says `ORDERING_PROJECT` or `ORDERING_MCP_KEY` is missing**
The agent started before your `.env` was filled in, or without `./ordering`. Fill in `.env`, quit, and start again with `./ordering claude`.

**The browser says credentials were delivered, but installation failed**
Resume the pending `login wait` process and collect its final status. If credentials were saved, rerun `./ordering install`, then `./ordering clients`. Do not repeat login just for a registration failure.

**The agent does not show Ordering tools after installation**
`./ordering clients` checks configuration read-back. Reload/restart the intended client and inspect its MCP runtime (`/mcp` in Claude Code/Codex). Approve its normal trust prompt yourself. A global launcher loads its own key; opening a new terminal to inherit an exported key is unnecessary for this path. Cursor and VS Code need their normal MCP enablement, reload and trust; VS Code uses Copilot Agent mode. For folder-only setup, run `prepare`, then `claude` or `codex` through the helper.

**The launcher works but a desktop app does not**
Check that the app is on the same machine as the installer and that its entry points to this checkout. The absolute Node/launcher path supports Dock launches; moving the checkout or Node installation requires `install` again. WSL configures WSL clients, not native Windows apps. Cloud connectors do not read these local configs.

**Partial installation, name collision, disabled entry or malformed config**
Read each client result; unrelated MCPs and modified entries stay untouched. Do not delete them to force success. Resolve the named conflict or explicitly enable Ordering in the client, then retry `install`. Interrupted downloads are repaired by retry. Private backups are in `.clients/backups/` and can contain other clients' secrets; do not publish them. See [client lifecycle](clients.md).

**`Key belongs to project 'x', but ORDERING_PROJECT is 'y'`**
Each MCP key is tied to one project. Use the key from the project you want, or fix `ORDERING_PROJECT`.

**`Scope: write` warning**
Not an error. It reminds you that the agent can change real data. Use a read key unless you need writes.

**`Permission denied` when running `./ordering`**
The file lost its executable bit (common with ZIP downloads). Run `chmod +x ordering`, or use `bash ordering doctor`.

**I want to disconnect / start over**
Run `./ordering logout` (alias `disconnect`). It removes unchanged recorded launcher registrations and legacy integration, then clears both local MCP and REST credentials. Project settings remain. If removal fails, read the result, resolve it and retry; do not report a complete disconnect. Revoke server MCP and REST keys separately in Dashboard: neither logout nor uninstall revokes them. To pair and register again, run `./ordering reset --install`.

## REST API

**`401` with `"Permission denied"`**
Missing or wrong API key, or the key can't use that operation. Check `ORDERING_API_KEY` and the operation's security block in the [API Reference](https://docs.ordering.co/api-reference/).

**`ORDERING_API_KEY holds an MCP key`**
MCP keys (`ord_mcp_…`) and API keys are different. Put each in its own variable.

**`… needs confirmation`**
An agent ran a non-`GET` request without a terminal and without `--yes`. Either run it yourself in a terminal and type the project ID to confirm, or have the agent show you the exact request, get your yes in the chat, and run it again with `--yes`.

**`200` but an empty `result`**
The request worked but matched nothing. Check `where` filters, `mode`, and the `language` part of the URL (`ORDERING_LANG`).

**CORS error in the browser**
Call the API from your server, not from browser code. An API key in a web page is visible to anyone who opens it.
