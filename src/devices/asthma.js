// -----------------------------------------------------------------------------
// Device type: ASTHMA FORECAST (asthmaforecast.com)
// Today's and tomorrow's asthma index, and the main triggers of the day
// (ozone, fine particles...).
// -----------------------------------------------------------------------------

import { fetchAsthma } from '../iqvia.js';
import { FEATURE, createForecastBlueprint } from './forecast.js';
import { FORECAST_SCENE_TRIGGERS } from './triggers.js';

export const asthma = createForecastBlueprint({
  key: 'asthma',
  forecast: 'asthma',
  name: 'IQVIA asthma',
  fetch: fetchAsthma,
  sceneTriggers: FORECAST_SCENE_TRIGGERS,
  texts: [
    {
      key: FEATURE.TRIGGERS_TODAY,
      name: 'Triggers today',
      read: (data) => (data.today ? data.today.triggers.join(', ') : null),
    },
  ],
});
