# Test SpendWise with real data

Install with Node.js 22.14+ or 24.3+:

```sh
npm ci
npm --prefix server ci
npm run dev:web
```

For a phone, use `npm run dev:mobile` on the same Wi-Fi network and open the QR code in Expo Go SDK 57. The local OCR service starts with Expo. On the web, open the address printed by Expo, usually `http://localhost:8081`. If local network rules block OCR on a phone, manual entry and receipt attachments remain usable.

## Hands-on flows

1. On a fresh install, confirm Home, Transactions, Guardian, and Insights show empty states with no sample purchases.
2. Add a purchase manually. Save a merchant, valid date, positive total, currency, item, note, and confirmed deadline. Reopen it, edit the amount, mark it recurring, resolve and reopen its Guardian date, then delete it.
3. Choose a real receipt image or take a photo. Save by entering details manually, then reopen it and confirm the image remains. With the local reader running, choose **Send and read receipt**, correct its text suggestions, and save. Try an unreadable image and use the manual fallback.
4. Paste receipt text or import a `.txt` receipt. Check that unclear values remain blank and text is kept with the saved purchase.
5. In Settings, download the CSV template. Add two real rows, one duplicate, and one invalid or credit row. Preview the import, review the row error, import valid new rows, and confirm duplicates were skipped. Export CSV and JSON, then import the JSON backup into a cleared installation.
6. Search by merchant, item, note, and receipt text. Filter by category, currency and date. Confirm Insights totals do not mix currencies; set a monthly budget and check the remaining amount and category bars.
7. On a native build with notifications available, enable reminders in Settings. Confirm a Guardian date, then check scheduled notifications. Resolve that date and verify its notification disappears. Export the calendar file and import it into a calendar app. Browser and Expo Go may not support device notifications.
8. In a configured native store build, load RevenueCat offerings, make a sandbox purchase, restore it, and open subscription management. In Expo Go or web, verify local mode remains unlimited and store purchase buttons are unavailable.
9. Export a backup, then type DELETE in Settings and remove all local records. Check that Home is empty and previously attached app-owned receipts no longer appear. Subscription and separately imported calendar events are outside this deletion.

## Automated checks

```sh
npm run validate
npm run test:ocr
npx expo-doctor@latest
npx expo export --platform all --output-dir dist
```

The automated suites cover CSV parsing and backup validation, migration and queued writes, spending and deadline calculations, review validation, provider mutation failures, receipt parsing, notification scheduling, and OCR server request boundaries. Expo exports verify compilation for Android, iOS and web. They do not replace the phone checks for camera permission, saved file access, notifications or store purchases.

## OCR reader health

With `npm run dev:web` or `npm run dev:mobile` active, open `http://localhost:8787/health` on the computer. It should respond with `{ "status": "ok", "engine": "tesseract", "busy": false }`. OCR uses Tesseract and may download its language data the first time. See [server/README.md](../server/README.md) for supported formats, size limits, and LAN configuration.

## Privacy and recovery checks

Settings exports structured records without receipt images. Test JSON backup restore and retain the original images separately. Local storage is not encrypted by SpendWise. Confirm a malformed import shows an error without overwriting existing purchases, and that a failed save leaves the review form available for retry. The app does not perform account sync, bank login, or inbox access.
