// -----------------------------------------------------------------------------
// Scene triggers (SDK v0.14+, Gladys 5.1+).
//
// A trigger says "this happened, with these details". The forecast devices
// fire two of them, declared in the manifest `scene_triggers` field:
//
//   - `level_changed`: today's level of a forecast moved to another band
//     (e.g. pollen "Medium" -> "Medium-high"). The scene author can filter on
//     the device and on the new level;
//   - `forecast_updated`: IQVIA published a new daily forecast (its
//     ForecastDate changed) — the moment to send a morning notification.
//
// Neither fires on the first read after a (re)start: there is nothing to
// compare with, and a restart is not an event. One event per transition, flat
// `data` with only the keys the manifest declares (the core drops the others).
// -----------------------------------------------------------------------------

import { levelOf } from '../i18n.js';

export const LEVEL_CHANGED_TRIGGER = 'level_changed';
export const FORECAST_UPDATED_TRIGGER = 'forecast_updated';

export const FORECAST_SCENE_TRIGGERS = [LEVEL_CHANGED_TRIGGER, FORECAST_UPDATED_TRIGGER];

/**
 * The scene events a new forecast read gives rise to.
 * @param {object} options
 * @param {string} options.device device external_id (the `device` filter)
 * @param {string} options.forecast 'pollen' | 'asthma' | 'cold_flu'
 * @param {string} options.zipCode
 * @param {object | undefined} options.previous the previous read, if any
 * @param {object} options.next the new read
 * @returns {Array<{ key: string, data: Record<string, string | number | null> }>}
 */
export function sceneEventsOf({ device, forecast, zipCode, previous, next }) {
  if (!previous) {
    return [];
  }
  const events = [];
  const previousLevel = levelOf(previous.today?.index);
  const level = levelOf(next.today?.index);
  if (previousLevel && level && previousLevel.key !== level.key) {
    events.push({
      key: LEVEL_CHANGED_TRIGGER,
      data: {
        device,
        level: level.key,
        previous_level: previousLevel.key,
        index: next.today.index,
        forecast,
        zip_code: zipCode,
      },
    });
  }
  if (previous.forecastDate && next.forecastDate && previous.forecastDate !== next.forecastDate) {
    const tomorrowLevel = levelOf(next.tomorrow?.index);
    events.push({
      key: FORECAST_UPDATED_TRIGGER,
      data: {
        device,
        forecast,
        zip_code: zipCode,
        location: next.location?.name || zipCode,
        index_today: next.today?.index ?? null,
        level_today: level?.key ?? null,
        index_tomorrow: next.tomorrow?.index ?? null,
        level_tomorrow: tomorrowLevel?.key ?? null,
        triggers: next.today?.triggers?.join(', ') ?? '',
      },
    });
  }
  return events;
}
