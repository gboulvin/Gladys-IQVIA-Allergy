import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { ACTIONS } from '../src/actions.js';
import { resetForecasts } from '../src/devices/index.js';
import { LANGUAGES, MESSAGES } from '../src/i18n.js';
import { normalizeConfig } from '../src/config.js';
import { ZIP, emptyResponse, fakeFetch } from './fixtures.js';

beforeEach(() => resetForecasts());

const assertTranslated = (message) => {
  for (const language of LANGUAGES) {
    assert.equal(typeof message[language], 'string', `missing ${language}`);
  }
};

test('test_connection shows the location and today pollen level in every language', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch());
  const message = await ACTIONS.test_connection(createFakeGladys(), {
    fields: {},
    config: normalizeConfig({ zip_codes: ZIP }),
  });
  assertTranslated(message);
  assert.equal(message.en, 'Denver, CO (80238): pollen 6.6 — Medium');
  assert.equal(message.fr, 'Denver, CO (80238): pollen 6.6 — Moyen');
});

test('test_connection reports a ZIP code IQVIA does not know', async (t) => {
  t.mock.method(globalThis, 'fetch', fakeFetch({ pollenCurrent: emptyResponse }));
  const message = await ACTIONS.test_connection(createFakeGladys(), {
    fields: {},
    config: normalizeConfig({ zip_codes: '00000' }),
  });
  assert.equal(message.en, '00000: no forecast for this ZIP code');
});

test('the actions ask for a ZIP code when none is configured', async () => {
  for (const action of Object.values(ACTIONS)) {
    const message = await action(createFakeGladys(), { fields: {}, config: normalizeConfig() });
    assert.deepEqual(message, MESSAGES.noZipCode);
  }
});

test('refresh reads every forecast', async (t) => {
  const fetch = fakeFetch();
  t.mock.method(globalThis, 'fetch', fetch);
  const gladys = createFakeGladys();
  const message = await ACTIONS.refresh(gladys, {
    fields: {},
    config: normalizeConfig({ zip_codes: ZIP }),
  });
  assert.deepEqual(message, MESSAGES.refreshed);
  assert.ok(gladys.fake.states.length > 0);
});

test('every message of the integration is translated', () => {
  for (const message of Object.values(MESSAGES)) {
    assertTranslated(message);
  }
});
