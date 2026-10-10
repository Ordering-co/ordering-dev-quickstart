# Connect to Ordering.co

Paste this into Claude Code or Codex, from any folder:

```text
Connect me to Ordering.co: clone https://github.com/Finitless-com/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step. After verifying Ordering, offer the optional Context7 documentation setup and ask before adding it.
```

The agent follows [SETUP.md](../SETUP.md): it starts browser sign-in, gives you the link and code, waits for the terminal to verify authentication and client registration, and asks you to reload your client. You do not copy a key into the chat. Manual key entry is the fallback when browser sign-in is unavailable.

## Also set up Context7 (optional, recommended for development with AI)

Use this if you want the optional setup as well:

```text
Set up Context7 for my AI client following docs/context7.md, using OAuth and project scope where supported. Explain the configuration paths before changing them and preserve my Ordering registration and existing instructions. Verify documentation queries against /openapi/ordering_co_api-reference_openapi_json and /llmstxt/ordering_co_llms-small_txt. Don't send credentials or project data to Context7.
```

The first library covers the complete API Reference; the second covers REST authentication and MCP setup and permissions. [Context7 setup and verification](../docs/context7.md).
