# Setup runbook (for AI agents)

A developer asked you to connect them to the Ordering.co MCP. Follow these steps in order. Keep your messages short and friendly. Do the technical work yourself, and ask the developer only for what you can't do.

## Rules

- **Never ask for the MCP key in the chat, and never print or read `.env`.** The key reaches the terminal encrypted, through `./ordering login`. If the developer pastes a key in the chat anyway, tell them to revoke it in the Dashboard and run the login again, because the transcript now contains it.
- The sign-in link and the code are for the developer only. Show them once and never post them anywhere else.
- Use `./ordering` for every change to `.env`. Never edit `.env` with your own tools.
- Never commit `.env` or `.login/`.

## 0. Check where you are running

- **Native Windows (PowerShell or cmd):** stop. Tell them to run their agent inside WSL and paste the prompt again. Git Bash may run the Bash login helper, but its global installer/desktop integration is not verified.
- This setup registers Ordering globally in detected MCP clients, including desktop apps. Before step 2, explain the scope: a login plus client configuration, using the scope the person chooses. In Codex, request network and outside-workspace writes through its approval system as needed.
- Global installation requires Node.js 22+ and npm. Detect those before starting. If missing, the login can still save credentials, but do not promise installed clients. Do not install unrelated software or approve write tools automatically.
- **A remote or cloud session configures the machine running this terminal.** The developer can sign in from another computer, but their laptop and native desktop apps are not configured automatically. Run the installer on the machine that hosts the intended client. WSL targets clients inside WSL, not native Windows desktop apps; Git Bash is not verified for global installation.

## 1. Get the repo

For a new location:

```bash
git clone https://github.com/Ordering-co/ordering-dev-quickstart.git ~/ordering-dev-quickstart
```

If that directory already exists, inspect its Git root, origin, branch and working-tree state first. Reuse the expected Quickstart checkout and preserve its changes. Do not expose credentials embedded in a remote URL, change its remotes, reset, stash or switch branches automatically. If it is not the expected repository, or is a symlink/collision you cannot safely identify, leave it intact and agree on a different location.

A clean Quickstart checkout on `main`, with the expected canonical remote and no competing session, may be updated to obtain the current helper:

```bash
git -C ~/ordering-dev-quickstart fetch origin main
git -C ~/ordering-dev-quickstart merge --ff-only origin/main
```

A dirty, divergent or custom-branch checkout stays untouched. Explain the specific state and agree on a safe update if one is needed; do not claim commands from a newer release exist in an older checkout. This safe Quickstart update is separate from the downloaded product checkouts: `repos clone` never fetches or pulls an existing product.

Your shell's working folder may reset between commands. **Start every command with `cd ~/ordering-dev-quickstart &&`.**

## 2. Sign in

Use `--client claude` if you are Claude Code, or `--client codex` if you are Codex.

```bash
cd ~/ordering-dev-quickstart && ./ordering login start --client claude --install
```

**The developer cannot see your tool output.** It prints a `TELL THE USER` block with a link and a code, and does not open a browser itself. Your reply MUST include both the link and the code from that block, in the same message, adapted to their language. Do not open the browser yourself: the developer opens the link.

> Open this link and sign in to Ordering.co with your Dashboard or Accounts (Billing) account: **<link>**
> When the page asks, type this code: **<code>**
> Read the data notice, keep **Read** access unless you need changes. If you also want me to call the REST API for you, leave **"Also give my agent the REST API"** checked: it is on by default, gives full access with your permissions, and never expires. Uncheck it if you only want the MCP. Then click Connect.

If the developer later says the page is asking for a code they don't have (it scrolled away, or they came back later), run `cd ~/ordering-dev-quickstart && ./ordering login code` and tell them the code it prints. Never print or guess the key itself.

Then wait for them:

```bash
cd ~/ordering-dev-quickstart && ./ordering login wait
```

