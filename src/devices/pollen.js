// -----------------------------------------------------------------------------
// Device type: POLLEN FORECAST (pollen.com)
// Today's and tomorrow's allergy index, the main allergens of the day, and the
// seasonal outlook (dominant pollen, trend).
// -----------------------------------------------------------------------------

import { fetchPollen } from '../iqvia.js';
import { FEATURE, createForecastBlueprint } from './forecast.js';
import { FORECAST_SCENE_TRIGGERS } from './triggers.js';

export const pollen = createForecastBlueprint({
  key: 'pollen',
  forecast: 'pollen',
  name: 'IQVIA pollen',
  fetch: fetchPollen,
  sceneTriggers: FORECAST_SCENE_TRIGGERS,
  texts: [
    {
      key: FEATURE.TRIGGERS_TODAY,
      name: 'Allergens today',
      read: (data) => (data.today ? data.today.triggers.join(', ') : null),
    },
    { key: FEATURE.SEASON, name: 'Pollen season', read: (data) => data.season },
    { key: FEATURE.TREND, name: 'Pollen trend', read: (data) => data.trend },
  ],
});
