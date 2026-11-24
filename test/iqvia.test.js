import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENDPOINTS,
  InvalidZipCodeError,
  fetchAsthma,
  fetchColdFlu,
  fetchPollen,
  parseCurrent,
  parseExtended,
  requestIqvia,
} from '../src/iqvia.js';
import { ZIP, emptyResponse, fakeFetch, pollenCurrent, pollenExtended } from './fixtures.js';

test('parseCurrent reads the index and the triggers of each day', () => {
  const parsed = parseCurrent(pollenCurrent(), ZIP);
  assert.equal(parsed.location.name, 'Denver, CO');
  assert.equal(parsed.forecastDate, '2018-06-12T00:00:00-04:00');
  assert.deepEqual(parsed.today, { index: 6.6, triggers: ['Juniper', 'Grasses', 'Chenopods'] });
  assert.equal(parsed.tomorrow.index, 6.3);
  assert.equal(parsed.yesterday.index, 7.2);
});

test('parseCurrent clamps the index to 0-12', () => {
  const parsed = parseCurrent(pollenCurrent({ today: 15, tomorrow: -1 }), ZIP);
  assert.equal(parsed.today.index, 12);
  assert.equal(parsed.tomorrow.index, 0);
});

test('parseExtended returns one dated index per day', () => {
  const { days } = parseExtended(pollenExtended(), ZIP);
  assert.equal(days.length, 5);
  assert.deepEqual(days[0], { date: '2018-06-12', index: 6.6 });
});

test('an empty response means IQVIA has no forecast for this ZIP code', () => {
  assert.throws(() => parseCurrent(emptyResponse(), '00000'), InvalidZipCodeError);
  assert.throws(() => parseExtended(emptyResponse(), '00000'), InvalidZipCodeError);
});

test('fetchPollen merges the current, extended and outlook responses', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const pollen = await fetchPollen(ZIP);
  assert.equal(pollen.today.index, 6.6);
  assert.equal(pollen.days.length, 5);
  assert.equal(pollen.season, 'Tree');
  assert.equal(pollen.trend, 'subsiding');
});

test('fetchPollen survives a missing outlook', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch({ pollenOutlook: { status: 404 } }));
  const pollen = await fetchPollen(ZIP);
  assert.equal(pollen.today.index, 6.6);
  assert.equal(pollen.season, null);
});

test('fetchAsthma and fetchColdFlu read their forecasts', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const asthma = await fetchAsthma(ZIP);
  assert.deepEqual(asthma.today, { index: 4.5, triggers: ['PM2.5', 'OZONE'] });
  const coldFlu = await fetchColdFlu(ZIP);
  assert.equal(coldFlu.today.index, 2.4);
  assert.equal(coldFlu.tomorrow.index, 2.5);
  assert.equal(coldFlu.days.length, 4);
});

test('requests carry the ZIP code and a same-site Referer', async (t) => {
  const fetch = fakeFetch();
  t.mock.method(globalThis, 'fetch', fetch);
  await requestIqvia(ENDPOINTS.asthmaCurrent, ZIP);
  const [{ url, options }] = fetch.calls;
  assert.equal(url, `${ENDPOINTS.asthmaCurrent}/${ZIP}`);
  assert.equal(options.headers.Referer, 'https://www.asthmaforecast.com');
});

test('a 4xx answer is not retried', async (t) => {
  const fetch = fakeFetch({ pollenCurrent: { status: 403 } });
  t.mock.method(globalThis, 'fetch', fetch);
  await assert.rejects(requestIqvia(ENDPOINTS.pollenCurrent, ZIP), /HTTP 403/);
  assert.equal(fetch.calls.length, 1);
});

test('a network error is retried, then reported', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    throw new Error('network down');
  });
  // Attach the assertion first: the rejection must never be unhandled.
  const assertion = assert.rejects(requestIqvia(ENDPOINTS.pollenCurrent, ZIP), /network down/);
  // Let each retry delay elapse.
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(5_000);
  }
  await assertion;
  assert.equal(calls, 3);
});
