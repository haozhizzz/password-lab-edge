import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { analyzePassword, demoConfig, generateDemo, candidateAt, estimateAverageSeconds, formatDuration } from '../extension/core.js';

test('empty input has no implied strength or entropy', () => {
  const result = analyzePassword('');
  assert.equal(result.score, 0); assert.equal(result.bits, null); assert.equal(result.label, '等待输入');
});
test('common words with numeric and symbol suffixes remain weak', () => {
  for (const password of ['password', 'Password123!', 'admin2026', 'qwerty']) {
    const result = analyzePassword(password);
    assert.ok(result.score <= 25, password);
    assert.ok(result.findings.some(text => text.includes('常见')), password);
  }
});
test('repeated characters and chunks are capped even when long', () => {
  for (const password of ['a'.repeat(64), 'Ab1!'.repeat(8)]) assert.ok(analyzePassword(password).score <= 20);
});
test('sequences and short digit-only inputs are flagged', () => {
  assert.ok(analyzePassword('abcdefgh!98').findings.some(text => text.includes('连续')));
  assert.ok(analyzePassword('59283017').score <= 25);
});
test('ASCII pool and random-space bits follow the stated model', () => {
  const result = analyzePassword('aA9!');
  assert.equal(result.pool, 94); assert.equal(result.kinds.length, 4);
  assert.equal(result.bits, 4 * Math.log2(94));
  assert.equal(analyzePassword('a A9!').pool, 95);
});
test('Unicode counts code points and declines unsupported space estimates', () => {
  const result = analyzePassword('示例🔑密码');
  assert.equal(result.length, 5); assert.equal(result.bits, null); assert.equal(result.pool, null);
});
test('longer varied examples score higher without claiming certainty', () => {
  assert.ok(analyzePassword('river lantern meadow orbit').score > analyzePassword('Password123!').score);
  assert.ok(analyzePassword('Lj9!rW5*zT2&vQ8?').score > 75);
});
test('average time uses exact half-space expectation and rejects invalid inputs', () => {
  assert.equal(estimateAverageSeconds(Math.log2(10000), 1000).toFixed(4), '5.0005');
  assert.equal(estimateAverageSeconds(null, 1), null);
  assert.equal(estimateAverageSeconds(10, 0), null);
  assert.equal(estimateAverageSeconds(10, Infinity), null);
  assert.equal(estimateAverageSeconds(-1, 1), null);
});
test('formats small, normal, and astronomical durations', () => {
  assert.equal(formatDuration(.01), '不足 1 秒');
  assert.equal(formatDuration(120), '2.0 分钟');
  assert.match(formatDuration(1e100), /e\+\d+ 年/);
});
test('demo bounds reject oversized and unrecognized configurations', () => {
  assert.equal(demoConfig('digits', 5).total, 100000);
  assert.equal(demoConfig('hex', 4).total, 65536);
  for (const args of [['hex', 5], ['digits', 6], ['digits', 2.5], ['__proto__', 3], ['toString', 3], ['custom', 4]]) {
    assert.throws(() => demoConfig(...args));
  }
});
test('enumeration covers every fixed-length candidate exactly once in order', () => {
  const { alphabet, total, length } = demoConfig('letters', 3);
  const values = Array.from({ length: total }, (_, index) => candidateAt(index, alphabet, length));
  assert.equal(values[0], 'aaa'); assert.equal(values.at(-1), 'ddd'); assert.equal(new Set(values).size, total);
  assert.throws(() => candidateAt(total, alphabet, length), RangeError);
});
test('random generation rejects biased tail bytes', () => {
  const samples = [255, 250, 249, 0];
  const random = { getRandomValues: bytes => { bytes[0] = samples.shift(); return bytes; } };
  const demo = generateDemo('digits', 2, random);
  assert.equal(demo.target, '90'); assert.equal(samples.length, 0);
});
test('generated demo targets always belong to their bounded preset', () => {
  for (const preset of ['digits', 'hex', 'letters']) {
    const demo = generateDemo(preset, 4);
    assert.equal(demo.target.length, 4);
    assert.ok(Array.from(demo.target).every(c => demo.alphabet.includes(c)));
  }
});
test('extension has local-only CSP, no host or content-script access, and packaged icons', async () => {
  const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  for (const key of ['permissions', 'host_permissions', 'content_scripts', 'externally_connectable', 'web_accessible_resources']) assert.equal(manifest[key], undefined);
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  assert.match(manifest.content_security_policy.extension_pages, /worker-src 'self'/);
  for (const icon of Object.values(manifest.icons)) await access(new URL(`../extension/${icon}`, import.meta.url));
});
