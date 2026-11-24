// -----------------------------------------------------------------------------
// Manifest actions: the buttons of the Configuration screen (manifest
// `actions` field). Each handler resolves the multi-language message shown
// under the button; a thrown error is shown too.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { findBlueprintByForecast, refreshAll, refreshForecast } from './devices/index.js';
import { InvalidZipCodeError } from './iqvia.js';
import { MESSAGES, inEveryLanguage, levelOf, translate } from './i18n.js';

const logger = createLogger({ name: 'actions' });

const TEXTS = {
  pollen: { en: 'pollen', fr: 'pollen', de: 'Pollen', es: 'polen' },
  noForecast: {
    en: 'no forecast for this ZIP code',
    fr: 'aucune prévision pour ce code postal',
    de: 'keine Vorhersage für diese Postleitzahl',
    es: 'ninguna previsión para este código postal',
  },
  failed: { en: 'failed', fr: 'échec', de: 'fehlgeschlagen', es: 'error' },
  noIndex: {
    en: 'no index today',
    fr: "pas d'indice aujourd'hui",
    de: 'kein Index heute',
    es: 'sin índice hoy',
  },
};

export const ACTIONS = {
  /**
   * Read today's pollen forecast of every ZIP code, live, and say what came
   * back: the quickest way to check the configuration.
   */
  async test_connection(gladys, { config }) {
    logger.info('Action test_connection -> live request to IQVIA');
    if (config.zipCodes.length === 0) {
      return MESSAGES.noZipCode;
    }
    const pollen = findBlueprintByForecast('pollen');
    const lines = await Promise.all(
      config.zipCodes.map(async (zipCode) => {
        try {
          const data = await refreshForecast(gladys, pollen, zipCode);
          const level = levelOf(data.today?.index);
          const where = data.location?.name || zipCode;
          return (language) =>
            level
              ? `${where} (${zipCode}): ${translate(TEXTS.pollen, language)} ${data.today.index} — ${translate(level.label, language)}`
              : `${where} (${zipCode}): ${translate(TEXTS.noIndex, language)}`;
        } catch (err) {
          logger.error(`test_connection failed for ${zipCode}`, err);
          const reason = err instanceof InvalidZipCodeError ? TEXTS.noForecast : TEXTS.failed;
          return (language) => `${zipCode}: ${translate(reason, language)}`;
        }
      }),
    );
    return inEveryLanguage((language) => lines.map((line) => line(language)).join(' · '));
  },

  /** Read every forecast from IQVIA now. */
  async refresh(gladys, { config }) {
    logger.info('Action refresh');
    if (config.zipCodes.length === 0) {
      return MESSAGES.noZipCode;
    }
    const { failed } = await refreshAll(gladys, config);
    return failed > 0 ? MESSAGES.refreshFailed : MESSAGES.refreshed;
  },
};
