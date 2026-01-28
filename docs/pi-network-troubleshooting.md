# Pi Network Sign-In Troubleshooting

This project expects to run inside Pi Browser with the Pi Network SDK available. Use the checklist below to diagnose sign-in issues that present as the header showing **"Signing in…"** indefinitely.

## 1. Confirm the Pi SDK is injected on the page

The app loads Pi's JavaScript SDK from `https://sdk.minepi.com/pi-sdk.js` and immediately calls `Pi.init({ version: "2.0", sandbox: true })` to enter the Testnet sandbox mode.【F:index.html†L21-L33】 The React hook that drives authentication (`usePiSDK`) keeps polling for `window.Pi.authenticate` and `window.Pi.createPayment`; if neither function appears, `isReady` never flips to `true`, so every component that depends on the SDK—including the navigation sign-in button—stays disabled.【F:src/hooks/usePiSDK.ts†L35-L127】

Pi Browser only exposes `window.Pi` for domains that exactly match the **App URL** or **Development URL** registered in the Pi Developer Portal. Any mismatch—such as visiting `https://dailypimart.store` when only `https://www.dailypimart.store` is registered, or opening a preview deployment that has not been added as a development URL—prevents the SDK from loading. Make sure DNS redirects land on a whitelisted host and that every environment you test has been added to the Pi Developer configuration.

## 2. Use the correct PiNet subdomain and Testnet flag

Because the SDK is initialised in sandbox mode, the site must be opened inside Pi Browser's Testnet environment. Use the automatically assigned PiNet subdomain shown in the Developer Portal (e.g., `pi://dailypimart2737`) and append `?testnet=1` when launching the app in Pi Browser so the browser injects the Testnet credentials. Loading the production Pi Browser (without the Testnet flag) against a Testnet-only app leaves `window.Pi` undefined, which again blocks the sign-in flow described above.【F:index.html†L21-L33】【F:src/hooks/usePiSDK.ts†L35-L127】

## 3. Back-end API stubs are still missing

After authentication succeeds, the frontend calls `/api/pi/*` endpoints (verify user, approve payment, complete payment) to talk to the Pi Network via your server.【F:src/lib/pi-api.ts†L38-L104】 These routes are not implemented in this repository, so the fetches currently fail with 404 responses. The error is caught and logged, but the user is allowed to proceed for now. When you add real back-end endpoints, return appropriate success payloads to avoid confusing error logs during sign-in.

Following this checklist ensures the Pi SDK is injected correctly and that the sign-in button transitions from "Signing in…" to the authenticated state.
