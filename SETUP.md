# Setup runbook (for AI agents)

A developer asked you to connect them to the Ordering.co MCP. Follow these steps in order. Keep your messages short and friendly. Do the technical work yourself, and ask the developer only for what you can't do.

## Rules

- **Never ask for the MCP key in the chat, and never print or read `.env`.** The developer pastes the key into `.env` themselves. If they paste a key in the chat anyway, tell them to delete that key in the Dashboard and create a new one, because the transcript now contains it.
- The Server URL and the project ID are **not** secret. You may ask for them in the chat.
- Use `./ordering` for every change to `.env`. Never edit `.env` with your own tools.
- Never commit `.env`.

## 0. Check where you are running

- **Native Windows (PowerShell or cmd):** stop. Tell them to run their agent inside WSL or Git Bash and paste the prompt again.
- **A cloud or remote session** (not the developer's own computer): stop. Setup must run on the machine where they use Claude Code or Codex.
- **Codex:** steps 4 and 5 need network access and write access outside the workspace (`~/.zshrc`, `~/.codex/config.toml`). Ask for both before step 4.

## 1. Get the repo

Use `~/ordering-dev-quickstart`:

```bash
if [ -d ~/ordering-dev-quickstart/.git ]; then
  git -C ~/ordering-dev-quickstart pull --ff-only
else
  git clone https://github.com/Finitless-com/ordering-dev-quickstart.git ~/ordering-dev-quickstart
fi
```

If `~/ordering-dev-quickstart` exists but isn't a git repo, or the clone fails, stop and tell them what happened.

Your shell's working folder may reset between commands. **Start every command with `cd ~/ordering-dev-quickstart &&`.**

## 2. Ask for the Server URL

Send this, adapted to their language:

> 1. Open your MCP settings: https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens
> 2. Copy the **Server URL** and paste it here. It isn't secret.
> 3. On the same page, create a key: accept the data notice and choose **Read**. Keep the tab open, because the key is shown only once. Don't paste the key here.
>
> Can't open Settings? Only administrators can. Ask your project administrator.

## 3. Create `.env` and have them paste the key

Before you run this, tell them you're about to open a file for their key. Then run:

```bash
cd ~/ordering-dev-quickstart && ./ordering init "<the Server URL they pasted>"
```

`init` creates `.env`, sets the project from the URL, and opens the file in their text editor when it can. If it rejects the input, show its message and ask again.

Then tell them:

> I opened a file called `.env`. Paste your key right after `ORDERING_MCP_KEY=`, with no spaces or quotes. Save it and tell me when you're done.

If `init` couldn't open the file, give them the path it printed and the `nano` command.

## 4. Check the connection

```bash
cd ~/ordering-dev-quickstart && ./ordering doctor
```

Continue only if the MCP section shows **`✔ Connected as …`** and there are no `✘` lines.

- **`✘` lines:** explain each one in one sentence with its fix from `docs/troubleshooting.md`. Run `doctor` again after they fix it.
- **`No keys yet` or `ORDERING_MCP_KEY is empty`:** the file wasn't saved, or the key is on the wrong line.
- **`Scope: write`:** it works, but recommend a read key for everyday use.
- **Any other `⚠`:** look it up in `docs/troubleshooting.md`.

## 5. Install it for every folder

First tell them that this step will:
- add the `ordering` server to Claude Code and Codex for all their folders;
- add a small marked block to their shell startup file (for example `~/.zshrc`), so new terminals load the key from `.env`;
- be fully reversible with `./ordering uninstall`.

Then run:

```bash
cd ~/ordering-dev-quickstart && ./ordering install
```

If it prints `✘` or an unknown-shell warning, show them the manual command it printed.

## 6. Finish

Tell them, briefly and in their language:

> Ready.
> 1. Close this session and open a **new** terminal.
> 2. Start `claude` or `codex`.
> 3. Ask: **"Who am I in Ordering?"**
>
> Your key expires in <N> days. When it does, create a new key on the same page, paste it into `~/ordering-dev-quickstart/.env`, and open a new terminal. If anything fails, run `~/ordering-dev-quickstart/ordering doctor`.

Take `<N>` from the `doctor` output. If `doctor` printed no expiry, say "keys expire after 7 days by default".

Add only if it applies:
- **They use the desktop app** (started from the Dock or Start menu): it doesn't see the key. Start it from a terminal, or see `docs/manual-setup.md`.
- **Cursor or VS Code:** `docs/manual-setup.md`.
- **They want to call the REST API from code:** `docs/rest-api.md`.
