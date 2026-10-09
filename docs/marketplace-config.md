# Website Marketplace public configuration

`./ordering marketplace-config EXPECTED_PROJECT` verifies MCP identity and project membership, then reads public current/config/theme/catalog endpoints. It exports allowlisted public JSON to stdout; no identity, MCP key, REST key or session token is exported. Read scope is sufficient. It does not install clients or write project data. An existing write credential is accepted for these reads without requesting broader access.

Website Marketplace vendors this helper from the verified quickstart snapshot because this repository is private. The vendored copy is tracked with provenance and a license, never fetched from an unspecified latest branch. The two exporter copies must remain identical.

The selected project must match EXPECTED_PROJECT. Single-store themes are rejected. API host/version, language, socket endpoint and app ID follow the current Website Marketplace contract; the socket endpoint is the canonical platform endpoint, not inferred from account data. No business list is exported, only a count. A successful export verifies configuration and a catalog GET; browser rendering and installation must still be checked separately.
