# Download, configure and run Ordering products

Use this guide after a verified Ordering connection, or independently when you only want the public code and already know your authorized project slug. Downloading/configuring products does not require an MCP key, another browser pairing or Context7. Never read `.env` or move an agent credential into a product.

## The four separate results

- **Connected:** the Ordering launcher and client registration have their own checks in [SETUP.md](../SETUP.md). A client's authenticated `whoami` remains a separate runtime check.
- **Cloned:** the public source and the six recorded SDK submodules are available locally. No application dependencies have been installed by this command.
- **Configured:** a product's own helper validated the public destination and saved only its supported public settings. This does not prove membership or log a person into the app.
- **Running:** the chosen product actually opens locally and its first visible edit is observed. Metro, HTTP, a successful build and a device UI each prove different steps.

## One offer, all seven configured, then choose what runs

An agent offers once, after connection verification: “Would you also like me to download all seven Ordering products into `~/ordering-products`?” Respect an applicable acceptance or refusal already given. Keep this dialogue outside pending `login wait`/`install` processes. Skipping leaves the Ordering connection usable.

Acceptance means clone and configure **all seven**, with the confirmed project. If a franchise selection is missing or ambiguous, ask once for an enabled franchise the person explicitly chooses for **both** franchise products. Reuse earlier validated choices; never pick the first franchise or business. Do not ask which product to configure first.

After configuration, ask which products the person wants to run locally. Recommend **Website Marketplace + Dashboard together**. Only those chosen products proceed to dependency installation, a server or native build/launch, and a visible edit. Preserve other running sessions. Do not install all seven products' dependencies or launch everything during configuration.

## Public catalogue

All folders below are siblings inside the chosen destination. New recursive clones use the SDK revision recorded by each product; do not replace the gitlink, change the SDK URL or use submodule `--remote`.

