# REST API

Use the REST API when you're building software that runs on its own, such as an ERP sync, a report or your own app. To ask questions with an AI agent, the [MCP](../README.md) is easier.

> [!WARNING]
> **There is no sandbox.** Every request reaches your real project. Start with `GET` requests.

## 1 · Get an API key

Two ways:
- During `./ordering login`, leave **"Also give my agent the REST API"** checked on the sign-in page (it is on by default).
- Any time, in the Dashboard → **Settings → Developers → API Keys → Add API key**.

Browser pairing saves it privately through the helper. For manual setup, enter it yourself in the private editor opened by `./ordering init`, as `ORDERING_API_KEY`, together with `ORDERING_PROJECT`. See [credentials](credentials.md) for how it differs from the MCP key.

> [!WARNING]
> **API keys have no scope and don't expire.** They act with your full permissions until you revoke them in the Dashboard (Settings → Developers → API Keys). Selecting MCP read does not restrict this separate credential. Uncheck the REST option to exclude a new API key. A same-project key already saved locally is retained with a warning; unchecking does not revoke it.

## 2 · Make your first request

```bash
./ordering doctor      # checks the key
./ordering api GET "/orders?orderBy=-id&page=1&page_size=5&mode=dashboard"
```

`./ordering api` asks you to confirm any `POST`, `PUT`, `PATCH` or `DELETE`: by typing your project ID in the terminal, or, for an agent, with `--yes` after you approved that exact request in the chat.

The helper exits with code 1 for HTTP errors or a top-level JSON `"error": true`, even with HTTP 200. It still prints the response with credentials redacted and adds a brief diagnostic on stderr.

## 3 · Build

| Want to… | Use |
|---|---|
| Try requests in your editor | VS Code [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) with the files in [`requests/`](../requests/). Start VS Code with `./ordering code` |
| Use Postman or Insomnia | Import `https://docs.ordering.co/api-reference/openapi.json` |
| Generate a typed client | `./ordering spec` saves the OpenAPI spec to `spec/openapi.json` |
| Have your agent write the code | Open this repo in Claude Code or Codex and use [prompts/20-build-with-the-api.md](../prompts/20-build-with-the-api.md) |

## Basics

- **Base URL:** `https://api.ordering.co/v400/<language>/<project ID>/`, for example `https://api.ordering.co/v400/en/yourproject/orders`.
- **Auth:** `X-Api-Key: <your API key>`. Some operations take a user session instead: `Authorization: Bearer <token>` from `POST /auth`. Each operation in the [API Reference](https://docs.ordering.co/api-reference/) lists what it accepts.
- **Responses:** `{"error": false, "result": …, "pagination": …}`. Check `error` as well as the HTTP status.
- **Lists:** `params` (fields), `orderBy` (`-` prefix for descending), `page`, `page_size`, `where` (JSON filter).
- **Keep API keys on servers.** Never put them in a website or a mobile app.

Full contract: [API Reference](https://docs.ordering.co/api-reference/) · Guide: [Use the Ordering.co API](https://docs.ordering.co/docs/products/dashboard/settings/pro/developers/api-guidelines/)
