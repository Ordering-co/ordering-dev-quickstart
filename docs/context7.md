# Context7 for development with AI (optional, recommended)

Context7 helps your coding agent retrieve current documentation and examples. Use the Ordering MCP to work with your connected project's data and Context7 to look up API contracts and integration guides. You can connect to Ordering and use its API without Context7.

## Our two libraries

| Library ID | Use it for |
|---|---|
| [`/openapi/ordering_co_api-reference_openapi_json`](https://context7.com/openapi/ordering_co_api-reference_openapi_json) | The complete public API Reference: endpoints, parameters, request bodies, responses and schemas. Its source is the [public OpenAPI specification](https://docs.ordering.co/api-reference/openapi.json). |
| [`/llmstxt/ordering_co_llms-small_txt`](https://context7.com/llmstxt/ordering_co_llms-small_txt) | REST authentication and MCP installation, connection checks and permissions. Its source is the [curated REST/MCP index](https://docs.ordering.co/llms-small.txt). |

Ordering's documentation deployment refreshes these sources when their public content changes. Use the reference library for operation details and the guide library for integration setup.

## Set up your client

If Context7 already works in your client, go directly to verification. Otherwise:

1. After connecting to Ordering, choose the AI client you want to configure and review the configuration paths before confirming changes. Prefer project scope. A client without project MCP settings may use global settings even with `--project`; confirm that scope first.
2. From your quickstart folder, run:

   ```bash
   cd ~/ordering-dev-quickstart
   npx ctx7 setup --mcp --oauth --project
   ```

   Select your client in the prompts, or add `--claude` or `--codex` to target it explicitly. The CLI configures the Context7 server, documentation rules and a helper skill. Keep the Ordering server entry and your existing instructions.
3. Complete the Context7 OAuth sign-in in your client, using your own account. This keeps a literal Context7 key out of the repo. If your client cannot complete OAuth, follow its [official installation instructions](https://context7.com/docs/resources/all-clients) and keep credentials in a private credential store or environment reference. Never put a key into a tracked configuration, command argument or prompt, and never reuse an Ordering or shared maintenance key for Context7.
4. Reload the client's MCP settings or start a new chat, then verify the tools below. The quickstart's `./ordering install`, `./ordering doctor` and `./ordering clients` check Ordering; Context7 has its own setup and verification.

The quickstart's Node.js 22+ requirement covers the Context7 CLI's Node.js 18+ prerequisite. See the [official CLI documentation](https://context7.com/docs/clients/cli) for current setup options. Installation happens only when you choose this step; it is separate from `./ordering login --install`.

## Verify both libraries

In the client, confirm `resolve-library-id` and `query-docs` are available. These library IDs are already known, so use `query-docs` directly:

```text
Use Context7 library /openapi/ordering_co_api-reference_openapi_json to explain GET /usage_limits, its include parameter and response fields. Cite the source and verify the exact method/path with ./ordering spec. Don't call my project.
```

```text
Use Context7 library /llmstxt/ordering_co_llms-small_txt to explain login start --install, doctor, clients, reload and Ordering MCP read/write permissions. Cite the source. Explain the steps without changing my installation or project data.
```

Require documentation from `https://docs.ordering.co/`. For API answers, inspect `spec/openapi.json` after `./ordering spec` and match the exact method/path, parameters, operation security, request body and response schema. Context7 can retrieve a similarly named operation; a partial match is not verification.

Keep queries about public documentation: do not include keys, private code or project/customer data. A docs query does not prove the Ordering connection works or authorize a write to your project.

If Context7 is unavailable, authentication fails or a usage limit is reached, continue with the [API Reference](https://docs.ordering.co/api-reference/), [`./ordering spec`](rest-api.md), and the [public documentation index](https://docs.ordering.co/llms.txt). [Development prompts](../prompts/20-build-with-the-api.md) use the same fallback.
