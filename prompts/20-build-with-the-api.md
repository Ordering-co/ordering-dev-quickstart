# Build something with the REST API

Use these when you want your agent to help you write code that calls the Ordering.co API.

## Start a small integration

```text
I want to build <what you want to build> with the Ordering.co REST API, in <language>.
Follow AGENTS.md. Run ./ordering spec and find the operations I need in spec/openapi.json
before writing any code. Read my API key from the ORDERING_API_KEY environment variable
and my project from ORDERING_PROJECT. Use only GET requests while we test.
```

## Understand an endpoint

```text
Explain the Ordering.co operation <METHOD /path>: its parameters, which credentials it accepts,
and what the response contains. Use spec/openapi.json and the docs at
https://docs.ordering.co/llms.txt. Then show me a ./ordering api command to try it.
```

## Sync data to another system

```text
Write a script that pages through all orders created today in my Ordering.co project
and writes them to a CSV with ID, created date, status, business and total.
Handle pagination and the {"error", "result", "pagination"} envelope. Read-only.
```
