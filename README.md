# Ordering.co + your AI agent

Ask Claude Code or Codex about your Ordering.co orders, businesses and reports.

&nbsp;

## 1 · Open your MCP settings

**[Open MCP settings →](https://dashboard.ordering.co/settings?group=developers&category=developers&id=mcpTokens)**

Keep the tab open. Your agent will ask for the **Server URL** shown there, and you'll create a **Read** key on the same page.

<sub>Only administrators can open Settings. Read means your agent can look at your data, not change it.</sub>

&nbsp;

## 2 · Paste this into Claude Code or Codex

```text
Connect me to Ordering.co: clone https://github.com/Finitless-com/ordering-dev-quickstart to ~/ordering-dev-quickstart (or pull it if I already have it), then read its SETUP.md and follow it step by step.
```

Your agent asks for the Server URL, opens a file where you paste your key (never in the chat), tests the connection, and tells you when to restart.

<sub>Works on macOS and Linux. On Windows, use WSL.</sub>

&nbsp;

## 3 · Restart your agent and ask

> Who am I in Ordering?

> List my last 5 orders with their status and total.

> Which businesses are enabled in my project?

More ideas: [prompts/](prompts/)

&nbsp;

---

<sub>

**Something went wrong?** [Troubleshooting](docs/troubleshooting.md) · **Prefer to set it up yourself, or use Cursor or VS Code?** [Manual setup](docs/manual-setup.md) · **Building with the REST API?** [REST API](docs/rest-api.md) · **Keys and safety:** [Security](docs/security.md) · [Developer docs](https://docs.ordering.co/docs/developers/) · [MIT License](LICENSE)

</sub>
