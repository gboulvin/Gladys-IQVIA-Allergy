// -----------------------------------------------------------------------------
// Shared shape of the three IQVIA forecast devices (pollen, asthma, cold &
// flu). Each one is a read-only "sensor" device per ZIP code: today's and
// tomorrow's index (0 to 12), plus a few text features depending on what the
// forecast carries (main allergens, pollen season...).
//
// IQVIA sells no hardware: these devices are the forecasts of one location,
// refreshed by polling the IQVIA websites (see src/iqvia.js).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { INDEX_MAX, INDEX_MIN } from '../i18n.js';

// Feature keys shared by every forecast. Never rename one: they are part of
// the feature external ids Gladys stores.
export const FEATURE = {
  INDEX_TODAY: 'index-today',
  INDEX_TOMORROW: 'index-tomorrow',
  TRIGGERS_TODAY: 'triggers-today',
  SEASON: 'season',
  TREND: 'trend',
};

// Texts are truncated at 200 characters by the core.
const MAX_TEXT_LENGTH = 200;
const truncate = (text) =>
  text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH - 1)}…` : text;

/**
 * An index feature: a 0-12 risk score, kept in history for the charts.
 */
function indexFeature(ids, key, name) {
  return {
    name,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.RISK,
    type: DEVICE_FEATURE_TYPES.RISK.INTEGER,
    min: INDEX_MIN,
    max: INDEX_MAX,
    read_only: true,
    has_feedback: false,
    keep_history: true,
  };
}

/**
 * A text feature (allergen names, season...): no range, no history.
 */
function textFeature(ids, key, name) {
  return {
    name,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    min: 0,
    max: 0,
    read_only: true,
    has_feedback: false,
    keep_history: false,
  };
}

/**
 * Build a forecast blueprint.
 * @param {object} options
 * @param {string} options.key device type, part of the external ids (never rename)
 * @param {'pollen' | 'asthma' | 'cold_flu'} options.forecast forecast key used by scenes and widgets
 * @param {string} options.name device name prefix, e.g. 'IQVIA pollen'
 * @param {(zipCode: string) => Promise<object>} options.fetch reads the forecast from IQVIA
 * @param {Array<{ key: string, name: string, read: (data: object) => string | null }>} [options.texts]
 *   the text features of the device
 * @param {string[]} [options.sceneTriggers] the scene triggers the device fires
 */
export function createForecastBlueprint({ key, forecast, name, fetch, texts = [], sceneTriggers }) {
  return {
    key,
    forecast,
    sceneTriggers,
    fetch,

    // The platform id is the ZIP code: one device per forecast and location.
    deviceExternalId(gladys, zipCode) {
      return gladys.externalIds(key, zipCode).device;
    },

    featureExternalId(gladys, zipCode, featureKey) {
      return gladys.externalIds(key, zipCode).feature(featureKey);
    },

    buildDevice(gladys, zipCode) {
      const ids = gladys.externalIds(key, zipCode);
      return {
        name: `${name} ${zipCode}`,
        external_id: ids.device,
        // Gladys polls at most once a minute; the refresh interval of the
        // config is applied by skipping polls (createPoller in ./index.js).
        // `should_poll` stays explicit for the older cores.
        should_poll: true,
        poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
        features: [
          indexFeature(ids, FEATURE.INDEX_TODAY, 'Index today'),
          indexFeature(ids, FEATURE.INDEX_TOMORROW, 'Index tomorrow'),
          ...texts.map((text) => textFeature(ids, text.key, text.name)),
        ],
      };
    },

    /**
     * The states to publish for a forecast read from IQVIA. A value IQVIA
     * did not give is not published (the previous one stays).
     */
    statesOf(gladys, zipCode, data) {
      const ids = gladys.externalIds(key, zipCode);
      const states = [];
      for (const [featureKey, day] of [
        [FEATURE.INDEX_TODAY, data.today],
        [FEATURE.INDEX_TOMORROW, data.tomorrow],
      ]) {
        if (typeof day?.index === 'number') {
          states.push({ device_feature_external_id: ids.feature(featureKey), state: day.index });
        }
      }
      for (const text of texts) {
        const value = text.read(data);
        if (typeof value === 'string') {
          states.push({ device_feature_external_id: ids.feature(text.key), text: truncate(value) });
        }
      }
      return states;
    },
  };
}