| Product | Public repository | Folder | Pinned submodules | Runbook in that checkout |
| --- | --- | --- | --- | --- |
| Dashboard | [Ordering-co/ordering-dashboard](https://github.com/Ordering-co/ordering-dashboard) | `ordering-dashboard` | No | `setup.md` |
| Website Marketplace | [Ordering-co/website-marketplace](https://github.com/Ordering-co/website-marketplace) | `website-marketplace` | Yes | `setup.md` |
| Customer App | [Ordering-co/ordering-app-marketplace](https://github.com/Ordering-co/ordering-app-marketplace) | `ordering-app-marketplace` | Yes | `setup.md` |
| Business App | [Ordering-co/ordering-app-business](https://github.com/Ordering-co/ordering-app-business) | `ordering-app-business` | Yes | `docs/onboarding.md` |
| Driver App | [Ordering-co/ordering-app-driver](https://github.com/Ordering-co/ordering-app-driver) | `ordering-app-driver` | Yes | `docs/onboarding.md` |
| Franchise Website | [Ordering-co/ordering-website-franchises](https://github.com/Ordering-co/ordering-website-franchises) | `ordering-website-franchises` | Yes | `setup.md` |
| Franchise App | [Ordering-co/ordering-app-franchises](https://github.com/Ordering-co/ordering-app-franchises) | `ordering-app-franchises` | Yes | `setup.md` |

The repositories and their submodules are public; a private GitHub membership is not needed. Each product, SDK and dependency retains its own licence and notices. This Quickstart's MIT licence does not replace those terms.

## Commands: standalone, no Ordering login needed

Run these from the Quickstart checkout, with Git and Node.js 22+ available. Use your own selected destination; quote paths containing spaces. `repos --help` reports the installed helper's interface without loading credentials.

```sh
./ordering repos --help
./ordering repos clone --all --directory ~/ordering-products
```

Replace `my-project` and `my-franchise` below with the explicitly confirmed public slugs. If both franchise selections are already present and valid, their helpers may reuse them; otherwise supply the deliberate choice for both:

```sh
./ordering repos configure --all --directory ~/ordering-products --project my-project --franchise-slug my-franchise
```

Without a franchise argument:

```sh
./ordering repos configure --all --directory ~/ordering-products --project my-project
```

A missing franchise is reported as a partial configuration until an explicit choice is supplied. Do not describe the two franchise products as configured just because the other five succeeded. Do not repeat MCP sign-in to repair missing public project/franchise data.

Both commands require explicit `--all` and `--directory`; the helper does not ask terminal questions, including without a TTY. The agent supplies the human dialogue. Exit 0 means all seven selected operations succeeded; exit 1 reports a partial failure/conflict, and exit 2 indicates invalid/missing command arguments. Inspect each product's `status`, `directory` and `errorCode` in the JSON summary before reporting success. A clone summary is not a configuration summary. Clone statuses are `cloned`, `existing`, `conflict` or `failed`; configure statuses are `configured`, `unchanged`, `conflict` or `failed`. A reported conflict is not a completed operation.

`configure` delegates to each checkout's existing public helper. Website Marketplace uses `scripts/marketplace/cli.mjs configure --public-project`; the other six use `scripts/onboarding/cli.mjs configure --project`. Existing product configuration and unknown fields remain owned by that product's helper. Nothing copies one product's configuration into another. Public GET validation checks resolution, not ownership, permissions or a normal app session.

### Changing a destination deliberately

If the existing project or franchise is different, explain the intended change and obtain explicit confirmation before using the flag:

```sh
./ordering repos configure --all --directory ~/ordering-products --project my-project --franchise-slug my-franchise --confirm-project-change
```

This passes the product's own change confirmation (`--reconnect` for Marketplace). It does not authorize changing backend data, resetting a checkout or replacing native registrations. Keep the product helper's private local backups out of Git and diagnostics.

## Preservation and partial recovery

- **Existing verified checkout:** preserve its local files, branch, HEAD, remotes and SDK checkout. Bulk clone does not fetch, pull, reset, switch branches or install dependencies. A verified fork may be reused only when its canonical upstream is already recorded; the helper does not create a fork or add an upstream.
- **Unknown repository, non-Git folder, unsafe path or symlink:** report the conflict and leave it intact. Agree on a different destination or a specific repair; never overwrite the folder to make the command green.
- **Missing/uninitialized SDK in an existing checkout:** report it for an explicit, scoped repair after checking its owner and changes. Do not silently replace an existing SDK checkout or advance its pin.
- **Network interruption or one failed product:** inspect the per-product summary, then retry the same `clone --all` or `configure --all` after addressing its reported cause. Preserve successful siblings. Do not delete personal work or start a new MCP pairing. The destination’s `.ordering-repos/` records helper-owned new clones for safe interrupted SDK downloads. Keep those ownership receipts; never manufacture or alter them to bypass a conflict. An existing or changed checkout is not silently repaired.
- **Public helper absent in an older product checkout:** explain that this checkout lacks the requested capability. Bulk clone does not update it automatically; arrange a safe update or use that checkout's manual runbook without pretending the new helper exists.
- **Configuration rollback:** use that product's documented restore/backup command. Bulk setup does not revoke a developer key, uninstall a client or log out an application session. Those are separate actions.

Report counts honestly, for example “7 cloned, 5 configured, 0 running; two franchise choices still need confirmation.” Keep raw configurations, tokens and customer responses out of summaries. A public API error, changed-project confirmation or unavailable native toolchain must not be hidden as success.

## Start only the selected products

Once the seven are configured (or after clearly reporting any partial result), ask for the launch selection. Recommend Website Marketplace + Dashboard; the developer can choose another combination. Follow the runbooks in the catalogue rather than guessing commands or using one runtime for every product.

Bulk clone/configure uses Node.js 22+ without app dependencies. Web doctor/start/build commands require their pinned Node 24/pnpm toolchain. Native apps use their own Node/Yarn, Xcode/Ruby/Pods or Android toolchain and native-service requirements. The explicit iOS Simulator preview without Firebase is an optional product-specific path; it is not a production/provider verification. Do not use another project's Firebase files, signing material or service keys. Configuration success on any platform does not prove a native build.

Keep localhost/private-network access limited to the intended devices and the selected checkout. Check process ownership and ports before starting or reusing a server. Verify the visible project/franchise, actual page/device and one reversible edit, then restore it. Record what is running and what remains unmeasured; do not claim login, checkout, payment, notifications or business writes from a catalogue view.

[Connection runbook](../SETUP.md) · [Client verification](clients.md) · [Troubleshooting](troubleshooting.md) · [Products prompt](../prompts/30-run-ordering-products.md)
