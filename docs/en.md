# IQVIA Allergy

This integration brings the **IQVIA** health forecasts into Gladys:
allergy (pollen), asthma and cold & flu, for one or more locations in the
United States. IQVIA publishes them every day on
[pollen.com](https://www.pollen.com),
[asthmaforecast.com](https://www.asthmaforecast.com) and
[flustar.com](https://www.flustar.com), per ZIP code.

> IQVIA sells no connected device: the integration creates one read-only
> "forecast" device per forecast and location, which you use like any sensor
> (dashboards, charts, scenes).

## What you get

For each ZIP code, three devices appear in the **Discovery** tab:

| Device                 | Features                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| IQVIA pollen `ZIP`     | index today, index tomorrow, allergens today, pollen season, pollen trend |
| IQVIA asthma `ZIP`     | index today, index tomorrow, triggers today (ozone, fine particles…)      |
| IQVIA cold & flu `ZIP` | index today, index tomorrow                                               |

Every index goes from **0 to 12**, in five levels:

| Index     | Level       |
| --------- | ----------- |
| 0 – 2.4   | Low         |
| 2.5 – 4.8 | Low-medium  |
| 4.9 – 7.2 | Medium      |
| 7.3 – 9.6 | Medium-high |
| 9.7 – 12  | High        |

## Configuration

1. Open the **Configuration** tab of the integration.
2. Enter one or more 5-digit US **ZIP codes**, separated by commas (5 at
   most), e.g. `10001, 80238`.
3. Optionally change the **refresh interval** (one hour by default, 15
   minutes at least): IQVIA publishes a new forecast once a day.
4. Save, then add the devices from the **Discovery** tab.

The connection status of the Configuration screen says whether IQVIA
answered. Each device shows a **cloud** badge, or **unreachable** when its
last read failed (the previous values are kept).

Removing a ZIP code stops refreshing its devices: delete them from Gladys if
you no longer need them.

## Actions

- **Test the connection** — reads today's pollen forecast of every ZIP code
  live, and shows the location and the level under the button.
- **Refresh the forecasts** — reads every forecast now.

## Scenes

The integration adds its own cards to the scene editor (Gladys 5.1 or
later):

**Triggers**

- **Allergy level changed** — today's level of a forecast moved to another
  band. Optionally pick the forecast device and the new levels to react to.
  Variables: `level`, `previous_level`, `index`, `forecast`, `zip_code`.
- **New daily forecast** — IQVIA published the forecast of a new day: the
  moment to send a morning notification. Variables: `location`,
  `index_today`, `level_today`, `index_tomorrow`, `level_tomorrow`,
  `triggers`, `forecast`, `zip_code`.

Neither fires on the first read after the integration starts: there is
nothing to compare with yet.

**Actions**

- **Get an allergy forecast** — reads a forecast (today or tomorrow) and
  hands `index`, `level`, `level_label` (in the language you pick),
  `triggers` and `location` to the following actions, e.g. a message
  "Pollen today: {{level_label}} ({{index}}/12) — {{triggers}}".
- **Refresh the allergy forecasts** — reads every forecast now; outputs the
  number of forecasts `refreshed` and `failed`.

## Dashboard

Add the **Allergy forecast** widget to a dashboard: today's pollen, asthma
and cold & flu indexes (live), a chart of the next days, the levels, the
main allergens and the pollen season, and a **Refresh** button. Its
**Location** setting picks the ZIP code (choose any of the location's
forecast devices); left empty, it shows the first ZIP code of the
configuration.

## Troubleshooting

- **"Enter at least one valid 5-digit US ZIP code"** — the ZIP codes field is
  empty or holds no valid US ZIP code. IQVIA only covers the United States.
- **"no forecast for this ZIP code"** — IQVIA answered without data for this
  ZIP code: check it on [pollen.com](https://www.pollen.com).
- **Unreachable badge** — IQVIA did not answer; the integration retries at
  the next refresh. Check the integration logs (`LOG_LEVEL=debug` for the
  detail of every request).

The forecasts are those of IQVIA's public websites; this integration is not
affiliated with IQVIA.
