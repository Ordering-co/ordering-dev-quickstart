# Ordering.co + your AI agent

Connect your detected MCP clients to Ordering.co orders, businesses and reports.

&nbsp;

## 1 · Paste this into Claude Code or Codex

```text
Connect me to Ordering.co: clone https://github.com/Finitless-com/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step.
```

<sub>Works on macOS and Linux. Global client installation requires Node.js 22+ and npm. On Windows, use WSL.</sub>

&nbsp;

## 2 · Sign in when your agent gives you the link, and type the code it shows you

Open the link, sign in with your Ordering.co **Dashboard** or **Billing** account, type the code, and click **Connect**.

<sub>You never copy or paste a key. Read access is the default: your agent can look at your data, not change it. Only administrators and business managers can connect. The page also gives your agent the REST API by default (full access, no expiry); uncheck it if you only want the MCP.</sub>

&nbsp;

## 3 · Check the installer result, restart your client and ask

The browser confirms credential delivery. Wait for the terminal to verify the MCP launcher and report each client registration; then restart/reload your client.

> Who am I in Ordering?

> Show my last 5 orders with customer, business and total.

> Which of my businesses are open right now?

With a write key you can also change an order's status or open/close a business; your agent asks before every change.

More ideas: [prompts/](prompts/)

&nbsp;

---

<sub>

**Something went wrong?** [Troubleshooting](docs/troubleshooting.md) · **Prefer to set it up yourself, or use Cursor or VS Code?** [Manual setup](docs/manual-setup.md) · **Want to disconnect or reset?** [`./ordering logout`](docs/manual-setup.md#disconnect-or-reset) · **Building with the REST API?** [REST API](docs/rest-api.md) · **Keys and safety:** [Security](docs/security.md) · **How sign-in works:** [Login protocol](docs/login-protocol.md) · [Developer docs](https://docs.ordering.co/docs/developers/) · [MIT License](LICENSE)

</sub>
