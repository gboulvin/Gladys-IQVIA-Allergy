import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { DEVICE_POLL_FREQUENCIES, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  buildTransportEntries,
  createPoller,
  findBlueprintByForecast,
  getForecast,
  refreshAll,
  refreshForecast,
  resetForecasts,
  resolveDevice,
} from '../src/devices/index.js';
import { FEATURE } from '../src/devices/forecast.js';
import { FORECAST_UPDATED_TRIGGER, LEVEL_CHANGED_TRIGGER } from '../src/devices/triggers.js';
import { normalizeConfig } from '../src/config.js';
import { ZIP, fakeFetch, pollenCurrent } from './fixtures.js';

const config = normalizeConfig({ zip_codes: `${ZIP}, 10001` });
const pollen = findBlueprintByForecast('pollen');

beforeEach(() => resetForecasts());

test('every blueprint exposes the required shape', () => {
  for (const bp of DEVICE_BLUEPRINTS) {
    assert.equal(typeof bp.key, 'string');
    assert.equal(typeof bp.forecast, 'string');
    for (const fn of ['deviceExternalId', 'buildDevice', 'fetch', 'statesOf']) {
      assert.equal(typeof bp[fn], 'function', `${bp.key}.${fn} must be a function`);
    }
  }
});

test('buildDiscoveredDevices returns every forecast of every ZIP code', () => {
  const gladys = createFakeGladys();
  const devices = buildDiscoveredDevices(gladys, config);
  assert.equal(devices.length, DEVICE_BLUEPRINTS.length * 2);
  const ids = devices.map((d) => d.external_id);
  assert.equal(new Set(ids).size, ids.length, 'no two devices may share an external_id');
});

test('no ZIP code, no device', () => {
  assert.deepEqual(buildDiscoveredDevices(createFakeGladys(), normalizeConfig()), []);
});

test('Gladys accepts the discovery payload', async () => {
  // The SDK fake checks the payload like the host API does: a refusal is a
  // 400 for the WHOLE list.
  const gladys = createFakeGladys();
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
  assert.equal(gladys.fake.discoveredDevices.length, DEVICE_BLUEPRINTS.length * 2);
});

test('every feature carries the columns Gladys needs to create it', () => {
  for (const device of buildDiscoveredDevices(createFakeGladys(), config)) {
    assert.equal(device.should_poll, true, `${device.name}: polled`);
    assert.equal(device.poll_frequency, DEVICE_POLL_FREQUENCIES.EVERY_MINUTES);
    for (const feature of device.features) {
      const where = `${device.name} / ${feature.name}`;
      assert.ok(feature.name.length > 0, `${where}: name`);
      assert.ok(Number.isFinite(feature.min) && Number.isFinite(feature.max), `${where}: min/max`);
      assert.ok(feature.min <= feature.max, `${where}: min must not exceed max`);
      assert.equal(feature.read_only, true, `${where}: forecasts are read-only`);
      assert.equal(typeof feature.has_feedback, 'boolean', `${where}: has_feedback`);
    }
  }
});

test('resolveDevice routes an external_id back to its blueprint and ZIP code', () => {
  const gladys = createFakeGladys();
  for (const zipCode of config.zipCodes) {
    for (const bp of DEVICE_BLUEPRINTS) {
      const resolved = resolveDevice(gladys, bp.deviceExternalId(gladys, zipCode), config);
      assert.equal(resolved.blueprint, bp);
      assert.equal(resolved.zipCode, zipCode);
    }
  }
  assert.equal(resolveDevice(gladys, 'does-not-exist', config), undefined);
});

test('a device of a ZIP code removed from the configuration is not resolved', () => {
  const gladys = createFakeGladys();
  const removed = pollen.deviceExternalId(gladys, '94103');
  assert.equal(resolveDevice(gladys, removed, config), undefined);
});

test('refreshForecast publishes the index and text states, accepted by Gladys', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  await refreshForecast(gladys, pollen, ZIP);
  const id = (key) => pollen.featureExternalId(gladys, ZIP, key);
  assert.equal(gladys.fake.lastState(id(FEATURE.INDEX_TODAY)), 6.6);
  assert.equal(gladys.fake.lastState(id(FEATURE.INDEX_TOMORROW)), 6.3);
  const texts = Object.fromEntries(
    gladys.fake.states
      .filter((s) => s.text !== undefined)
      .map((s) => [s.device_feature_external_id, s.text]),
  );
  assert.equal(texts[id(FEATURE.TRIGGERS_TODAY)], 'Juniper, Grasses, Chenopods');
  assert.equal(texts[id(FEATURE.SEASON)], 'Tree');
  assert.equal(texts[id(FEATURE.TREND)], 'subsiding');
});

test('every published state targets a feature of the discovered devices', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  await refreshAll(gladys, config);
  const featureIds = new Set(
    buildDiscoveredDevices(gladys, config).flatMap((d) => d.features.map((f) => f.external_id)),
  );
  assert.ok(gladys.fake.states.length > 0);
  for (const state of gladys.fake.states) {
    assert.ok(featureIds.has(state.device_feature_external_id), state.device_feature_external_id);
  }
});

