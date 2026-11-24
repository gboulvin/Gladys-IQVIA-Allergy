// -----------------------------------------------------------------------------
// Dashboard widgets (SDK v0.14+, Gladys 5.1+).
//
// `allergy_forecast` puts the IQVIA forecasts of one location on the
// dashboard: today's pollen, asthma and cold & flu indexes as LIVE tiles
// (bound to the device features, they follow the published states), the
// forecast of the next days as a chart, the levels and main allergens as a
// status list, and a button to read IQVIA again.
//
// The content is DECLARATIVE — the core renders it with its own theme, dark
// mode and translations. Check it in the tests with `validateWidgetContent`.
// -----------------------------------------------------------------------------

import { createLogger, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import {
  DEVICE_BLUEPRINTS,
  ensureForecast,
  getForecast,
  refreshAll,
  resolveDevice,
} from './devices/index.js';
import { FEATURE } from './devices/forecast.js';
import { FORECAST_LABELS, MESSAGES, inEveryLanguage, levelOf } from './i18n.js';

const logger = createLogger({ name: 'widgets' });

// Widget key, as declared in the manifest `widgets` field.
export const ALLERGY_FORECAST_WIDGET = 'allergy_forecast';

// Keys of the `button` actions the content declares.
const ACTIONS = { REFRESH: 'refresh' };

const MAX_STATUS_VALUE = 40;
const MAX_HEADING = 40;
const shorten = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const LABELS = {
  today: (forecast) =>
    inEveryLanguage((language) => {
      const name = FORECAST_LABELS[forecast][language];
      return {
        en: `${name} today`,
        fr: `${name} aujourd'hui`,
        de: `${name} heute`,
        es: `${name} hoy`,
      }[language];
    }),
  allergens: { en: 'Allergens', fr: 'Allergènes', de: 'Allergene', es: 'Alérgenos' },
  season: {
    en: 'Pollen season',
    fr: 'Saison pollinique',
    de: 'Pollensaison',
    es: 'Temporada de polen',
  },
  noData: { en: 'No data', fr: 'Pas de données', de: 'Keine Daten', es: 'Sin datos' },
  chartTitle: {
    en: 'Next days',
    fr: 'Prochains jours',
    de: 'Nächste Tage',
    es: 'Próximos días',
  },
  refresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
};

/**
 * The ZIP code a widget instance shows: the one of the device chosen in its
 * `location` setting, else the first ZIP code of the configuration.
 */
function zipCodeOf(gladys, settings, config) {
  if (settings?.location) {
    const resolved = resolveDevice(gladys, settings.location, config);
    if (resolved) {
      return resolved.zipCode;
    }
  }
  return config.zipCodes[0];
}

/** The forecasts of a ZIP code, read from IQVIA when stale, else the last read. */
async function forecastsOf(gladys, zipCode, config) {
  return Promise.all(
    DEVICE_BLUEPRINTS.map(async (blueprint) => {
      let data;
      try {
        data = await ensureForecast(gladys, blueprint, zipCode, config.poll_frequency * 1000);
      } catch (err) {
        logger.warn(`Widget: ${blueprint.forecast} ${zipCode} unavailable: ${err.message}`);
        data = getForecast(blueprint, zipCode)?.data;
      }
      return { blueprint, data };
    }),
  );
}

function levelItem(forecast, data) {
  const level = levelOf(data?.today?.index);
  return {
    label: LABELS.today(forecast),
    icon: 'activity',
    value: level ? level.label : LABELS.noData,
    color: level ? level.color : WIDGET_COLORS.NEUTRAL,
  };
}

export async function buildAllergyForecastContent(gladys, { settings, config }) {
  const zipCode = zipCodeOf(gladys, settings, config);
  if (!zipCode) {
    return {
      ttl_seconds: 300,
      components: [{ type: 'text', variant: 'body', text: MESSAGES.noZipCode }],
    };
  }

  const forecasts = await forecastsOf(gladys, zipCode, config);
  const pollenData = forecasts.find(({ blueprint }) => blueprint.forecast === 'pollen').data;
  const location = forecasts.find(({ data }) => data?.location?.name)?.data.location.name;

  const components = [
    { type: 'text', variant: 'heading', text: shorten(location || zipCode, MAX_HEADING) },
    // Device-bound tiles: LIVE, they follow the published states.
    ...forecasts.map(({ blueprint, data }) => ({
      type: 'value',
      label: FORECAST_LABELS[blueprint.forecast],
      icon: 'wind',
      color: levelOf(data?.today?.index)?.color ?? WIDGET_COLORS.NEUTRAL,
      device_feature: blueprint.featureExternalId(gladys, zipCode, FEATURE.INDEX_TODAY),
    })),
  ];

  // The forecast of the next days: data the core has no history of.
  const series = forecasts
    .filter(({ data }) => data?.days?.length > 0)
    .map(({ blueprint, data }) => ({
      name: FORECAST_LABELS[blueprint.forecast],
      points: data.days.map((day) => ({ t: `${day.date}T12:00:00Z`, v: day.index })),
    }));
  if (series.length > 0) {
    components.push({ type: 'chart', chart_type: 'line', title: LABELS.chartTitle, series });
  }

  const items = forecasts.map(({ blueprint, data }) => levelItem(blueprint.forecast, data));
  const allergens = pollenData?.today?.triggers ?? [];
  if (allergens.length > 0) {
    items.push({
      label: LABELS.allergens,
      icon: 'feather',
      value: shorten(allergens.join(', '), MAX_STATUS_VALUE),
      color: WIDGET_COLORS.INFO,
    });
  }
  if (pollenData?.season) {
    items.push({
      label: LABELS.season,
      icon: 'calendar',
      value: shorten(
        [pollenData.season, pollenData.trend].filter(Boolean).join(' · '),
        MAX_STATUS_VALUE,
      ),
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  components.push({ type: 'status', items });

  // `params` are declared HERE and sent back as-is: the handler never
  // receives user input.
  components.push({
    type: 'button',
    label: LABELS.refresh,
    icon: 'refresh-cw',
    style: 'secondary',
    action: { key: ACTIONS.REFRESH },
  });

  return {
    // The tiles are live; the computed parts change at most once per read.
    ttl_seconds: Math.min(Math.max(config.poll_frequency, 60), 3600),
    components,
  };
}

export const WIDGETS = {
  [ALLERGY_FORECAST_WIDGET]: {
    async get(gladys, { settings, config }) {
      logger.debug(`onWidgetGet <- ${ALLERGY_FORECAST_WIDGET}`);
      return buildAllergyForecastContent(gladys, { settings, config });
    },

    // Resolve an optional toast. After a successful action the core drops the
    // cached content and every open dashboard refetches it.
    async action(gladys, { actionKey, config }) {
      logger.info(`onWidgetAction <- ${ALLERGY_FORECAST_WIDGET}.${actionKey}`);
      if (actionKey === ACTIONS.REFRESH) {
        const { failed } = await refreshAll(gladys, config);
        return failed > 0 ? MESSAGES.refreshFailed : MESSAGES.refreshed;
      }
      // Throwing acks the action as failed: the message reaches the user.
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  },
};

/**
 * Freshness nudge: ask the core to re-pull every widget NOW instead of
 * waiting for the content TTL (rate-limited core-side, dropped while
 * disconnected).
 */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    gladys.requestWidgetRefresh(key);
  }
}
