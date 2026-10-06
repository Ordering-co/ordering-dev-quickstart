# Setup runbook (for AI agents)

A developer asked you to connect them to the Ordering.co MCP. Follow these steps in order. Keep your messages short and friendly. Do the technical work yourself, and ask the developer only for what you can't do.

## Rules

- **Never ask for the MCP key in the chat, and never print or read `.env`.** The key reaches the terminal encrypted, through `./ordering login`. If the developer pastes a key in the chat anyway, tell them to revoke it in the Dashboard and run the login again, because the transcript now contains it.
- The sign-in link and the code are for the developer only. Show them once and never post them anywhere else.
- Use `./ordering` for every change to `.env`. Never edit `.env` with your own tools.
- Never commit `.env` or `.login/`.

## 0. Check where you are running

- **Native Windows (PowerShell or cmd):** stop. Tell them to run their agent inside WSL or Git Bash and paste the prompt again.
- **Codex:** this setup needs network access, plus write access outside the workspace (`~/.zshrc`, `~/.codex/config.toml`). Ask for both before step 2.
- **A remote or cloud session works too.** The developer opens the link on any computer where they can sign in.

## 1. Get the repo

```bash
if [ -d ~/ordering-dev-quickstart/.git ]; then
  git -C ~/ordering-dev-quickstart pull --ff-only
else
  git clone https://github.com/Finitless-com/ordering-dev-quickstart.git ~/ordering-dev-quickstart
fi
```

If `~/ordering-dev-quickstart` exists but isn't a git repo, or the clone fails, stop and tell them what happened.

Your shell's working folder may reset between commands. **Start every command with `cd ~/ordering-dev-quickstart &&`.**

## 2. Sign in

Use `--client claude` if you are Claude Code, or `--client codex` if you are Codex.

```bash
cd ~/ordering-dev-quickstart && ./ordering login start --client claude
```

It prints a link and a code, and opens the browser when it can. Send both to the developer, adapted to their language:

> Open this link and sign in to Ordering.co with your Dashboard or Billing account: **<link>**
> When the page asks, type this code: **<code>**
> Read the data notice, keep **Read** access unless you need changes, and click Connect.

Then wait for them:

```bash
cd ~/ordering-dev-quickstart && ./ordering login wait
```

- **`Signed in. Key "…" saved`:** go to step 3. `wait` already ran `doctor`, so read its output.
- **`Still waiting`:** they haven't finished yet. Run `login wait` again. The link lasts 10 minutes.
- **`expired`, `cancelled` or `failed`:** run `login start` again.
- **`could not be verified`:** someone else's key arrived. Nothing was saved. Tell the developer to revoke unknown keys in the Dashboard (MCP settings), then run `login start` again.
- **`Could not start the sign-in`:** the sign-in service isn't available. Use the manual path below.

**On the page, the developer may see:**
- *"MCP isn't available for this project"* or *"you need administrator or business manager access"*: they need their project administrator.
- *"This notice is being updated"*: they should try again later or use the manual path.

### Manual path (only if login isn't available)

1. Ask for the **Server URL** from https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens. It isn't secret.
2. Run `cd ~/ordering-dev-quickstart && ./ordering init "<Server URL>"`. It opens `.env`.
3. Tell them to create a **Read** key on that page and paste it right after `ORDERING_MCP_KEY=`, then save.
4. Run `./ordering doctor`.

## 3. Check the connection

Continue only if `doctor` shows **`✔ Connected as …`** in the MCP section and there are no `✘` lines.

- **`✘` lines:** explain each one in one sentence with its fix from `docs/troubleshooting.md`.
- **`Scope: write`:** it works, but recommend Read for everyday use.

## 4. Install it for every folder

First tell them that this step will:
- add the `ordering` server to Claude Code and Codex for all their folders;
- add a small marked block to their shell startup file (for example `~/.zshrc`), so new terminals load the key from `.env`;
- be fully reversible with `./ordering uninstall`.

Then run:

```bash
cd ~/ordering-dev-quickstart && ./ordering install
```

If it prints `✘` or an unknown-shell warning, show them the manual command it printed.

## 5. Finish

Tell them, briefly and in their language:

> Ready.
> 1. Close this session and open a **new** terminal.
> 2. Start `claude` or `codex`.
> 3. Ask: **"Who am I in Ordering?"**
>
> Your key expires in <N> days. To renew it, run `~/ordering-dev-quickstart/ordering login`, sign in again and open a new terminal.

Take `<N>` from the `doctor` output.

Add only if it applies:
- **They use the desktop app** (started from the Dock or Start menu): it doesn't see the key. Start it from a terminal, or see `docs/manual-setup.md`.
- **Cursor or VS Code:** `docs/manual-setup.md`.
- **They want to call the REST API from code:** `docs/rest-api.md`.
