# SpendWise receipt reader

This optional service reads actual PNG, JPEG, and WebP receipts with Tesseract on your computer. Manual entry and text receipt import work without it. No paid API key is required. Images stay in memory for each request and are not saved or sent to an AI provider. Tesseract downloads its language model on first use (internet required initially); subsequent runs use its cached model.

## Run locally

```sh
npm --prefix server install
npm --prefix server start
```

Create `.env.local` in the app directory:

```dotenv
EXPO_PUBLIC_OCR_URL=http://localhost:8787
```

Restart Expo after changing environment variables. In the app choose an image, then **Send and read receipt**. A first request may take longer while the language model downloads. Review every field before saving; currency, dates, categories, or items that cannot be identified stay blank. Ambiguous numeric dates are left for review. Return and warranty dates are never invented.

For a phone on the same trusted Wi-Fi network, set `OCR_HOST=0.0.0.0` on the server and set `EXPO_PUBLIC_OCR_URL` to your computer's LAN address, for example `http://192.168.1.12:8787`. Allow the server port through the local firewall if necessary. The default loopback binding is only reachable on the computer. For Android emulator use `http://10.0.2.2:8787`; native release builds may require HTTPS according to platform network rules.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `OCR_HOST` | `127.0.0.1` | Server bind address |
| `OCR_PORT` | `8787` | Server port |
| `OCR_LANGUAGE` | `eng` | Installed/downloadable Tesseract language, such as `eng+hin` |
| `OCR_ALLOWED_ORIGINS` | localhost:8081, 127.0.0.1:8081, localhost:19006 (HTTP) | Comma-separated exact browser origins; set explicitly for a different web address |

`GET /health` reports readiness and busy state. `POST /extract` accepts exactly one multipart field named `receipt` (up to 10 MB), returning `{ "text": "...", "engine": "tesseract" }`. It permits one request at a time and times out reading after 90 seconds. No receipts are logged. This local service has no user accounts; do not expose it directly on the public internet. A hosted deployment needs authenticated access, TLS, and abuse controls. Never place secret API keys in an `EXPO_PUBLIC_` variable.

Run service boundary tests with `npm --prefix server test`. Tests inject a recognizer to verify request handling without downloading a model.
