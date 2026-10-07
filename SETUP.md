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

**The developer cannot see your tool output.** It prints a `TELL THE USER` block with a link and a code, and does not open a browser itself. Your reply MUST include both the link and the code from that block, in the same message, adapted to their language. Do not open the browser yourself: the developer opens the link.

> Open this link and sign in to Ordering.co with your Dashboard or Billing account: **<link>**
> When the page asks, type this code: **<code>**
> Read the data notice, keep **Read** access unless you need changes. If you also want me to call the REST API for you, leave **"Also give my agent the REST API"** checked: it is on by default, gives full access with your permissions, and never expires. Uncheck it if you only want the MCP. Then click Connect.

If the developer later says the page is asking for a code they don't have (it scrolled away, or they came back later), run `cd ~/ordering-dev-quickstart && ./ordering login code` and tell them the code it prints. Never print or guess the key itself.

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
- in Claude Code, install the official Ordering plugin (the MCP server plus a skill that knows the platform), with the key stored in the system keychain;
- in Codex, add the `ordering` server for all their folders;
- add a small marked block to their shell startup file (for example `~/.zshrc`), so new terminals load the key from `.env`;
- be fully reversible with `./ordering uninstall`.

Then run:

```bash
cd ~/ordering-dev-quickstart && ./ordering install
```

If it prints `✘` or an unknown-shell warning, show them the manual command it printed.

## 5. Finish

This is the moment they should feel it working: give them a concrete menu, not just an invitation to ask something. Tell them, briefly and in their language, as ready-to-copy lines (keep the whole menu to about 8 lines):

> Ready. Close this session, open a **new** terminal, start `claude` or `codex`, and try one of these:
>
> - Who am I in Ordering?
> - How many orders came in today, by status?
> - Show my last 5 orders with customer, business and total.
> - Which of my businesses are open right now?
> - What are the best-selling products this week?

If `doctor` in step 3 showed **`Scope: write`**, also offer 2-3 of these, and say you'll always ask for confirmation before making any change:

> - Change order #<id> to \<status\>.
> - Close \<business\> for today, or open it again.
> - Snooze \<product\> until tomorrow.
> - Change the price of \<product\> to \<price\>.

Then add:

> Your key expires in <N> days. To renew it, run `~/ordering-dev-quickstart/ordering login`, sign in again and open a new terminal.

Take `<N>` and the scope from the `doctor` output in step 3.

Add only if it applies:
- **They use the desktop app** (started from the Dock or Start menu): it doesn't see the key. Start it from a terminal, or see `docs/manual-setup.md`.
- **Cursor or VS Code:** `docs/manual-setup.md`.
- **They want to call the REST API from code:** `docs/rest-api.md`.

## If they checked "Also give my agent the REST API"

`doctor` in step 3 will show `✔ API key … accepted` in its REST API section. From here on, reach the REST API only through `~/ordering-dev-quickstart/ordering api`, never with a raw `curl` using the key:

- `GET` runs freely.
- Before any other method, show the developer the exact method, path, a summary of the body, and the project, and wait for an explicit yes in the chat. Only then run the same request again with `--yes` (it can go anywhere after `api`), for example `./ordering api --yes POST /orders/123/status '{"status":5}'`.
- When the MCP can't do something, find the operation in the OpenAPI spec (`./ordering spec`, then search `spec/openapi.json` with `jq`), explain it, and offer the REST call before running it.

## Disconnect or reset (only if the developer asks)

If they ask to disconnect, log out, start over, or say their key stopped working:

```bash
cd ~/ordering-dev-quickstart && ./ordering logout
```

This removes the `ordering` server from Claude Code and Codex, removes the shell block, and clears `ORDERING_MCP_KEY` from `.env` (their project stays set). It prints the key's name and a Dashboard link. **The key still works until they revoke it there**, so tell them to revoke it if they're disconnecting because of a leak, a lost device, or offboarding.

To connect again right after (a new key, or after revoking the old one):

```bash
cd ~/ordering-dev-quickstart && ./ordering reset --client claude
```

`reset` runs `logout` and then the same sign-in as step 2: expect another `TELL THE USER` block, and follow it the same way.
