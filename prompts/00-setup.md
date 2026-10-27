# Connect to Ordering.co

Paste this into Claude Code or Codex, from any folder:

```text
Connect me to Ordering.co: get or safely update https://github.com/Ordering-co/ordering-dev-quickstart in ~/ordering-dev-quickstart, preserving my existing changes. Read SETUP.md and follow it step by step.
```

The agent follows [SETUP.md](../SETUP.md): it obtains a browser link and verification code, you sign in and choose permissions, and the terminal saves credentials and registers detected clients. Wait for the final installer result, reload your intended client and ask it to call `whoami`. The browser confirmation alone does not prove installation. A remote terminal installs on its own machine; see [client compatibility](../docs/clients.md). Never copy a key into the chat. Manual key entry is the fallback when browser sign-in is unavailable.

After your Ordering connection is verified, the agent offers once to download the seven products. Accepting configures all seven for your confirmed project; a franchise choice is requested once when needed. Then choose which products to run locally, with Website Marketplace + Dashboard recommended. [Products guide](../docs/products.md) · [Product-only prompt](30-run-ordering-products.md).

It also recommends creating your own Google Maps key in your Google Cloud account and saving it in this project, because the key new projects start with only works on Ordering's own domains: [Google Maps guide](../docs/google-maps.md) · [Prompt when already connected](40-google-maps-key.md).

## Also set up Context7 (optional, recommended for development with AI)

Use this if you want the optional setup as well:

```text
Set up Context7 for my AI client following docs/context7.md, using OAuth and project scope where supported. Explain the configuration paths before changing them and preserve my Ordering registration and existing instructions. Verify documentation queries against /openapi/ordering_co_api-reference_openapi_json and /llmstxt/ordering_co_llms-small_txt. Don't send credentials or project data to Context7.
```

The first library covers the complete API Reference; the second covers REST authentication and MCP setup and permissions. [Context7 setup and verification](../docs/context7.md).
