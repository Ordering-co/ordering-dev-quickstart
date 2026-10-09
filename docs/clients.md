# Clients, installation and credential lifecycle

The MCP server authorizes a selected operation catalog. This quickstart handles pairing, credentials, the stdio launcher and global registration; the optional [plugin](https://github.com/Finitless-com/ordering-mcp-plugin) provides a skill separately. It is not installed by `install`. There is no published `npx ordering` package.

## Requirements and coverage

Use macOS or Linux (including clients running inside WSL), Bash, curl, git and OpenSSL for browser pairing; jq or Python for diagnostics. Global installation also requires Node.js 22+ and npm. The locked adapters are `add-mcp 2.4.1`, `mcp-remote 0.14.3` and `jsonc-parser 3.3.1`. Git Bash is not verified for global installation. A remote session configures its terminal machine, not the computer used to open the browser.

| Client | Registration support | Verification boundary |
|---|---|---|
| Claude Code, Codex | Detected global native config | Fixture schemas; runtime and real calls must be checked in that client |
| Claude Desktop, Cursor, VS Code | Detected global native config | Fixture schemas; app reload/trust and authenticated tools remain separate |
| OpenCode 1 / 2 | Native JSONC schema; version 2 runtime activation | Fixtures cover migration, disabled/conflicting entries and removal; live calls require client verification |
| Other clients listed by `add-mcp` | Only when detected and supported by the locked adapter | Not a claim that every app or LLM was tested |
| Pi | Extra `pi-mcp-adapter` required | Skipped by this installer; not automatically connected |
| Native Windows desktop apps / cloud connectors | Not configured by the WSL/local installer | Use the client’s supported connection path; no blanket compatibility claim |

Tests verify configuration formats and mocked protocol behavior. They do not prove a GUI has loaded tools or read live data. For your actual machine, record OS/version and client/version, detection, config read-back, runtime state, a client-side `whoami` and permitted order read, and reload/trust still pending. Never publish raw identities, customer responses or credentials.

## Commands

| Command | Result / next action |
|---|---|
| `login start --client codex --install` | Prints a private pairing link/code; requests installation after successful claim |
| `login wait` | Claims and validates credentials, then installs if requested; collect final process/exit status |
| `login code` | Shows the current verification code privately; does not expose a key |
| `login --install` | Interactive pairing followed by registration; use for renewal |
| `doctor` | Checks project, MCP identity/scope/expiry and REST when configured; does not inspect every app runtime |
| `prepare` | Downloads locked launcher dependencies only; no global registration |
| `install` | Probes authentication and launcher, registers detected clients, reads configs back; nonzero means incomplete |
| `clients` | Reads recorded registrations; not a live call from each client |
| `mcp` | Stdio launcher used by clients, loading only the MCP credential privately |
| `uninstall` | Removes unchanged recorded launcher entries; credentials stay in `.env` |
| `logout` / `disconnect` | Removes integration then clears both local credentials; project stays; server keys remain valid |
| `reset --client codex --install` | Logout, new browser pairing and installation; without `--install`, registration is not requested |
| `api GET /orders?...` | Optional REST helper; uses the separate API credential |
| `api --yes METHOD PATH JSON` | Non-GET only after explicit approval of that exact method/path/project/body |
| `spec` | Saves the public OpenAPI contract to `spec/openapi.json`; inspect before selecting a REST operation |

## Existing installations and failures

Rerun `install` after credentials have been saved, to detect new clients or repair a partial download. It is idempotent for its own unchanged launcher entry. It preserves unrelated MCPs, malformed configs, disabled entries and collisions with unrelated servers named `ordering`. An existing HTTP Ordering entry can be migrated to the launcher after backup; existing per-tool policies require client-specific review. Backups under `.clients/backups/` are private and may contain other secrets; never upload them.

Global registration does not remove higher-precedence project configs. Inspect Claude local/project/user scopes or Codex project/user config for an older `ordering` entry; review that exact entry before migrating, and leave unrelated servers untouched. Old plugin-provided servers also need explicit migration. Running apps can cache tools/credentials: reload them after renewal, then call `whoami` inside each client you want to claim as verified.

After moving this checkout or its Node installation, rerun `install` so absolute paths are updated. OpenCode 2 needs runtime activation at the installation location and reconnect on renewal; a failure is reported as partial, even with valid JSONC. Do not restart shared OpenCode services to fix another session.

## Renewal, revocation and release dependency

Pairing defaults to MCP read and 30 days; manual MCP keys default to 7 days, currently up to 365. REST is a distinct option, checked by default, with broad permissions and no expiry. Uncheck it if unnecessary. Same-project REST credentials already present are retained with a warning; unchecking is not revocation.

Use `login --install`, collect the complete result, reload clients and verify identity before revoking the old MCP key. For a leak, revoke immediately. Revoke REST separately in API Keys. `uninstall`, `logout` and `reset` never revoke server keys.

The OpenCode 2 location and explicitly empty `.env` precedence corrections are tracked in [quickstart PR #5](https://github.com/Finitless-com/ordering-dev-quickstart/pull/5). At this documentation review, #5 is open, so a checkout without that fix must not be reported as passing disconnect with inherited shell keys or correct OpenCode location behavior. No history or client configuration is rewritten by this documentation update.

Without an ownership manifest, legacy Claude/Codex entries named Ordering are preserved; uninstall/logout/reset require review rather than deleting by name. The shell integration and credentials remain until that review succeeds. Logout also attempts to uninstall the installed Ordering Claude plugin, including skill-only versions; reinstall the optional skill if desired after reconnecting.

A legacy HTTP Ordering entry can migrate automatically only when its URL matches the verified project selected for this installation. Another project, an unknown target, or another launcher path is preserved as a conflict; review that specific connection before choosing to replace it.
