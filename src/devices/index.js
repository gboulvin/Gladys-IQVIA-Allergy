// -----------------------------------------------------------------------------
// Device registry.
//
// IQVIA publishes three forecasts per US ZIP code: pollen, asthma, cold & flu.
// Each one is a blueprint (see ./forecast.js) instantiated once per ZIP code
// of the configuration, so the user can follow several locations.
//
// A blueprint exposes:
//   - key, forecast                  : device type and forecast key
//   - deviceExternalId(gladys, zip)  : the device external_id
//   - buildDevice(gladys, zip)       : the discovery payload. Every feature
//     carries `name`, `min`, `max`, `read_only` and `has_feedback`
//   - fetch(zip)                     : reads the forecast from IQVIA
//   - statesOf(gladys, zip, data)    : the states to publish for a read
//   - sceneTriggers                  : the manifest `scene_triggers` it fires
//
// This module also keeps the last read of every forecast in memory: the
// widget, the scene actions and the transport badges are served from it.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_POLL_FREQUENCIES,
  DEVICE_TRANSPORTS,
} from '@gladysassistant/integration-sdk';
import { pollen } from './pollen.js';
import { asthma } from './asthma.js';
import { coldFlu } from './coldFlu.js';
import { sceneEventsOf } from './triggers.js';

const logger = createLogger({ name: 'devices' });

export const DEVICE_BLUEPRINTS = [pollen, asthma, coldFlu];

// Every scene trigger key the devices fire: each one must be declared in the
// manifest `scene_triggers` field, or the core answers 404 (see the tests).
export const SCENE_TRIGGER_KEYS = [
  ...new Set(DEVICE_BLUEPRINTS.flatMap((bp) => bp.sceneTriggers ?? [])),
];

// An unchanged value is re-sent every hour, so it stays recently dated.
const STATES_HEARTBEAT_MS = 60 * 60 * 1000;

/** The blueprint of a forecast key ('pollen' | 'asthma' | 'cold_flu'). */
export function findBlueprintByForecast(forecast) {
  return DEVICE_BLUEPRINTS.find((bp) => bp.forecast === forecast);
}

/**
 * Build the discovery payload for Gladys: every forecast of every ZIP code.
 */
export function buildDiscoveredDevices(gladys, config) {
  return config.zipCodes.flatMap((zipCode) =>
    DEVICE_BLUEPRINTS.map((bp) => bp.buildDevice(gladys, zipCode)),
  );
}

/**
 * Find the blueprint and the ZIP code of a device, from its external_id.
 * Only the ZIP codes of the current configuration are resolved: a device
 * left over from a removed ZIP code is not refreshed any more.
 * @returns {{ blueprint: object, zipCode: string } | undefined}
 */
export function resolveDevice(gladys, externalId, config) {
  for (const zipCode of config.zipCodes) {
    for (const blueprint of DEVICE_BLUEPRINTS) {
      if (blueprint.deviceExternalId(gladys, zipCode) === externalId) {
        return { blueprint, zipCode };
      }
    }
  }
  return undefined;
}

// --- Last reads ---------------------------------------------------------------

// `${forecast}:${zipCode}` -> { data, fetchedAt, ok, error }
const forecasts = new Map();

const storeKey = (blueprint, zipCode) => `${blueprint.forecast}:${zipCode}`;

/** The last read of a forecast: `{ data, fetchedAt, ok, error }` or undefined. */
export function getForecast(blueprint, zipCode) {
  return forecasts.get(storeKey(blueprint, zipCode));
}

/** Forget every read (tests, or a configuration change). */
export function resetForecasts() {
  forecasts.clear();
}

/**
 * Read one forecast from IQVIA, publish its states and fire the scene
 * triggers it gives rise to. Throws when IQVIA cannot be read: the previous
 * read is kept (the states stay as they were), flagged as failed.
 */