- **`Signed in … Key "…" saved`:** authentication completed. With `--install`, `wait` then verifies the MCP launcher and registers detected clients. Read the **final process result**, not just the first success line.
- If your tool returned a running process/session ID, keep it and collect its completion even when the conversation turns to another issue. A browser confirmation does not cancel the pending terminal result. If the person says they completed the page, resume that process before starting a new pairing.
- **`MCP authenticated, launcher verified, and detected clients registered`:** installation completed. Go to step 3.
- A nonzero install result after credentials were saved means **authentication succeeded, installation is partial**. Explain the specific client failure and rerun `./ordering install`; never repeat login solely for a missing registration.
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
4. Run `./ordering doctor`, then `./ordering install` when the identity check passes. Follow steps 4–5 and observe `whoami` inside the intended client.

## 3. Check the connection

```bash
cd ~/ordering-dev-quickstart && ./ordering doctor
```

`doctor` tests the helper, not a call from the running client. Continue only if `doctor` shows **`✔ Connected as …`** in the MCP section and there are no `✘` lines.

- **`✘` lines:** explain each one in one sentence with its fix from `docs/troubleshooting.md`.
- **`Scope: write`:** it works, but recommend Read for everyday use.

## 4. Verify registration in every detected client

`login start --install` already chains installation after credential delivery. The installer uses the locked `add-mcp` adapter to detect global clients and register the same Ordering stdio launcher in each native configuration. It tests that launcher with `initialize`, `tools/list` and `whoami`, including a desktop-like environment without shell key variables.

- Run `cd ~/ordering-dev-quickstart && ./ordering clients` and require every registered client to pass read-back verification.
- If `wait` did not install, or any registration failed, run `cd ~/ordering-dev-quickstart && ./ordering install`, then check its complete output and exit status.
- Report each detected client's result. Clients not detected are not installed. Pi needs its MCP adapter and is reported separately; never describe it as connected.
- Existing unrelated servers and settings stay in place. Another server named `ordering` with an unrelated endpoint is a conflict; do not delete or replace it.
- Each client launches `./ordering mcp`, which reads credentials through the existing helper. Configs hold an absolute command path, never a literal key. Applications opened from the Dock do not require a shell-exported key. Keep this checkout in its installation location; moving it requires rerunning install.
- Running clients still need restart/reload and may ask for trust when they discover a new MCP. Do not bypass that trust prompt or claim tools are live in the current chat before observing them.
- Undo registration with `./ordering uninstall`. It removes only unchanged entries owned by this launcher and preserves `.env`.

## 5. Finish

This is the moment they should feel it working: give them a concrete menu, not just an invitation to ask something. Tell them, briefly and in their language, as ready-to-copy lines (keep the whole menu to about 8 lines):

> Registration verified. Restart your running client (or reload its MCP settings), open a new chat, and try one of these:
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

> Your key expires in <N> days. To renew it, run `~/ordering-dev-quickstart/ordering login --install`, sign in again and reload your client.

Take `<N>` and the scope from the `doctor` output in step 3. The browser pairing defaults to 30 days, whereas manually created MCP keys default to 7; both are capped by the server (currently 365).

Only report a client as connected after its own runtime discovers the tools and completes `whoami`. Use `search_operations` → `describe_operation` → `read_operation` for a permitted, minimal order query; an empty list is valid. Never treat the launcher probe or `clients` read-back as proof of every app. Record the client/version, registration, runtime, authenticated call and any reload/trust still needed. See [clients.md](docs/clients.md).

Add only if it applies:
- **Desktop app:** restart/reload to discover the new server. The global launcher loads the key itself; no terminal launch is required. Native Windows still uses the documented WSL path.
- **Cursor or VS Code:** `docs/manual-setup.md`.
- **They want to call the REST API from code:** `docs/rest-api.md`.

## 6. Offer the seven products, then ask what to run

After the connection checks above pass, offer this **once**, in the developer's language:

> Would you also like me to download all seven Ordering products into `~/ordering-products` so you do not have to clone them one by one?

Accept or skip; respect an applicable answer already given in this conversation. Do not put this question inside `login wait`, `install`, or another pending terminal process. Collect the existing install result before starting this separate task. Skipping does not undo or make the connection incomplete. Product setup does not require another MCP connection, Context7 registration or sign-in.

If they accept:

