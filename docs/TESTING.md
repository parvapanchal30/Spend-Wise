# Testing SpendWise

SpendWise milestone 1 is a local-first Expo prototype. It needs no API keys, cloud accounts, or production credentials.

## Install

Use a current Node.js LTS release and npm. This milestone was validated with Node.js 22.14.0 and npm 10.9.2.

```bash
npm install
```

After `package-lock.json` exists, use the reproducible clean install in fresh checkouts or CI:

```bash
npm ci
```

## Launch with Expo

```bash
npm start
```

The Expo terminal displays a QR code and keyboard shortcuts. The application does not require an `.env` file.

## Android

Start an Android emulator or connect an Android device with Expo Go, then run:

```bash
npm run android
```

You can also run `npm start` and press `a`. For a physical device, scan the displayed QR code with Expo Go while the computer and device can reach each other.

## iOS

On macOS with an iOS simulator available:

```bash
npm run ios
```

You can also scan the `npm start` QR code with the current Expo Go app on a physical iPhone. The iOS simulator cannot be launched from Windows or Linux.

## Web

The milestone supports Metro-powered web development:

```bash
npm run web
```

Image-picker and device-permission behavior can differ from native platforms, so complete the final import checklist on Android or iOS as well.

## Automated checks

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run test:coverage -- --runInBand
npm run validate
```

The tests cover Indian currency formatting, transaction search, monthly spending, deadline urgency, Free-plan usage, deterministic mock extraction, and review-form editing and validation.

## Manual receipt workflow

1. Launch the app and confirm the Home screen shows Indian demonstration transactions, monthly INR spending, Free-plan usage, and an upcoming Guardian deadline.
2. Tap **Scan or import receipt**.
3. Cancel the system image picker once and verify the cancellation state appears.
4. Reopen the picker. If practical, deny photo permission and confirm SpendWise explains how to enable it; restore permission afterward.
5. Select a non-sensitive test image and confirm its preview appears.
6. Tap **Process locally** and verify visible progress plus the local-mock disclosure.
7. On Review, verify the Amazon/Sony example appears with confidence indicators and estimated deadline labels.
8. Clear a required field or enter an invalid total/date and confirm a helpful validation message appears.
9. Correct the fields and save the transaction.
10. Open Transactions and search for the saved merchant and product name. Search for nonsense and verify the empty-result state.
11. Open the saved transaction and verify its values, Guardian dates, and original receipt preview when the device URI remains available.
12. Restart the app and confirm the saved transaction remains in the list.
13. Open Guardian and verify return and warranty entries show urgency plus confirmed/estimated status.
14. Open Settings and verify the mock plan and usage. Confirm privacy, export, and subscription actions are marked unavailable.
15. Reset demo data and confirm the seeded examples return and the test receipt transaction is removed.

Use only synthetic or non-sensitive images while testing this prototype.

## Current mock limitations

- Receipt extraction always returns the same deterministic Amazon/Sony example; it does not inspect image pixels.
- Transactions are stored only in AsyncStorage on the current device or browser profile.
- Imported receipt preview availability depends on the local URI supplied by the operating system; clearing app data or temporary picker storage can remove it.
- The Free plan and 50-transaction limit are local mock behavior. RevenueCat is not connected.
- Guardian reminders are calculated in-app. No local or remote notification is scheduled.
- Supabase, OCR/vision providers, background queues, Sentry, email, bank access, exports, and subscription management are not connected.
- Demo reset replaces all locally stored transactions without a cloud backup.

## Development builds and later integrations

Expo Go is sufficient for this credential-free milestone. Real in-app purchases through RevenueCat and production remote push-notification behavior require native configuration and a development build rather than relying only on Expo Go. Add those integrations only after application identifiers, credentials, entitlements, and secure environment handling are defined.