export async function refreshForecast(gladys, blueprint, zipCode) {
  const key = storeKey(blueprint, zipCode);
  const previous = forecasts.get(key);
  let data;
  try {
    data = await blueprint.fetch(zipCode);
  } catch (err) {
    forecasts.set(key, { ...previous, ok: false, error: err.message });
    throw err;
  }
  forecasts.set(key, { data, fetchedAt: Date.now(), ok: true, error: null });
  logger.info(
    `${blueprint.forecast} ${zipCode}: today ${data.today?.index ?? '-'}, tomorrow ${data.tomorrow?.index ?? '-'}`,
  );

  await gladys.publishChangedStates(blueprint.statesOf(gladys, zipCode, data), {
    heartbeat: STATES_HEARTBEAT_MS,
  });

  const events = sceneEventsOf({
    device: blueprint.deviceExternalId(gladys, zipCode),
    forecast: blueprint.forecast,
    zipCode,
    previous: previous?.data,
    next: data,
  });
  for (const { key: triggerKey, data: eventData } of events) {
    try {
      await gladys.publishSceneEvent(triggerKey, eventData);
    } catch (err) {
      logger.error(`Scene event ${triggerKey} publication failed`, err);
    }
  }
  return data;
}

/**
 * The last read of a forecast, read from IQVIA first when there is none or
 * when it is older than `maxAgeMs`.
 */
export async function ensureForecast(gladys, blueprint, zipCode, maxAgeMs) {
  const cached = getForecast(blueprint, zipCode);
  if (cached?.data && cached.ok && Date.now() - cached.fetchedAt < maxAgeMs) {
    return cached.data;
  }
  return refreshForecast(gladys, blueprint, zipCode);
}

/**
 * Refresh every forecast of every ZIP code. Never throws: resolves the
 * number of forecasts read and failed.
 */
export async function refreshAll(gladys, config) {
  const jobs = config.zipCodes.flatMap((zipCode) =>
    DEVICE_BLUEPRINTS.map((blueprint) => ({ blueprint, zipCode })),
  );
  const results = await Promise.allSettled(
    jobs.map(({ blueprint, zipCode }) => refreshForecast(gladys, blueprint, zipCode)),
  );
  let failed = 0;
  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      failed += 1;
      logger.error(
        `Refresh of ${jobs[i].blueprint.forecast} ${jobs[i].zipCode} failed: ${result.reason?.message}`,
      );
    }
  });
  return { ok: results.length - failed, failed };
}

// --- Polling ------------------------------------------------------------------

// Gladys' poll ticks drift by a few milliseconds: a read due within the next
// half-minute runs now, so a 3600 s interval does not slip to 3660 s.
const POLL_TOLERANCE_MS = DEVICE_POLL_FREQUENCIES.EVERY_MINUTES / 2;

/**
 * Create the `onPoll` dispatcher: route the poll to the owner blueprint, at
 * the refresh interval the user chose (`poll_frequency` config, in seconds).
 *
 * Gladys polls a device at most once a minute (DEVICE_POLL_FREQUENCIES): the
 * devices declare that minute, and the slower interval of the config is
 * applied here by skipping the polls in between. A read that throws is
 * retried at the next poll.
 *
 * Resolves `true` when the device was read, `false` when the poll was skipped.
 */
export function createPoller() {
  const lastReads = new Map();
  return async function pollDevice(gladys, device, config) {
    const resolved = resolveDevice(gladys, device.external_id, config);
    if (!resolved) {
      return false;
    }
    const now = Date.now();
    const lastRead = lastReads.get(device.external_id);
    if (
      lastRead !== undefined &&
      now - lastRead < config.poll_frequency * 1000 - POLL_TOLERANCE_MS
    ) {
      return false;
    }
    await refreshForecast(gladys, resolved.blueprint, resolved.zipCode);
    lastReads.set(device.external_id, now);
    return true;
  };
}

// --- Transport badge ----------------------------------------------------------

/**
 * Build the `publishTransports` payload. IQVIA is a cloud service (manifest
 * `"transports": ["cloud"]`): a forecast is `cloud` when its last read
 * succeeded, `unreachable` when it failed. A forecast not read yet is left
 * out.
 */
export function buildTransportEntries(gladys, config) {
  const entries = [];
  for (const zipCode of config.zipCodes) {
    for (const blueprint of DEVICE_BLUEPRINTS) {
      const forecast = getForecast(blueprint, zipCode);
      if (forecast) {
        entries.push({
          external_id: blueprint.deviceExternalId(gladys, zipCode),
          transport: forecast.ok ? DEVICE_TRANSPORTS.CLOUD : DEVICE_TRANSPORTS.UNREACHABLE,
        });
      }
    }
  }
  return entries;
}
