# Credentials

Ordering.co uses three kinds of credentials. They are not interchangeable.

| | MCP key | API key | Session token |
|---|---|---|---|
| **For** | AI agents through MCP | Your code calling the REST API | Acting as a logged-in user |
| **Looks like** | `ord_mcp_…` | Alphanumeric string | JWT |
| **Sent as** | `Authorization: Bearer <key>` to `https://api.ordering.co/mcp/<project>` | `X-Api-Key: <key>` | `Authorization: Bearer <token>` |
| **Created in** | Dashboard → Settings → Apps & developers → API & integrations → MCP | Dashboard → Settings → Developers → API Keys | `POST /auth` with the user's email and password |
| **Scope** | `read` or `write`, chosen at creation | Depends on the project and the operation; check the [API Reference](https://docs.ordering.co/api-reference/) | The user's own permissions |
| **Expires** | 7 days by default, up to 365 | Until you delete it | Per session |
| **Variable in `.env`** | `ORDERING_MCP_KEY` | `ORDERING_API_KEY` | Not stored. Get one when you need it |

## Which one should I use?

- **Exploring or operating with an AI agent:** MCP key with **read** scope. Create a separate write key only when you need it, with a short expiry.
- **A server-side integration** (ERP, CRM, reporting, your own backend): API key, kept on the server and never shipped to a browser or a mobile app.
- **An app where your customers log in:** session tokens from `POST /auth`, one per user.

## Rotating a key

1. Create the new key in the Dashboard.
2. Replace the value in `.env` (or in your server's secret store).
3. Run `./ordering doctor`.
4. Delete the old key in the Dashboard.

Official docs: [MCP setup](https://docs.ordering.co/docs/developers/mcp/) · [Create an API key](https://docs.ordering.co/docs/products/dashboard/settings/pro/developers/api-keys/) · [Use the Ordering.co API](https://docs.ordering.co/docs/products/dashboard/settings/pro/developers/api-guidelines/)