1. Confirm the destination and use `./ordering repos clone --all --directory ~/ordering-products`. New clones include the six products' pinned SDK submodules. Existing verified checkouts are preserved; inspect the per-product summary and explain any conflict or partial failure.
2. Reuse the project identity verified by the current Ordering connection and confirm its slug with the developer. If no usable connection is available, accept their explicitly supplied authorized project slug; code download and public configuration also work without Ordering login. Never read `.env` to discover it or copy an agent credential into a product.
3. **Configure all seven by default. Do not ask which product to configure first.** Use `./ordering repos configure --all --directory ~/ordering-products --project CONFIRMED_PROJECT`. For the two franchise products, reuse an already explicitly chosen, validated selection; if one is missing or ambiguous, ask **one franchise question for both surfaces**, then supply `--franchise-slug CONFIRMED_FRANCHISE`. Never select the first result. Existing project/franchise changes require explicit confirmation; use `--confirm-project-change` only within that confirmed scope. Missing data or helper failures mean a partial result, not seven configured products.
4. Only after configuration, ask **which products to run in localhost**, recommending **Website Marketplace and Dashboard together**. Follow the selected products' exact runbooks and install dependencies/start only those selected. Do not launch the other five or install every app's dependencies as part of configuration. Explain any native prerequisite or unavailable platform before claiming an app runs.

Follow [docs/products.md](docs/products.md) for the catalogue, commands, safe repetition and recovery. Report connection, cloning, configuration and running as separate outcomes. A public `doctor` result does not prove project membership, a consumer login, native launch or real orders.

## 7. Optional, recommended: Context7 documentation

After steps 3–5 have verified Ordering and provided the first-query menu, recommend Context7 for developers writing code with AI. Explain that it searches documentation while Ordering's MCP operates on their connected project. Follow [docs/context7.md](docs/context7.md).

- If Context7 already works in the chosen client, reuse it and verify the two libraries below. Do not install a duplicate server.
- Otherwise offer it once: “Would you also like Context7 to look up Ordering's API Reference and REST/MCP guides while we code?” If they decline, complete Ordering setup. If they already explicitly requested this setup, proceed within that request.
- Explain which client/configuration paths will change. Prefer project scope and OAuth. Some clients have only global MCP settings; agree on that scope before writing them.
- From the installation folder, run `npx ctx7 setup --mcp --oauth --project`. Target only the agreed client (`--claude` or `--codex` when applicable); let the developer complete sign-in and any client trust prompts. Preserve the existing Ordering entry and instructions, and check the reported paths after setup. Keep credentials out of the repo and chat.
- Reload the client and confirm Context7's `resolve-library-id` and `query-docs` tools are available. A successful setup command or Ordering's `doctor`/`clients` output alone does not prove Context7 is usable in the running chat.
- Query `/openapi/ordering_co_api-reference_openapi_json` for `GET /usage_limits` and `/llmstxt/ordering_co_llms-small_txt` for MCP installation and permissions. Require returned documentation to cite `https://docs.ordering.co/`; for the API answer check the exact method/path against `./ordering spec`. Querying these libraries does not require a call to the developer's Ordering data.
- If Context7 setup or either documentation query fails, report that result separately and continue using the public API Reference and docs. The verified Ordering connection remains usable.

## 8. Optional: their own Google Maps key

Maps, address autocomplete and delivery distances in the products need `google_maps_api_key`. This step guides the person to create it in their own Google Cloud account and saves it in the project they just connected: it reuses `ORDERING_PROJECT` and the REST credential from step 2, so it never needs another Ordering sign-in. Follow [docs/google-maps.md](docs/google-maps.md).

After the steps above are verified, offer it once: “Would you also like me to set up your own Google Maps key? You only sign in to Google in your browser, and Google bills Maps usage to you.” Respect a decline or an earlier answer. If the person arrives already connected and asks for it, start here.

