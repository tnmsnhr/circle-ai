# Google sign-in

Users click **Sign in with Google** once. OAuth credentials live on **syncle-services** only — nothing to paste in the extension.

## Server setup (one time)

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Create **OAuth client ID** → type **Web application**
3. **Authorized redirect URIs:** `http://localhost:3001/auth/google/callback`
4. Copy Client ID and Client secret

```bash
cd syncle-services
cp .env.example .env
# Fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, JWT_SECRET

npm run dev
```

5. Build & reload the extension:

```bash
cd syncle-ui
npm run build
# chrome://extensions → Reload Syncle (load from dist/)
```

## User flow

1. Open popup → if already signed in before, session restores automatically.
2. Otherwise click **Sign in with Google** → Google account picker → back to extension, signed in.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Start syncle-services…” | Server not running or `.env` missing Google keys |
| redirect_uri_mismatch | Add exact callback URL in Google Cloud |
| Popup can’t reach server | Default API URL is `http://localhost:3001` |

Optional: `VITE_GOOGLE_CLIENT_ID` in `syncle-ui/.env` enables manifest `oauth2` for `getAuthToken` — not required with the server OAuth flow.
