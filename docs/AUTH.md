# Google sign-in (Syncle extension + services)

## 1. Google Cloud Console

1. Create an OAuth client of type **Chrome extension**.
2. Set the extension ID (from `chrome://extensions` → Syncle → ID).
3. Copy the **client ID** into `public/manifest.json` → `oauth2.client_id` (replace the placeholder).

## 2. syncle-services

```bash
cd syncle-services
cp .env.example .env
```

Set in `.env`:

- `GOOGLE_CLIENT_ID` — same client ID as the extension
- `JWT_SECRET` — random string for session tokens
- `AUTH_REQUIRED=false` — local dev without forcing auth on every route

```bash
npm install
npm run dev
```

## 3. Extension

1. `npm run build` and reload the extension.
2. Open the popup → **Sign in with Google**.
3. Draw a lasso — when signed in, context registers to `http://localhost:3001`.

## Flow

```
Popup → chrome.identity.getAuthToken
     → POST /auth/google { accessToken }
     → JWT stored in chrome.storage.local
Lasso → optimize payload → POST /context/page/register or /context/selection/register
```

Set `AUTH_REQUIRED=true` on the server when you want all context/chat routes to require `Authorization: Bearer <jwt>`.
