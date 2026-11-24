import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { findBlueprintByForecast, refreshForecast, resetForecasts } from '../src/devices/index.js';
import { sceneEventsOf } from '../src/devices/triggers.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { LEVEL_KEYS } from '../src/i18n.js';
import { normalizeConfig } from '../src/config.js';
import { ZIP, fakeFetch, pollenCurrent } from './fixtures.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const config = normalizeConfig({ zip_codes: ZIP });
const pollen = findBlueprintByForecast('pollen');

const declarationOf = (list, key) => manifest[list].find((entry) => entry.key === key);
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

beforeEach(() => resetForecasts());

test('scene event data only carries keys the triggers declare, as primitives', () => {
  const previous = { forecastDate: 'a', today: { index: 1, triggers: [] } };
  const next = {
    forecastDate: 'b',
    location: { name: 'Denver, CO' },
    today: { index: 10, triggers: ['Juniper'] },
    tomorrow: { index: 8, triggers: [] },
  };
  const events = sceneEventsOf({
    device: 'ext:x:pollen:1',
    forecast: 'pollen',
    zipCode: ZIP,
    previous,
    next,
  });
  assert.equal(events.length, 2, 'a level change and a new forecast');
  for (const { key, data } of events) {
    const trigger = declarationOf('scene_triggers', key);
    assert.ok(trigger, `trigger ${key} is declared`);
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    for (const [dataKey, value] of Object.entries(data)) {
      assert.ok(declared.includes(dataKey), `${key}: data.${dataKey} is not declared`);
      assert.ok(
        value === null || typeof value !== 'object',
        `${key}: data.${dataKey} must be a primitive`,
      );
    }
    assert.ok(Object.keys(data).length <= 30);
  }
});

test('the level filter options are the levels the code sends', () => {
  const field = declarationOf('scene_triggers', 'level_changed').fields.find(
    (f) => f.key === 'level',
  );
  assert.deepEqual(
    field.options.map((option) => option.value),
    LEVEL_KEYS,
  );
});

test('get_forecast returns the declared outputs of the chosen day, translated', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  const outputs = await SCENE_ACTIONS.get_forecast(gladys, {
    fields: { device: pollen.deviceExternalId(gladys, ZIP), day: 'tomorrow', language: 'fr' },
    config,
  });
  assert.deepEqual(outputs, {
    index: 6.3,
    level: 'medium',
    level_label: 'Moyen',
    triggers: 'Juniper, Grasses, Chenopods',
    location: 'Denver, CO',
  });
  const declared = keysOf(declarationOf('scene_actions', 'get_forecast').outputs);
  for (const key of Object.keys(outputs)) {
    assert.ok(declared.includes(key), `output "${key}" is not declared, the core would drop it`);
  }
});

test('get_forecast defaults to today in English', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  const outputs = await SCENE_ACTIONS.get_forecast(gladys, {
    fields: { device: pollen.deviceExternalId(gladys, ZIP) },
    config,
  });
  assert.equal(outputs.index, 6.6);
  assert.equal(outputs.level_label, 'Medium');
});

test('get_forecast serves the last read when IQVIA is down', async (t) => {
  let down = false;
  t.mock.method(
    globalThis,
    'fetch',
    fakeFetch({ pollenCurrent: () => (down ? { status: 403 } : pollenCurrent()) }),
  );
  const gladys = createFakeGladys();
  await refreshForecast(gladys, pollen, ZIP);
  down = true;
  const outputs = await SCENE_ACTIONS.get_forecast(gladys, {
    fields: { device: pollen.deviceExternalId(gladys, ZIP) },
    config: { ...config, poll_frequency: 0 }, // force a new read
  });
  assert.equal(outputs.index, 6.6);
});

test('get_forecast fails on a device that is not one of the forecasts', async () => {
  await assert.rejects(
    SCENE_ACTIONS.get_forecast(createFakeGladys(), { fields: { device: 'nope' }, config }),
    /not an IQVIA forecast/,
  );
});

test('refresh_forecasts returns the declared outputs', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const outputs = await SCENE_ACTIONS.refresh_forecasts(createFakeGladys(), { fields: {}, config });
  assert.deepEqual(outputs, { refreshed: 3, failed: 0 });
  const declared = keysOf(declarationOf('scene_actions', 'refresh_forecasts').outputs);
  assert.deepEqual(Object.keys(outputs).sort(), [...declared].sort());
});

test('Gladys runs a scene action through the SDK', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  gladys.onSceneAction('refresh_forecasts', (fields) =>
    SCENE_ACTIONS.refresh_forecasts(gladys, { fields, config }),
  );
  const ack = await gladys.fake.sceneAction('refresh_forecasts', {});
  assert.equal(ack.success, true);
});
