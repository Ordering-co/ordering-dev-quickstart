# Your own Google Maps key

Maps, address autocomplete, delivery zones and distances in the Ordering products use the project setting `google_maps_api_key`. `./ordering google-maps setup` creates that key in **your own** Google Cloud account and saves it in your project, so Google bills Maps usage to you directly and you can see it in your Google console.

You only sign in to Google in your browser. The one thing Google does not allow any tool to do for you is add a payment method: if your Google account has no billing account yet, the command stops and gives you the link to add one.

## Before you start

- The Google Cloud CLI: [install `gcloud`](https://cloud.google.com/sdk/docs/install). You do not need to configure it; the command signs you in.
- `ORDERING_PROJECT` and `ORDERING_API_KEY` in `.env` (the REST credential from `./ordering login`, from an administrator). The key is saved through the REST API.
- A Google account that can create projects. A Google Workspace organization can restrict this; ask its administrator if project creation is refused.

## Run it

```bash
cd ~/ordering-dev-quickstart
./ordering google-maps setup
```

1. **Reads** your project's current `google_maps_api_key`. If one is already set, it stops unless you pass `--replace`, so it never overwrites a working key by surprise.
2. **Signs you in to Google** in your browser (`gcloud auth login`), unless you already are.
3. **Checks billing.** With no open billing account it stops with exit code 3 and the link to [add a payment method](https://console.cloud.google.com/billing/create); run the command again afterwards. With several, it lists them and asks you to choose one with `--billing-account`.
4. **Shows what it will change** and asks you to type your project ID (agents pass `--yes` only after you approve in the chat).
5. **Creates or reuses** the Google Cloud project `ordering-maps-<your project>` (choose another ID with `--gcp-project`) and links the billing account.
6. **Enables the Maps APIs** the products use and creates the API key **Ordering Maps**, restricted to those APIs.
7. **Checks that Google accepts the key**, saves it as `google_maps_api_key` and reads it back. The key itself is never printed.

Running it again is safe: it reuses the project and the key and updates the key's API restrictions.

## What gets enabled

Every API that the Ordering products and the core API call with `google_maps_api_key`:

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

Google has marked Places API, Distance Matrix API and Directions API as legacy and may refuse to enable them on new projects. The command then warns you and continues; the features that still call them may not work until the products move to the newer APIs.

## Restrictions and costs

The key is restricted **by API**, not by website: the same `google_maps_api_key` is used by your websites, your apps and Ordering's servers, so a website restriction would break the apps and server-side geocoding. You can add stricter restrictions in the [Google console](https://console.cloud.google.com/google/maps-apis/credentials) if you only use the websites.

Google bills Maps usage to the billing account you chose, at [Google Maps Platform prices](https://mapsplatform.google.com/pricing/). Set a [budget alert](https://console.cloud.google.com/billing/budgets) and, if you want a hard limit, [quotas per API](https://console.cloud.google.com/google/maps-apis/quotas).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | The key is saved in your project and accepted by Google |
| 1 | Something failed; the message says what. Nothing after that step ran |
| 3 | Only you can continue: add a payment method, or choose a billing account with `--billing-account` |

## Undo

Put your previous key back in the Dashboard settings, or delete the Google Cloud project `ordering-maps-<your project>` in the [Google console](https://console.cloud.google.com/cloud-resource-manager), which also stops its billing.
