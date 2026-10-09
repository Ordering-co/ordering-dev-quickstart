# Security policy

## If you leaked one of your keys

Revoke it right away. Deleting a commit, an issue or a message does not un-leak it.

1. **MCP key:** Dashboard → Settings → Apps & developers → API & integrations → MCP → delete the key.
2. **API key:** Dashboard → Settings → Developers → API Keys → Actions → delete.
3. Create a replacement privately with `./ordering login --install`, collect the terminal result, reload and verify identity. For manual credentials, use the private editor opened by `./ordering init`.

Never post a key, even a revoked one, in an issue or pull request.

## Reporting a vulnerability

If you find a security problem in this repo, the Ordering.co API or the MCP server, **don't open a public issue**. Report it privately through [GitHub's private vulnerability reporting](https://github.com/Finitless-com/ordering-dev-quickstart/security/advisories/new) for this repository.

Include what you found, how to reproduce it, and what an attacker could do with it. We will acknowledge your report and keep you informed while we fix it.

If private reporting is unavailable, contact [Ordering.co support](https://www.ordering.co/contact/) to request a private security intake before sharing details. Do not put security details in a public issue or ordinary contact submission.
