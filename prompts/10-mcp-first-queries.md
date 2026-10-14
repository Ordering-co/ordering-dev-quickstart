# First things to ask through the MCP

Start the agent with `./ordering claude` or `./ordering codex`, then try these.

## Try these first

```text
Who am I in Ordering? Tell me my project, my role, my key's scope and when it expires.
```

```text
How many orders came in today, by status?
```

```text
Show my last 5 orders with customer, business and total.
```

```text
Which of my businesses are open right now?
```

```text
What are the best-selling products this week?
```

## With a write-scoped key

Your agent asks for confirmation before making any of these:

```text
Change order #<id> to <status>.
```

```text
Close <business> for today, or open it again.
```

```text
Snooze <product> until tomorrow.
```

```text
Change the price of <product> to <price>.
```

## Orders

```text
How many orders did my project receive yesterday? Group them by status.
```

## Businesses and menus

```text
Which businesses are enabled in my project? Show their ID, name and slug.
```

```text
Show me the categories and products of business <business ID>, with prices.
```

## Explore what is possible

```text
Search the Ordering operations related to coupons and promotions and explain what each one does. Don't call any of them.
```

## Changing data (write-scoped key only)

```text
Prepare the change to <describe the change>. Before calling write_operation, show me exactly which operation, which record and which fields will change, and wait for my approval.
```

## Documentation with Context7 (optional)

Once [Context7 is configured](../docs/context7.md), these retrieve documentation rather than your project's records:

```text
Use Context7 library /llmstxt/ordering_co_llms-small_txt to explain Ordering MCP installation, doctor and clients checks, and the difference between read and write permissions. Explain the steps without reconnecting me or changing my project data.
```

```text
Use Context7 library /openapi/ordering_co_api-reference_openapi_json to explain GET /usage_limits: its include parameter and response fields. Verify the exact method and path with ./ordering spec. Don't call my project.
```

If Context7 isn't available, use the [API Reference](https://docs.ordering.co/api-reference/) and [public docs](https://docs.ordering.co/llms.txt) directly.
