import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import {
  buildDiscoveredDevices,
  findBlueprintByForecast,
  resetForecasts,
} from '../src/devices/index.js';
import { ALLERGY_FORECAST_WIDGET, WIDGETS, refreshWidgets } from '../src/widgets.js';
import { MESSAGES } from '../src/i18n.js';
import { normalizeConfig } from '../src/config.js';
import { ZIP, fakeFetch } from './fixtures.js';

const config = normalizeConfig({ zip_codes: `${ZIP}, 10001` });
const widget = WIDGETS[ALLERGY_FORECAST_WIDGET];

const getContent = (gladys, { settings = {}, cfg = config, language = 'en' } = {}) =>
  widget.get(gladys, { settings, language, units: 'metric', config: cfg });

beforeEach(() => resetForecasts());

for (const language of ['en', 'fr', 'de', 'es']) {
  test(`the allergy_forecast content is rendered exactly as sent (${language})`, async (t) => {
    t.mock.method(globalThis, 'fetch', fakeFetch());
    const content = await getContent(createFakeGladys(), { language });
    assert.deepEqual(validateWidgetContent(content), []);
    assert.ok(
      content.components.some((c) => c.type === 'chart'),
      'the next days are charted',
    );
  });
}

test('the content without any data is still valid', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    fakeFetch({
      pollenCurrent: { status: 403 },
      asthmaCurrent: { status: 403 },
      coldFluExtended: { status: 403 },
    }),
  );
  const content = await getContent(createFakeGladys());
  assert.deepEqual(validateWidgetContent(content), []);
  assert.ok(!content.components.some((c) => c.type === 'chart'));
});

test('without ZIP code the widget explains what to configure', async () => {
  const content = await getContent(createFakeGladys(), { cfg: normalizeConfig() });
  assert.deepEqual(validateWidgetContent(content), []);
  assert.deepEqual(content.components, [
    { type: 'text', variant: 'body', text: MESSAGES.noZipCode },
  ]);
});

test('the location setting picks the ZIP code of the chosen device', async (t) => {
  const fetch = fakeFetch();
  t.mock.method(globalThis, 'fetch', fetch);
  const gladys = createFakeGladys();
  const asthma = findBlueprintByForecast('asthma');
  await getContent(gladys, { settings: { location: asthma.deviceExternalId(gladys, '10001') } });
  assert.ok(fetch.calls.every(({ url }) => url.endsWith('/10001')));
});

test('the live tiles reference features the integration publishes', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  const featureIds = new Set(
    buildDiscoveredDevices(gladys, config).flatMap((device) =>
      device.features.map((feature) => feature.external_id),
    ),
  );
  const liveTiles = (await getContent(gladys)).components.filter((c) => c.device_feature);
  assert.equal(liveTiles.length, 3);
  for (const tile of liveTiles) {
    assert.ok(featureIds.has(tile.device_feature), `unknown feature ${tile.device_feature}`);
  }
});

test('every button action of the content is handled and answers a short toast', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const gladys = createFakeGladys();
  const buttons = (await getContent(gladys)).components.filter(
    (c) => c.type === 'button' && c.action,
  );
  assert.ok(buttons.length > 0);
  for (const { action } of buttons) {
    const message = await widget.action(gladys, {
      actionKey: action.key,
      params: action.params ?? {},
      settings: {},
      config,
    });
    for (const text of Object.values(message)) {
      assert.ok(text.length <= 200, 'toasts are capped at 200 characters');
    }
  }
  await assert.rejects(
    widget.action(gladys, { actionKey: 'nope', params: {}, settings: {}, config }),
    /Unknown widget action/,
  );
});

test('refreshWidgets nudges every widget', () => {
  const gladys = createFakeGladys();
  refreshWidgets(gladys);
  assert.deepEqual(
    gladys.fake.widgetRefreshes.map((entry) => entry.key ?? entry),
    Object.keys(WIDGETS),
  );
});
