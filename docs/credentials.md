# Credentials

Ordering.co uses three kinds of credentials. They are not interchangeable.

| | MCP key | API key | Session token |
|---|---|---|---|
| **For** | AI agents through MCP | Your code calling the REST API | Acting as a logged-in user |
| **Looks like** | `ord_mcp_…` | Alphanumeric string | JWT |
| **Sent as** | `Authorization: Bearer <key>` to `https://api.ordering.co/mcp/<project>` | `X-Api-Key: <key>` | `Authorization: Bearer <token>` |
| **Created in** | Dashboard → Settings → Apps & developers → API & integrations → MCP | Dashboard → Settings → Developers → API Keys | `POST /auth` with the user's email and password |
| **Scope** | `read` or `write`, chosen at creation | Broad permissions of the issuing user; not restricted by MCP read | The user's own permissions |
| **Expires** | 7 days by default, up to 365 | Until you delete it | Per session |
| **Variable in `.env`** | `ORDERING_MCP_KEY` | `ORDERING_API_KEY` | Not stored. Get one when you need it |

## Which one should I use?

- **Exploring or operating with an AI agent:** MCP key with **read** scope. Create a separate write key only when you need it, with a short expiry.
- **A server-side integration** (ERP, CRM, reporting, your own backend): API key, kept on the server and never shipped to a browser or a mobile app.
- **An app where your customers log in:** session tokens from `POST /auth`, one per user.

## Rotating or disconnecting

For MCP credentials saved by this quickstart, run `./ordering login --install`, complete browser sign-in and permission review, then collect the terminal's final result. If credentials were saved but registration failed, retry `./ordering install`. Reload running clients and observe `whoami` again. A login without `--install` only updates credentials; existing launcher paths use the new value on their next start, while a running process can keep the old one.

The browser defaults to 30 days; manual MCP key creation defaults to 7, currently up to 365. Read the actual scope and expiry with `doctor` and the client’s `whoami`.

The REST option is checked by default and creates a separate, non-expiring credential with broad user permissions. Uncheck it for MCP-only sign-in. If a same-project REST key already exists, unchecking the option does not remove it: login preserves it and warns. To stop using it locally, use `logout` when you intend to disconnect both credentials; revoke unwanted REST keys separately in Dashboard → API Keys.

`uninstall` preserves credentials; `logout` clears both local credentials after removing owned registrations; `reset --client claude --install` logs out then pairs and registers again. All preserve project settings. None revokes server access. Revoke MCP and REST keys independently in the Dashboard. Never revoke a key shared with another session as a test.

For manual rotation use the private editor opened by `./ordering init`, then `doctor`, `install` and client reload. Agents must not read or edit `.env` themselves.

Official docs: [MCP setup](https://docs.ordering.co/docs/developers/mcp/) · [Create an API key](https://docs.ordering.co/docs/products/dashboard/settings/pro/developers/api-keys/) · [Use the Ordering.co API](https://docs.ordering.co/docs/products/dashboard/settings/pro/developers/api-guidelines/)