1. **Connection:** `./ordering doctor` must show the project and `✔ API key … accepted`. If the REST credential is missing (the box was unchecked), explain that it is needed to save the key and offer `./ordering reset`, keeping the REST box checked.
2. **Google Cloud CLI:** check `gcloud --version`. If it is missing, offer to install it (`brew install --cask gcloud-cli` on macOS with Homebrew, otherwise the [official installer](https://cloud.google.com/sdk/docs/install)) and install it only after a yes.
3. **First run, no changes:** `./ordering google-maps setup`. Run it in the background when it may wait for Google sign-in. If it prints a Google sign-in link, tell the person to sign in **on the computer running this terminal** (the link returns to `localhost` there) with the Google account that should own and pay for the key, and relay the link only to them.
4. **Check the Google account:** read `Signed in as …` back to the person. If it is not the account they meant, have them run `gcloud auth login` (as `! gcloud auth login` in Claude Code), choose the right one, and repeat step 3.
5. **If it exits 3, guide billing:** with no billing account, tell them to open the link it printed, create a billing account (country, payment card and a recognizable name; Google includes monthly free usage per API), then say “done” so you repeat step 3. With several, show the `ID  Name` list and ask which one to use for `--billing-account`; a name they gave you counts as the choice. Never choose for them.
6. **Confirm:** run step 3 again with the agreed `--billing-account` and, if the project already has a key, `--replace`; it prints the “This will” summary and stops. New projects usually come with a key, so the summary says `replace google_maps_api_key …abcd`. Show the summary in their language, say which key it replaces, and wait for an explicit yes. Then run the same command with `--yes`.
7. **Report** what the command reported: project, billing link, enabled APIs, any legacy API warning, and `Saved as google_maps_api_key … (read back)`. Exit 1 after the key was created only needs a rerun. Never print or fetch the key.

## If the REST API checkbox stayed checked (the default)

`doctor` in step 3 will show `✔ API key … accepted` in its REST API section. From here on, reach the REST API only through `~/ordering-dev-quickstart/ordering api`, never with a raw `curl` using the key:

- `GET` runs freely.
- Before any other method, show the developer the exact method, path, a summary of the body, and the project, and wait for an explicit yes in the chat. Only then run the same request again with `--yes` (it can go anywhere after `api`), for example `./ordering api --yes PUT '/orders/<order-id>' '{"status":7}'`.
- When the MCP can't do something, find the operation in the OpenAPI spec (`./ordering spec`, then search `spec/openapi.json` with `jq`), explain it, and offer the REST call before running it.

## Disconnect or reset (only if the developer asks)

If they ask to disconnect, log out, start over, or say their key stopped working:

```bash
cd ~/ordering-dev-quickstart && ./ordering logout
```

This removes unchanged Ordering registrations from the recorded clients (and any legacy shell block), and clears both `ORDERING_MCP_KEY` and `ORDERING_API_KEY` from `.env` (their project stays set). It prints the key's name and a Dashboard link. **The key still works until they revoke it there**, so tell them to revoke it if they're disconnecting because of a leak, a lost device, or offboarding.

To connect again right after (a new key, or after revoking the old one):

```bash
cd ~/ordering-dev-quickstart && ./ordering reset --client claude --install
```

`reset` runs `logout` and then the same sign-in as step 2: expect another `TELL THE USER` block, and follow it the same way.

### OpenCode 2 activation

The installer selects the native `mcp.servers` schema for OpenCode 2, preserving comments and unrelated config. It also registers Ordering in the native runtime at this installation location through OpenCode’s official API, then requires `ordering — connected` in its status. This avoids restarting the shared service or interrupting other sessions. Global config remains available to other project locations; existing chats may still need their normal MCP reload. A native activation failure is reported as partial installation, even when the config file is correct.

### Recovering partial installation

An interrupted dependency download is never marked ready. Rerun `./ordering install`: it repairs missing runtime modules before probing or registering clients. A disabled Ordering entry is preserved and reported as incomplete; enable it explicitly in that client before retrying. Detecting only a client that needs an additional adapter does not count as successful installation.

Uninstall verifies removal of the launcher-owned OpenCode 2 runtime before removing its config. If runtime removal fails, the entry is kept for retry. Successfully removed clients are cleared from the registration record even when another client is still pending. Changed or unreadable entries remain untouched. Reload other running clients to drop their cached tools; server credentials remain valid until revoked in the Dashboard.

After OpenCode registration, the installer explicitly reconnects its Ordering process so a renewed key is loaded even when the command did not change. Other running clients require their normal reload after key renewal.

Without `.clients/installed.json`, legacy native Ordering entries are preserved and uninstall/logout/reset stop for review. Resolve only the intended entry in the client; never delete another session’s server to force success.
