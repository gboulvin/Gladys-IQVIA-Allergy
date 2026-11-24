// -----------------------------------------------------------------------------
// IQVIA responses for the tests, shaped like the real ones (taken from the
// fixtures of the pyiqvia library), and a `fetch` stand-in that serves them.
// Tests never touch the network.
// -----------------------------------------------------------------------------

import { ENDPOINTS } from '../src/iqvia.js';

export const ZIP = '80238';

const location = (periods) => ({
  ZIP,
  City: 'DENVER',
  State: 'CO',
  periods,
  DisplayLocation: 'Denver, CO',
});

const pollenTriggers = [
  { LGID: 272, Name: 'Juniper', Genus: 'Juniperus', PlantType: 'Tree' },
  { LGID: 346, Name: 'Grasses', Genus: 'Grasses', PlantType: 'Grass' },
  { LGID: 63, Name: 'Chenopods', Genus: 'Chenopods', PlantType: 'Ragweed' },
];

export function pollenCurrent({ today = 6.6, tomorrow = 6.3, date = '2018-06-12' } = {}) {
  return {
    Type: 'pollen',
    ForecastDate: `${date}T00:00:00-04:00`,
    Location: location([
      { Triggers: pollenTriggers, Period: '0001-01-01T00:00:00', Type: 'Yesterday', Index: 7.2 },
      { Triggers: pollenTriggers, Period: '0001-01-01T00:00:00', Type: 'Today', Index: today },
      {
        Triggers: pollenTriggers,
        Period: '0001-01-01T00:00:00',
        Type: 'Tomorrow',
        Index: tomorrow,
      },
    ]),
  };
}

const extended = (type, values, date = '2018-06-12') => ({
  Type: type,
  ForecastDate: `${date}T00:00:00-04:00`,
  Location: location(
    values.map((index, i) => ({
      Period: `2018-06-${String(12 + i).padStart(2, '0')}T13:47:12.897`,
      Index: index,
    })),
  ),
});

export const pollenExtended = () => extended('pollen', [6.6, 6.3, 7.6, 7.6, 7.3]);

export const pollenOutlook = () => ({
  Market: 'DENVER, CO',
  ZIP,
  TrendID: 4,
  Trend: 'subsiding',
  Outlook: 'The amount of pollen in the air for Wednesday...',
  Season: 'Tree',
});

export const asthmaCurrent = () => ({
  Type: 'asthma',
  ForecastDate: '2018-10-29T00:00:00-04:00',
  Location: location([
    { Triggers: [], Period: '0001-01-01T00:00:00', Type: 'Yesterday', Index: 4.1, Idx: '4.1' },
    {
      Triggers: [
        { LGID: 3, Name: 'PM2.5', PPM: 105, Description: 'Fine particles...' },
        { LGID: 1, Name: 'OZONE', PPM: 42, Description: 'Ozone...' },
      ],
      Period: '0001-01-01T00:00:00',
      Type: 'Today',
      Index: 4.5,
      Idx: '4.5',
    },
    { Triggers: [], Period: '0001-01-01T00:00:00', Type: 'Tomorrow', Index: 4.6, Idx: '4.6' },
  ]),
});

export const asthmaExtended = () => extended('asthma', [4.5, 4.6, 5.1, 3.9, 3.2]);

export const coldFluExtended = () => extended('cold', [2.4, 2.5, 2.5, 2.5]);

export const emptyResponse = () => ({
  Type: 'pollen',
  ForecastDate: '2018-06-14T00:00:00-04:00',
  Location: { ZIP: '00000', periods: [] },
});

/**
 * A `fetch` stand-in serving the fixtures by endpoint. `overrides` maps an
 * ENDPOINTS key to a body, or to a function returning a body or throwing.
 * Every requested URL is recorded in `fetch.calls`.
 */
export function fakeFetch(overrides = {}) {
  const bodies = {
    pollenCurrent: pollenCurrent,
    pollenExtended: pollenExtended,
    pollenOutlook: pollenOutlook,
    asthmaCurrent: asthmaCurrent,
    asthmaExtended: asthmaExtended,
    coldFluExtended: coldFluExtended,
    ...overrides,
  };
  const calls = [];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const name = Object.keys(ENDPOINTS).find((key) => url.startsWith(`${ENDPOINTS[key]}/`));
    if (!name) {
      throw new Error(`Unexpected URL ${url}`);
    }
    const body = bodies[name];
    const value = typeof body === 'function' ? body() : body;
    if (value?.status) {
      return { ok: false, status: value.status, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => value };
  };
  fetch.calls = calls;
  return fetch;
}
