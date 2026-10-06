# REST API requests

Ready-to-run requests for the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension for VS Code.

1. Fill in `ORDERING_PROJECT`, `ORDERING_LANG` and `ORDERING_API_KEY` in `.env`.
2. Quit VS Code, then start it from this repo with `./ordering code`. The requests read your keys from the environment (`{{$processEnv …}}`), so VS Code must be started with your `.env` loaded.
3. Open a `.http` file and select **Send Request** above a request.

Every request here is read-only, except the login in `04-auth-session.http`, which creates a session and changes no data.

**Prefer the terminal?** Each request has its `./ordering api` equivalent in a comment.

**Prefer Postman or Insomnia?** Import the OpenAPI spec from `https://docs.ordering.co/api-reference/openapi.json`, then set the `X-Api-Key` header.

| File | What it shows |
|---|---|
| `01-configs.http` | The base URL works and your project exists |
| `02-orders.http` | List, sort, paginate and select fields; get one order |
| `03-businesses.http` | Businesses, a menu's categories and products |
| `04-auth-session.http` | Log in as a user to get a session token |
