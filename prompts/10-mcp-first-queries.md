# First things to ask through the MCP

Start the agent with `./ordering claude` or `./ordering codex`, then try these.

## Check the connection

```text
Who am I in Ordering? Tell me my project, my role, my key's scope and when it expires.
```

## Orders

```text
List my last 5 orders with their ID, status, business, customer name and total.
```

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
