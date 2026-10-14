# Build something with the REST API

Use these when you want your agent to help you write code that calls the Ordering.co API. [Context7](../docs/context7.md) is optional and recommended: use it if already configured, or continue with the public OpenAPI and docs without installing anything.

## Start a small integration

```text
I want to build <what you want to build> with the Ordering.co REST API, in <language>.
Follow AGENTS.md. If Context7 is available, query /openapi/ordering_co_api-reference_openapi_json
for the operations I need and /llmstxt/ordering_co_llms-small_txt for authentication guidance.
Run ./ordering spec and verify the exact methods, paths, parameters and schemas in
spec/openapi.json before writing any code. Read my API key from the ORDERING_API_KEY environment variable
and my project from ORDERING_PROJECT. Use only GET requests while we test.
```

## Understand an endpoint

```text
Explain the Ordering.co operation <METHOD /path>: its parameters, which credentials it accepts,
and what the response contains. If Context7 is available, query
/openapi/ordering_co_api-reference_openapi_json for that exact method and path.
Verify the answer against spec/openapi.json and the docs at https://docs.ordering.co/llms.txt. Then show me a ./ordering api command to try it.
```

## Sync data to another system

```text
Write a script that pages through all orders created today in my Ordering.co project
and writes them to a CSV with ID, created date, status, business and total.
Follow AGENTS.md. If Context7 is available, use /openapi/ordering_co_api-reference_openapi_json
for the order parameters and responses. Verify filters and pagination in ./ordering spec
before writing the script. Handle the {"error", "result", "pagination"} envelope. Read-only.
```
