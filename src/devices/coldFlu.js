// -----------------------------------------------------------------------------
// Device type: COLD & FLU FORECAST (flustar.com)
// Today's and tomorrow's cold & flu index. IQVIA publishes no trigger for it.
// -----------------------------------------------------------------------------

import { fetchColdFlu } from '../iqvia.js';
import { createForecastBlueprint } from './forecast.js';
import { FORECAST_SCENE_TRIGGERS } from './triggers.js';

export const coldFlu = createForecastBlueprint({
  key: 'cold-flu',
  forecast: 'cold_flu',
  name: 'IQVIA cold & flu',
  fetch: fetchColdFlu,
  sceneTriggers: FORECAST_SCENE_TRIGGERS,
});
