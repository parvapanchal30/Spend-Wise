# SpendWise

SpendWise is a mobile and web purchase tracker. Add purchases manually, capture a receipt, paste or import receipt text, or import a CSV bank statement. It starts with an empty history; sample transactions are no longer required. Purchases stay on the device or in the current browser profile until you export them.

The app records items, notes, return and warranty dates, and the original receipt image when attached. You can edit or delete purchases, confirm dates, resolve Guardian reminders, search and filter transactions, view category and merchant spending, set a monthly budget, and review likely recurring expenses. Spending reports keep currencies separate because no exchange rates are assumed.

## Run it

Use Node.js 22.14+ or 24.3+. From this directory:

```sh
npm ci
npm --prefix server ci
npm run dev:web
```

Open the address shown by Expo, usually `http://localhost:8081`. `dev:web` starts Expo and the local OCR reader together. To test on a phone on the same trusted Wi-Fi network, run `npm run dev:mobile` instead and scan Expo's QR code with Expo Go SDK 57. The computer may ask you to allow local network access to the receipt reader. The app can always save purchases manually if the reader is unavailable.

Select **Add purchase** or **Scan or import receipt** to create a record. An image can be attached without OCR; choose **Send and read receipt** to send it to your own local reader. Review the extracted fields before saving. Tesseract downloads language data on its first use. See [the reader guide](server/README.md) for language and network settings.

## Bring in real data

Settings accepts `.csv` statements and SpendWise `.json` backups, with a preview of valid rows, duplicates, and row errors before import. CSV must include a date (`Date`, `Transaction Date`, or `Posted Date`), merchant (`Merchant`, `Description`, or `Payee`), and positive expense (`Amount`, `Debit`, or `Withdrawal`). Include a `Currency` column if transactions differ from your saved default currency. YYYY-MM-DD and day-first DD/MM/YYYY dates are accepted. Credits and refunds are skipped with a reason; they are not counted as spending. You can download a CSV template from Settings.

CSV and JSON exports include purchase details, notes, extracted text, and Guardian dates. Original receipt images are **not included** in these portable files. Keep those images separately. JSON is the recommended format for moving purchase records to a new device. Imported records with the same ID or same date, merchant, amount, and currency are skipped. A saved record can be edited from its details screen.

Existing prototype users are migrated automatically: their real receipts are retained, demo purchases are excluded, and the original storage is backed up locally. New installations start empty. Use Settings → **Delete all local records** to remove purchases, app-owned receipt copies, and reminders from this installation.

## Billing and reminders

Manual tracking, imports, and analytics work without a RevenueCat account. The app provides an unlimited local mode when billing is unconfigured, in Expo Go, or on web. In a configured native store build, the Free plan allows 50 new records per month and a Pro entitlement removes the limit. Editing and exporting existing records remain available after the limit. The purchase and restore controls appear only when the native RevenueCat SDK and public platform key are available. Configure products, offering, and a `pro` entitlement in RevenueCat before testing purchases in a native development or store build. Public API keys go in `.env.local`; store secrets never belong in the app.

Device reminders are optional and require notification permission after the user enables them in Settings. They schedule private text for confirmed, unresolved return and warranty dates. Calendar export is available when device notifications are unavailable. RevenueCat purchases and notifications need a native build for full validation; Expo Go/web cannot exercise store purchases.

Copy `.env.example` to `.env.local` for optional integrations. `npm run dev:web` and `npm run dev:mobile` provide an OCR URL automatically unless you set `EXPO_PUBLIC_OCR_URL` yourself. Variables beginning with `EXPO_PUBLIC_` are visible in the app bundle and must contain public configuration only.

## Data and privacy

Transactions use local AsyncStorage; app-owned receipt images live in the app's document directory on phones. SpendWise does not provide its own encryption, account recovery, or cross-device sync. Browser storage may be cleared by the browser, and large images can reach browser storage limits. Export a backup and retain the original receipt images when moving devices. OCR uploads happen only after choosing automatic reading and go to the configured reader; the local reader processes images in memory and does not save them. A publicly hosted OCR reader needs authentication and HTTPS before handling personal documents.

## Development checks

```sh
npm run validate
npm run test:ocr
npx expo-doctor@latest
npx expo export --platform all --output-dir dist
```

See [testing guide](docs/TESTING.md) for a hands-on checklist and [OCR service guide](server/README.md) for reader setup. This is a device-local product; bank and email account connectors, secure cloud sync, and automatic recovery of receipt images are not part of this build.
