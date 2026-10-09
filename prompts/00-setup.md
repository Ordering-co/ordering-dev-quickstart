# Connect to Ordering.co

Paste this into Claude Code or Codex, from any folder:

```text
Connect me to Ordering.co: clone https://github.com/Finitless-com/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step.
```

The agent follows [SETUP.md](../SETUP.md): it obtains a browser link and verification code, you sign in and choose permissions, and the terminal saves credentials and registers detected clients. Wait for the final installer result, reload your intended client and ask it to call `whoami`. The browser confirmation alone does not prove installation. A remote terminal installs on its own machine; see [client compatibility](../docs/clients.md).
