import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

import { createReceiptServer } from './index.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');
let server;
let base;
let recognize;

function upload(content = png, type = 'image/png', field = 'receipt') {
  const body = new FormData();
  body.append(field, new Blob([content], { type }), 'receipt.png');
  return fetch(`${base}/extract`, { method: 'POST', body });
}

before(async () => {
  recognize = async () => ({ text: 'Corner Store\nDate 2026-08-27\nTotal INR 325.50' });
  server = createReceiptServer({ recognize: (image) => recognize(image), maxBytes: 1024, timeoutMs: 1000 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('reports health and recognizes an uploaded image', async () => {
  const health = await fetch(`${base}/health`);
  assert.deepEqual(await health.json(), { status: 'ok', engine: 'tesseract', busy: false });
  const response = await upload();
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
  assert.deepEqual(await response.json(), { text: 'Corner Store\nDate 2026-08-27\nTotal INR 325.50', engine: 'tesseract' });
});

test('rejects unsupported uploads and oversize images', async () => {
  const unsupported = await upload(Buffer.from('not an image'), 'text/plain');
  assert.equal(unsupported.status, 415);
  const tooLarge = await upload(Buffer.concat([png, Buffer.alloc(1024)]));
  assert.equal(tooLarge.status, 413);
});

test('accepts exactly one receipt field', async () => {
  const body = new FormData();
  body.append('receipt', new Blob([png], { type: 'image/png' }), 'one.png');
  body.append('receipt', new Blob([png], { type: 'image/png' }), 'two.png');
  const response = await fetch(`${base}/extract`, { method: 'POST', body });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /one receipt/);
});

test('rejects empty OCR output without claiming to read the image', async () => {
  recognize = async () => ({ text: '  ' });
  const response = await upload();
  assert.equal(response.status, 422, JSON.stringify(await response.clone().json()));
  assert.match((await response.json()).error, /No readable text/);
});

test('rejects unapproved browser origins', async () => {
  const response = await fetch(`${base}/health`, { headers: { Origin: 'https://unapproved.example' } });
  assert.equal(response.status, 403);
});
