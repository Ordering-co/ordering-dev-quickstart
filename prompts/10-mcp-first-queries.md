# First things to ask through the MCP

After `./ordering login --install` completes, reload your registered client and confirm it calls `whoami`. The folder-only alternatives are `./ordering claude` or `./ordering codex` after `prepare`. Discover and describe operations before querying; request only the data you need.

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
