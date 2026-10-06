# Setup runbook (for AI agents)

A developer pasted a prompt asking you to connect them to the Ordering.co MCP. Follow these steps in order. Keep your messages to the developer short and friendly. Do the technical work yourself; ask them only for what you can't do.

## Rules

- **Never ask for the MCP key in the chat, and never print it.** The developer pastes it into a file. If they paste it in the chat anyway, tell them to delete that key in the Dashboard and create a new one, because the transcript now contains it.
- The Server URL and the project ID are **not** secret. You may ask for them in the chat.
- Never commit `.env`. Never write a key into any file other than `.env`.

## 1. Get the repo

- If the current folder already contains `SETUP.md` and the `ordering` script, use it.
- Otherwise clone it into the home folder and work there:
  ```bash
  git clone https://github.com/Finitless-com/ordering-dev-quickstart.git ~/ordering-dev-quickstart
  ```
  If that folder already exists, run `git -C ~/ordering-dev-quickstart pull --ff-only` instead.

From here on, run every command from the repo folder.

## 2. Ask for the Server URL

Send the developer this, adapted to their language:

> 1. Open your MCP settings: https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens
> 2. Copy the **Server URL** and paste it here. It isn't secret.
> 3. While you're there, create a key: accept the data notice, choose **Read**, and keep the key handy. Don't paste the key here.
>
> Can't open Settings? Only administrators can. Ask your project administrator.

The Server URL looks like `https://api.ordering.co/mcp/<project ID>`. Take the part after `/mcp/` as the project ID: lowercase, no spaces.

## 3. Create `.env` and have them paste the key

```bash
[ -f .env ] || cp .env.example .env
chmod 600 .env
```

Set `ORDERING_PROJECT=<project ID>` in `.env` yourself, by editing that one line.

Then open `.env` for them:
- macOS: `open -t .env`
- Linux: `xdg-open .env`
- Otherwise, give them the full path.

Tell them:

> I opened a file called `.env`. Paste your key right after `ORDERING_MCP_KEY=`, with no spaces or quotes, save it, and tell me when you're done.

Don't read `.env` back into the chat.

## 4. Check the connection

```bash
./ordering doctor
```

- **No ✘ lines:** continue to step 5.
- **✘ lines:** explain each one in one sentence with its fix from `docs/troubleshooting.md`, then run `doctor` again after they fix it.
- **`Scope: write` warning:** tell them it works, but recommend a read key for everyday use.

## 5. Install it for every folder

```bash
./ordering install
```

This:
- registers the `ordering` MCP server for the user in Claude Code and in Codex (whichever is installed);
- adds a small marked block to their shell startup file so new terminals load the key from this repo's `.env`.

Tell them what it changed. `./ordering uninstall` reverses it.

If `install` reports an unknown shell or a client that failed, show the manual command it printed.

## 6. Finish

Tell them, briefly:

> Ready. Close this session, open a **new** terminal, start `claude` or `codex`, and ask: **"Who am I in Ordering?"**
>
> Your key expires in <N> days. When it does, create a new one in the same page, paste it into `<repo>/.env`, and that's it.

Take `<N>` from the `doctor` output, and use the real repo path.

Mention, only if relevant:
- **Cursor or VS Code users:** see `docs/manual-setup.md`.
- **Developers who want to call the REST API from code:** see `docs/rest-api.md`.
