# Security policy

## If you leaked one of your keys

Revoke it right away. Deleting a commit, an issue or a message does not un-leak it.

1. **MCP key:** Dashboard → Settings → Apps & developers → API & integrations → MCP → delete the key.
2. **API key:** Dashboard → Settings → Developers → API Keys → Actions → delete.
3. Create a replacement, update your `.env`, and run `./ordering doctor`.

Never post a key, even a revoked one, in an issue or pull request.

## Reporting a vulnerability

If you find a security problem in this repo, the Ordering.co API or the MCP server, **don't open a public issue**. Report it privately through [GitHub's private vulnerability reporting](../../security/advisories/new) for this repository.

Include what you found, how to reproduce it, and what an attacker could do with it. We will acknowledge your report and keep you informed while we fix it.
