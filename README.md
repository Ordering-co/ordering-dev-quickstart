# Ordering.co + your AI agent

Connect your detected MCP clients to Ordering.co orders, businesses and reports.

&nbsp;

## 1 · Paste this into your terminal AI agent

```text
Connect me to Ordering.co: get or safely update https://github.com/Ordering-co/ordering-dev-quickstart in ~/ordering-dev-quickstart, preserving my existing changes. Read SETUP.md and follow it step by step.
```

<sub>Works on macOS and Linux. Global client installation requires Node.js 22+ and npm. On Windows, use WSL.</sub>

&nbsp;

## 2 · Sign in when your agent gives you the link, and type the code it shows you

Open the link, sign in with your Ordering.co **Dashboard** or **Accounts (Billing)** account, type the code, and click **Connect**.

<sub>You never copy or paste a key. Read access is the default: your agent can look at your data, not change it. Only administrators and business managers can connect. The page also gives your agent the REST API by default (full access, no expiry); uncheck it if you only want the MCP.</sub>

&nbsp;

## 3 · Check the installer result, restart your client and ask

The browser confirms credential delivery. Wait for the terminal to verify the MCP launcher and report each client registration; then restart/reload your client.

> Who am I in Ordering?

> Show my last 5 orders with customer, business and total.

> Which of my businesses are open right now?

With a write key you can also change an order's status or open/close a business; your agent asks before every change.

The server exposes a selected catalog, subject to your role, scope and allowed fields; it is not the entire REST API. MCP read does not restrict the separate REST credential.

More ideas: [prompts/](prompts/) · [Clients and command reference](docs/clients.md) · [Optional plugin and skill](https://github.com/Ordering-co/ordering-mcp-plugin) · [Complete MCP guide](https://docs.ordering.co/docs/developers/mcp/)

This quickstart and the optional plugin are public under the Ordering-co organization. You can clone them without a GitHub account. Connecting to project data still requires your own eligible Ordering account and consent.

&nbsp;

## 4 · Optional · Get all seven Ordering products

After verifying your connection, your agent offers to download the seven public products into `~/ordering-products`. If you accept, it configures **all seven** for your confirmed project and asks once for a franchise if needed.

Then choose which products to run locally. **Website Marketplace + Dashboard together** are the recommended first start. Only your selected products install dependencies and start; mobile builds follow their own runbooks.

Already connected, or just want the code without signing in? Follow [the products guide](docs/products.md) or use [the products prompt](prompts/30-run-ordering-products.md). Skipping this keeps your verified Ordering connection ready to use.

&nbsp;

## 5 · Optional, recommended · Add Context7 for development with AI

Context7 lets your agent look up current Ordering.co documentation and examples while writing code. The Ordering MCP connects to your project's data; Context7 searches documentation.

```bash
cd ~/ordering-dev-quickstart
npx ctx7 setup --mcp --oauth --project
```

Choose the client you use, complete its Context7 sign-in, then reload its MCP tools. This configures Context7 for the current project where the client supports it, using OAuth instead of putting a key in this repo.

| Documentation | Context7 library |
|---|---|
| Complete API Reference: endpoints, parameters, request bodies and responses | [`/openapi/ordering_co_api-reference_openapi_json`](https://context7.com/openapi/ordering_co_api-reference_openapi_json) |
| REST authentication and MCP setup and permissions | [`/llmstxt/ordering_co_llms-small_txt`](https://context7.com/llmstxt/ordering_co_llms-small_txt) |

Try: “Use Context7 library /openapi/ordering_co_api-reference_openapi_json to explain GET /usage_limits, then verify the exact operation with ./ordering spec.”

[Setup and verification](docs/context7.md) · [Ready-to-copy prompts](prompts/20-build-with-the-api.md). You can also use the [API Reference](https://docs.ordering.co/api-reference/) and [developer docs](https://docs.ordering.co/docs/developers/) directly.

&nbsp;

## 6 · Optional · Your own Google Maps key

Create the Google Maps key your products use in your own Google Cloud account, billed to you, and save it in your project. You only sign in to Google in your browser; if you have no Google billing account yet, you add a payment method once.

```bash
./ordering google-maps setup
```

Requires the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) and the REST credential from sign-in. [How it works, what it enables and costs](docs/google-maps.md) · [Prompt for your agent](prompts/40-google-maps-key.md)

&nbsp;

---

<sub>

**Something went wrong?** [Troubleshooting](docs/troubleshooting.md) · **Prefer to set it up yourself, or use Cursor or VS Code?** [Manual setup](docs/manual-setup.md) · **Want to disconnect or reset?** [`./ordering logout`](docs/manual-setup.md#disconnect-or-reset) · **Building with the REST API?** [REST API](docs/rest-api.md) · **Documentation with AI:** [Context7 (optional)](docs/context7.md) · **Keys and safety:** [Security](docs/security.md) · **How sign-in works:** [Login protocol](docs/login-protocol.md) · [Developer docs](https://docs.ordering.co/docs/developers/) · [MIT License](LICENSE)

</sub>
