// -----------------------------------------------------------------------------
// Translations and risk levels.
//
// Every user-facing text is a multi-language object (`{ en, fr, de, es }`):
// Gladys picks the user's language and falls back to `en`. The IQVIA data
// itself (allergen names, city names) comes in English from the API and is
// shown as is.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// IQVIA rates every forecast on a 0 to 12 index. These are the five bands
// pollen.com, asthmaforecast.com and flustar.com display.
export const INDEX_MIN = 0;
export const INDEX_MAX = 12;

export const LEVELS = [
  {
    key: 'low',
    max: 2.4,
    color: WIDGET_COLORS.SUCCESS,
    label: { en: 'Low', fr: 'Faible', de: 'Niedrig', es: 'Bajo' },
  },
  {
    key: 'low_medium',
    max: 4.8,
    color: WIDGET_COLORS.SUCCESS,
    label: { en: 'Low-medium', fr: 'Faible à moyen', de: 'Niedrig bis mittel', es: 'Bajo-medio' },
  },
  {
    key: 'medium',
    max: 7.2,
    color: WIDGET_COLORS.WARNING,
    label: { en: 'Medium', fr: 'Moyen', de: 'Mittel', es: 'Medio' },
  },
  {
    key: 'medium_high',
    max: 9.6,
    color: WIDGET_COLORS.DANGER,
    label: { en: 'Medium-high', fr: 'Moyen à élevé', de: 'Mittel bis hoch', es: 'Medio-alto' },
  },
  {
    key: 'high',
    max: INDEX_MAX,
    color: WIDGET_COLORS.DANGER,
    label: { en: 'High', fr: 'Élevé', de: 'Hoch', es: 'Alto' },
  },
];

export const LEVEL_KEYS = LEVELS.map((level) => level.key);

/**
 * The level band of an index, or `null` when there is no index.
 * @param {number | null | undefined} index IQVIA index (0 to 12)
 */
export function levelOf(index) {
  if (typeof index !== 'number' || !Number.isFinite(index)) {
    return null;
  }
  return LEVELS.find((level) => index <= level.max) ?? LEVELS.at(-1);
}

/**
 * Pick one language of a multi-language object, with English as fallback.
 * @param {Record<string, string>} message
 * @param {string | null | undefined} language
 */
export function translate(message, language) {
  return message[language] ?? message.en;
}

// The three IQVIA forecasts, as named in the user interface.
export const FORECAST_LABELS = {
  pollen: { en: 'Pollen', fr: 'Pollen', de: 'Pollen', es: 'Polen' },
  asthma: { en: 'Asthma', fr: 'Asthme', de: 'Asthma', es: 'Asma' },
  cold_flu: {
    en: 'Cold & flu',
    fr: 'Rhume et grippe',
    de: 'Erkältung & Grippe',
    es: 'Resfriado y gripe',
  },
};

/**
 * Build a multi-language object from a function of the language.
 * @param {(language: string) => string} build
 */
export function inEveryLanguage(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

export const MESSAGES = {
  noZipCode: {
    en: 'Enter at least one valid 5-digit US ZIP code in the configuration.',
    fr: 'Saisissez au moins un code postal américain valide à 5 chiffres dans la configuration.',
    de: 'Geben Sie in der Konfiguration mindestens eine gültige 5-stellige US-Postleitzahl ein.',
    es: 'Introduzca al menos un código postal estadounidense válido de 5 dígitos en la configuración.',
  },
  unreachable: {
    en: 'IQVIA could not be reached, check the integration logs.',
    fr: "IQVIA est injoignable, consultez les logs de l'intégration.",
    de: 'IQVIA ist nicht erreichbar, prüfen Sie die Protokolle der Integration.',
    es: 'No se pudo contactar con IQVIA, consulte los registros de la integración.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Die Initialisierung ist fehlgeschlagen, prüfen Sie die Protokolle der Integration.',
    es: 'La inicialización falló, consulte los registros de la integración.',
  },
  refreshed: {
    en: 'Forecasts refreshed.',
    fr: 'Prévisions actualisées.',
    de: 'Vorhersagen aktualisiert.',
    es: 'Previsiones actualizadas.',
  },
  refreshFailed: {
    en: 'Some forecasts could not be refreshed, check the integration logs.',
    fr: "Certaines prévisions n'ont pas pu être actualisées, consultez les logs de l'intégration.",
    de: 'Einige Vorhersagen konnten nicht aktualisiert werden, prüfen Sie die Protokolle der Integration.',
    es: 'Algunas previsiones no se pudieron actualizar, consulte los registros de la integración.',
  },
};
