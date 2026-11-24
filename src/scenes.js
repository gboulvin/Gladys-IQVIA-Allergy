// -----------------------------------------------------------------------------
// Scene actions (SDK v0.14+, Gladys 5.1+).
//
// Each action is declared in the manifest `scene_actions` field (key, label,
// `fields`, scalar `outputs`) and handled here, keyed by that same `key`;
// index.js registers every entry with `gladys.onSceneAction(key, ...)`.
//
//   - `get_forecast`: read the forecast of a device (today or tomorrow) and
//     hand its index, level and triggers to the following actions — e.g. a
//     notification "Pollen today: {{level_label}} ({{index}})";
//   - `refresh_forecasts`: read every forecast from IQVIA now.
//
// The rules that matter:
//   - `fields` arrive RESOLVED (scene variables substituted, defaults
//     applied); a `"source": "devices"` field is the chosen device external_id;
//   - only the declared `outputs` are kept by the core, scalars only;
//   - throwing fails THIS action only: the scene logs it and continues;
//   - never fire a scene event as a consequence of a received action... except
//     that `refresh_forecasts` reads IQVIA like a poll does: a real change of
//     level is a real event. It cannot loop, because a forecast only changes
//     once, whatever the number of reads.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { ensureForecast, getForecast, refreshAll, resolveDevice } from './devices/index.js';
import { LANGUAGES, levelOf, translate } from './i18n.js';

const logger = createLogger({ name: 'scenes' });

export const SCENE_ACTIONS = {
  async get_forecast(gladys, { fields, config }) {
    logger.info(`Scene action get_forecast <- ${fields.device} (${fields.day ?? 'today'})`);
    const resolved = resolveDevice(gladys, fields.device, config);
    if (!resolved) {
      throw new Error(`${fields.device} is not an IQVIA forecast of the configured ZIP codes`);
    }
    const { blueprint, zipCode } = resolved;
    let data;
    try {
      data = await ensureForecast(gladys, blueprint, zipCode, config.poll_frequency * 1000);
    } catch (err) {
      // IQVIA unreachable: the last known forecast is better than nothing.
      data = getForecast(blueprint, zipCode)?.data;
      if (!data) {
        throw err;
      }
      logger.warn(`get_forecast served from the last read: ${err.message}`);
    }
    const day = fields.day === 'tomorrow' ? data.tomorrow : data.today;
    const level = levelOf(day?.index);
    const language = LANGUAGES.includes(fields.language) ? fields.language : 'en';
    return {
      index: day?.index ?? null,
      level: level?.key ?? null,
      level_label: level ? translate(level.label, language) : null,
      triggers: day?.triggers?.join(', ') ?? '',
      location: data.location?.name || zipCode,
    };
  },

  async refresh_forecasts(gladys, { config }) {
    logger.info('Scene action refresh_forecasts');
    const { ok, failed } = await refreshAll(gladys, config);
    return { refreshed: ok, failed };
  },
};
