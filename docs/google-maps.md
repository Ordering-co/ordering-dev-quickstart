# Your own Google Maps key

Maps, address autocomplete, delivery zones and distances in the Ordering products use the project setting `google_maps_api_key`. `./ordering google-maps setup` creates that key in **your own** Google Cloud account and saves it in the project you connected with this quickstart, so Google bills Maps usage to you and you see it in your Google console.

**Set it up before you go live.** New projects come with Ordering's key, which is restricted to Ordering's own domains: it does not work on your custom domains, your apps or anywhere else.

You sign in to Google in your browser, and if you have no Google billing account yet you add a payment method once. Google does not let any tool do that part for you. Everything else is automatic.

## Two ways to start

- **New to the quickstart:** paste [the setup prompt](../prompts/00-setup.md). After your Ordering connection is verified, your agent offers this step ([SETUP.md step 8](../SETUP.md#8-recommended-their-own-google-maps-key)).
- **Already connected:** paste [the Google Maps prompt](../prompts/40-google-maps-key.md), or follow the steps below yourself. It uses the project and REST credential you already have; no new Ordering sign-in.

## Step by step

### 1. Check your Ordering connection

```bash
cd ~/ordering-dev-quickstart
./ordering doctor
```

You need your project and **`✔ API key … accepted`** in the REST API section. The key is saved through that credential. If it is missing (you unchecked the REST API box when you signed in), run `./ordering reset` and keep the box checked.

### 2. Install the Google Cloud CLI

```bash
gcloud --version || brew install --cask gcloud-cli
```

Without Homebrew, use [the official installer](https://cloud.google.com/sdk/docs/install). You do not need to configure it.

### 3. First run: it only reads

```bash
./ordering google-maps setup
```

What you will see, in this order:

1. **`Current google_maps_api_key: …abcd`** or **`No google_maps_api_key yet`**. New projects show Ordering's key here; you replace it with yours in step 4.
2. **Google sign-in.** A browser window opens on the computer running the terminal. Sign in with the Google account that should **own and pay for** the key. Google then asks you to allow **Google Cloud SDK** to see, edit and manage your Google Cloud data, among other Google Cloud permissions: that is Google's official command-line tool, and this command only uses it to create the project, link billing, enable the APIs and create the key. Then check the line **`Signed in as …`**. If it shows another account, run `gcloud auth login`, choose the right one and run the command again.

   With a company Google account (Google Workspace), the project is created inside your company's Google Cloud organization and follows its policies.
3. **Billing.** One of three outcomes:
   - **No billing account (exit 3):** open the [link it prints](https://console.cloud.google.com/billing/create), create a billing account with your country and a payment card, and give it a name you will recognize. Then run the command again.
   - **Several billing accounts (exit 3):** it lists them as `ID  Name`. Run it again with `--billing-account <ID>` for the one you want.
   - **One billing account:** it uses it.
4. **`This will`**: the summary of every change, including `replace google_maps_api_key …abcd` when the project has a key. Nothing has changed yet. With an existing key it ends asking for `--replace`, so a key is never switched by surprise.

### 4. Confirm and run

Run the same command with the flags it asked for. At a terminal, it asks you to type your project ID to confirm. An agent shows you the summary and adds `--yes` only after you approve it in the chat:

```bash
./ordering google-maps setup --replace --billing-account <ID> --yes
```

Leave out `--replace` if the project had no key, and `--billing-account` if you have only one.

### 5. What success looks like

```text
Setting up
  ✔ Created the project ordering-maps-<your project>
  ✔ Linked the billing account <ID>
  ✔ Enabled the Google Maps APIs
  ✔ Created the API key "Ordering Maps"
  ✔ Google accepts the key …wxyz
  ✔ Kept the previous key …abcd in .google-maps-previous-key (./ordering google-maps restore puts it back)
  ✔ Saved as google_maps_api_key in <your project> (read back)
```

The keys themselves are never printed. Open your website on your own domain and type an address to see the autocomplete working with your key. Manage the key and its usage at the link the command prints.

If you will not use `gcloud` again on this computer, sign out of Google there: `gcloud auth revoke`.

Running the command again is safe: it reuses the project and the key and updates the key's API restrictions. Its summary still says `replace google_maps_api_key …wxyz` and asks for `--replace`, because it only learns that the key is the same at the end, where it reports `The project already uses this key`.

### 6. Mobile apps (only if you build your own)

The iOS and Android apps read their native map key at build time, not from this setting. To use your key there too, put the same key in the `_GOOGLE_MAPS_API_KEY_` placeholder of each app's build; it already allows the Maps SDK for Android and iOS.

## If something goes wrong

| You see | Do this |
|---|---|
| `The REST API credential is missing` | Run `./ordering reset` and keep the REST API box checked. |
| `The Google Cloud CLI (gcloud) is required` | Step 2. |
| `Signed in as` shows the wrong Google account | `gcloud auth login`, choose the right account, run again. |
| The Google sign-in page cannot reach `localhost` | You opened it on another computer. Sign in on the computer running the terminal (in a remote session, the remote machine). |
| `Could not list your Google billing accounts` | Your Google session is not valid. Run `gcloud auth login` and run again. |
| `Could not create ordering-maps-…` | The ID is taken or your organization blocks new projects. Choose another ID with `--gcp-project`, or ask your Google Workspace administrator. |
| `Could not link the billing account` | You need the Billing Account User role on that billing account. |
| `Google did not enable the legacy …` | Google refused a legacy API on this project. The key works; the features that still call it may not. |
| `Google still rejects the key` | New APIs can take a few minutes. Wait and run the command again. |
| `Ordering did not save the key` | The key is ready in Google. Run the command again. |

## Exit codes

| Code | Meaning |
|---|---|
| 0 | The key is saved in your project and accepted by Google |
| 1 | Something failed or was not confirmed; the message says what. Nothing after that step ran |
| 3 | Only you can continue: add a payment method, or choose a billing account with `--billing-account` |

## What gets enabled

Every API that the Ordering products and the core API call with `google_maps_api_key`. The key is limited to exactly these:

| API | Service name | Used for |
|---|---|---|
| Maps JavaScript API | `maps-backend.googleapis.com` | Maps in the websites, Dashboard, call center and kiosks, including drawn delivery zones and heatmaps |
| Places API (New) | `places.googleapis.com` | Address suggestions and nearby search in the Dashboard and websites |
| Places API (legacy) | `places-backend.googleapis.com` | The address autocomplete widget everywhere, and place autocomplete/details in the apps |
| Geocoding API | `geocoding-backend.googleapis.com` | Addresses ↔ coordinates in the browser, the apps and the core API |
| Maps Static API | `static-maps-backend.googleapis.com` | Static map images in orders |
| Time Zone API | `timezone-backend.googleapis.com` | Business time zones in the Dashboard |
| Distance Matrix API (legacy) | `distance-matrix-backend.googleapis.com` | Delivery distances in the core API |
| Address Validation API | `addressvalidation.googleapis.com` | Address checks in the call center, through the core API |
| Geolocation API | `geolocation.googleapis.com` | Locating the customer in the AI webchat |
| Routes API | `routes.googleapis.com` | Routes and travel times for delivery logistics, such as automatic driver assignment |
| Directions API (legacy) | `directions-backend.googleapis.com` | The same logistics features where they still use the legacy API |
| Maps SDK for Android | `maps-android-backend.googleapis.com` | Maps in the Android apps, if you reuse this key in your builds |
| Maps SDK for iOS | `maps-ios-backend.googleapis.com` | Maps in the iOS apps, if you reuse this key in your builds |

Not enabled, because no product calls them: Roads, Elevation and Street View. Google sign-in (`google_login_client_id`) is an OAuth client, not an API key, and is not set up by this command.

Google has marked Places API, Distance Matrix API and Directions API as legacy and may refuse to enable them on some projects. The command then warns you and continues.

## Restrictions and costs

The key is restricted **by API**, not by website: the same `google_maps_api_key` is used by your websites, your apps and Ordering's servers, so a website restriction would break the apps and server-side geocoding. You can add stricter restrictions in the [Google console](https://console.cloud.google.com/google/maps-apis/credentials) if you only use the websites.

Google bills Maps usage to the billing account you chose, at [Google Maps Platform prices](https://mapsplatform.google.com/pricing/). Set a [budget alert](https://console.cloud.google.com/billing/budgets) and, if you want a hard limit, [quotas per API](https://console.cloud.google.com/google/maps-apis/quotas).

## Undo

```bash
./ordering google-maps restore
```

It puts back the key that setup replaced, kept in `.google-maps-previous-key` in this folder (private, never committed; only the first replaced key is kept), after the same confirmation. Your own key keeps existing in Google Cloud: to stop it and its billing, delete the project `ordering-maps-<your project>` in the [Google console](https://console.cloud.google.com/cloud-resource-manager). Remember that Ordering's key does not work on your own domains.