test('an unchanged forecast is not published again', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  await refreshForecast(gladys, pollen, ZIP);
  const count = gladys.fake.states.length;
  await refreshForecast(gladys, pollen, ZIP);
  assert.equal(gladys.fake.states.length, count);
});

test('the first read fires no scene event, a change of level fires level_changed', async (t) => {
  let today = 6.6;
  t.mock.method(globalThis, 'fetch', fakeFetch({ pollenCurrent: () => pollenCurrent({ today }) }));
  const gladys = createFakeGladys();
  await refreshForecast(gladys, pollen, ZIP);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'a restart is not an event');

  today = 7.0; // still "medium"
  await refreshForecast(gladys, pollen, ZIP);
  assert.equal(gladys.fake.sceneEvents.length, 0, 'same band, no event');

  today = 9.9; // "high"
  await refreshForecast(gladys, pollen, ZIP);
  assert.equal(gladys.fake.sceneEvents.length, 1);
  const [{ key, data }] = gladys.fake.sceneEvents;
  assert.equal(key, LEVEL_CHANGED_TRIGGER);
  assert.equal(data.device, pollen.deviceExternalId(gladys, ZIP));
  assert.equal(data.level, 'high');
  assert.equal(data.previous_level, 'medium');
  assert.equal(data.index, 9.9);
});

test('a new forecast date fires forecast_updated', async (t) => {
  let date = '2018-06-12';
  t.mock.method(globalThis, 'fetch', fakeFetch({ pollenCurrent: () => pollenCurrent({ date }) }));
  const gladys = createFakeGladys();
  await refreshForecast(gladys, pollen, ZIP);
  date = '2018-06-13';
  await refreshForecast(gladys, pollen, ZIP);
  const events = gladys.fake.sceneEvents.filter((e) => e.key === FORECAST_UPDATED_TRIGGER);
  assert.equal(events.length, 1);
  assert.equal(events[0].data.location, 'Denver, CO');
  assert.equal(events[0].data.level_today, 'medium');
  assert.equal(events[0].data.triggers, 'Juniper, Grasses, Chenopods');
});

test('a failed read keeps the previous forecast and flags it unreachable', async (t) => {
  let down = false;
  t.mock.method(
    globalThis,
    'fetch',
    fakeFetch({ pollenCurrent: () => (down ? { status: 404 } : pollenCurrent()) }),
  );
  const gladys = createFakeGladys();
  const oneZip = normalizeConfig({ zip_codes: ZIP });
  await refreshForecast(gladys, pollen, ZIP);
  assert.equal(
    buildTransportEntries(gladys, oneZip).find((e) => e.external_id.includes(':pollen:')).transport,
    DEVICE_TRANSPORTS.CLOUD,
  );

  down = true;
  await assert.rejects(refreshForecast(gladys, pollen, ZIP), /HTTP 404/);
  assert.equal(getForecast(pollen, ZIP).data.today.index, 6.6, 'the last read is kept');
  assert.equal(
    buildTransportEntries(gladys, oneZip).find((e) => e.external_id.includes(':pollen:')).transport,
    DEVICE_TRANSPORTS.UNREACHABLE,
  );
});

test('refreshAll never throws and counts the failures', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch({ coldFluExtended: { status: 500 } }));
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const gladys = createFakeGladys();
  const pending = refreshAll(gladys, normalizeConfig({ zip_codes: ZIP }));
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(5_000);
  }
  assert.deepEqual(await pending, { ok: 2, failed: 1 });
});

test('the poller reads a device at the refresh interval of the config', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  const pollDevice = createPoller();
  const device = { external_id: pollen.deviceExternalId(gladys, ZIP) };
  const everyTenMinutes = normalizeConfig({ zip_codes: ZIP, poll_frequency: 600 });

  assert.equal(await pollDevice(gladys, device, everyTenMinutes), true, 'the first poll reads');
  for (let minute = 1; minute < 10; minute += 1) {
    t.mock.timers.tick(DEVICE_POLL_FREQUENCIES.EVERY_MINUTES);
    assert.equal(await pollDevice(gladys, device, everyTenMinutes), false, `skipped at ${minute}`);
  }
  t.mock.timers.tick(DEVICE_POLL_FREQUENCIES.EVERY_MINUTES - 50);
  assert.equal(await pollDevice(gladys, device, everyTenMinutes), true, 'read again at 10 min');
});

test('the poller ignores an unknown device', async () => {
  const pollDevice = createPoller();
  assert.equal(await pollDevice(createFakeGladys(), { external_id: 'nope' }, config), false);
});

test('Gladys polls a forecast device through the SDK', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  const pollDevice = createPoller();
  gladys.onPoll((device) => pollDevice(gladys, device, config));
  const device = { external_id: pollen.deviceExternalId(gladys, ZIP) };
  assert.equal((await gladys.fake.poll(device)).success, true);
});
