# Contributing

Thanks for helping other developers get started with Ordering.co.

## Good contributions

- A step that confused you, rewritten so it wouldn't have.
- A fix for global client registration (Claude Code, Claude Desktop, Codex, Cursor, OpenCode, VS Code) that stopped working.
- A new read-only request in `requests/`, or a prompt in `prompts/` that worked well for you.
- A clearer message in `./ordering doctor` for a problem you ran into.

For larger changes, such as a new example language or a new client, open an issue first so we can agree on the approach.

## Rules

- **No keys, ever.** Not in code, configs, docs, issues or screenshots. CI scans every change for secrets.
- **Read-only data requests.** Keep executable HTTP data examples read-only. Authentication may create a session; write prompts must remain explicit templates with placeholders, live operation discovery and approval before execution. There is no automatic sandbox.
- **The login/API helper stays dependency-free:** bash 3.2+, `curl`, and `jq` or `python3`. Global installation additionally uses Node.js 22+ and npm; keep dependencies pinned in `client-installer/package-lock.json` and use `npm ci --ignore-scripts`.
- **Don't duplicate the API Reference.** Link to the operation instead of copying its parameters.

## Before opening a pull request

```bash
bash -n ordering
shellcheck ordering            # if you have it
./ordering doctor              # with your own .env
node tests/client-install.test.mjs  # after preparing .clients dependencies
bash tests/login.test.sh
bash tests/google-maps.test.sh      # fake gcloud, no Google account needed
```

Describe what you changed and how you tested it.

## Testing against a real project without touching your connection

Do this when a change needs a live check, for example `google-maps setup`. Use a test project, never a production one, and keep your everyday connection in `~/ordering-dev-quickstart` as it is:

1. Work in a separate checkout of this repo (a clone or `git worktree`). `.env` belongs to each checkout, so your main connection and the MCP registered in your clients stay untouched.
2. Sign in there without registering clients: `ORDERING_LOGIN_SKIP_PLUGIN=1 ./ordering login start`, then `ORDERING_LOGIN_SKIP_PLUGIN=1 ./ordering login wait`. Do not pass `--install`, and do not run `./ordering install` or `reset` there. Without `ORDERING_LOGIN_SKIP_PLUGIN`, `login wait` can update the legacy Claude Code plugin credential, which is global.
3. Outside `tests/google-maps.test.sh`, which puts a fake `gcloud` first in `PATH`, `./ordering google-maps` uses **your real `gcloud` and Google account**. Runs without `--yes` only read; `--yes` creates real projects, billing links and keys.
4. Afterwards revoke the test keys in the Dashboard (MCP settings and API Keys), delete the test checkout, and delete or keep the Google Cloud project `ordering-maps-<test project>` on purpose.
