const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { test } = require('node:test');

// Resolve through the consumers so these checks exercise the overrides actually used.
const routerRequire = createRequire(require.resolve('expo-router/package.json'));
const queryString = routerRequire('query-string');
const expoRequire = createRequire(require.resolve('expo/package.json'));
const configRequire = createRequire(expoRequire.resolve('@expo/config-plugins'));
const xcode = configRequire('xcode');

test('receipt routing preserves encoded local URIs, filenames, and MIME types', () => {
  const params = {
    uri: 'file:///receipts/September receipt #1.jpg',
    fileName: 'receipt + invoice & copy.jpg',
    mimeType: 'image/jpeg',
  };
  assert.deepEqual({ ...queryString.parse(queryString.stringify(params)) }, params);
});

test('routing tolerates malformed percent escapes', () => {
  const result = queryString.parse('name=%E0%A4%A&tag=a&tag=b');
  assert.equal(typeof result.name, 'string');
  assert.deepEqual(result.tag, ['a', 'b']);
});

test('Xcode tooling still generates valid, distinct project identifiers', () => {
  const project = xcode.project('unused.pbxproj');
  project.hash = { project: { objects: {} } };
  const identifiers = Array.from({ length: 100 }, () => project.generateUuid());
  assert.equal(new Set(identifiers).size, identifiers.length);
  identifiers.forEach((id) => assert.match(id, /^[A-F0-9]{24}$/));
});
