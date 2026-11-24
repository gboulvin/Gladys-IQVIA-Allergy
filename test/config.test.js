import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, MAX_ZIP_CODES, normalizeConfig, parseZipCodes } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), { ...DEFAULT_CONFIG, zipCodes: [] });
});

test('normalizeConfig keeps user values and parses the ZIP codes', () => {
  const config = normalizeConfig({ zip_codes: '10001, 80238', poll_frequency: 1800 });
  assert.equal(config.zip_codes, '10001, 80238');
  assert.deepEqual(config.zipCodes, ['10001', '80238']);
  assert.equal(config.poll_frequency, 1800);
});

test('normalizeConfig coerces numeric strings coming from a form', () => {
  const config = normalizeConfig({ poll_frequency: '7200' });
  assert.equal(config.poll_frequency, 7200);
});

test('normalizeConfig falls back to the default for an invalid refresh interval', () => {
  assert.equal(normalizeConfig({ poll_frequency: 'abc' }).poll_frequency, 3600);
  assert.equal(normalizeConfig({ poll_frequency: 5 }).poll_frequency, 3600);
});

test('parseZipCodes accepts several separators and drops duplicates', () => {
  assert.deepEqual(parseZipCodes('10001;80238 10001,\n94103'), {
    valid: ['10001', '80238', '94103'],
    invalid: [],
  });
});

test('parseZipCodes reports invalid entries', () => {
  assert.deepEqual(parseZipCodes('1234, 75001X, 10001, abcde'), {
    valid: ['10001'],
    invalid: ['1234', '75001X', 'abcde'],
  });
});

test(`parseZipCodes keeps at most ${MAX_ZIP_CODES} ZIP codes`, () => {
  const { valid, invalid } = parseZipCodes('10001 10002 10003 10004 10005 10006');
  assert.equal(valid.length, MAX_ZIP_CODES);
  assert.deepEqual(invalid, ['10006']);
});

test('parseZipCodes of an empty value is empty', () => {
  assert.deepEqual(parseZipCodes(''), { valid: [], invalid: [] });
  assert.deepEqual(parseZipCodes(undefined), { valid: [], invalid: [] });
});
