// -----------------------------------------------------------------------------
// IQVIA client.
//
// IQVIA publishes its allergy, asthma and cold & flu forecasts on three
// public websites — pollen.com, asthmaforecast.com and flustar.com — through
// the JSON endpoints their own pages read, per US ZIP code. No account, no API
// key. The endpoints and the headers they expect are the ones of the
// open-source `pyiqvia` library (used by Home Assistant's IQVIA integration).
//
// Node 22+ provides `fetch` natively: no dependency needed.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'iqvia' });

const POLLEN_SITE = 'https://www.pollen.com';
const ASTHMA_SITE = 'https://www.asthmaforecast.com';

export const ENDPOINTS = {
  pollenCurrent: `${POLLEN_SITE}/api/forecast/current/pollen`,
  pollenExtended: `${POLLEN_SITE}/api/forecast/extended/pollen`,
  pollenOutlook: `${POLLEN_SITE}/api/forecast/outlook`,
  asthmaCurrent: `${ASTHMA_SITE}/api/forecast/current/asthma`,
  asthmaExtended: `${ASTHMA_SITE}/api/forecast/extended/asthma`,
  coldFluExtended: `${POLLEN_SITE}/api/forecast/extended/cold`,
};

// The websites only answer requests that look like their own pages: a
// browser user agent and a Referer on the same site (as pyiqvia sends).
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/65.0.3325.181 Safari/537.36';

const REQUEST_TIMEOUT_MS = 10_000;
const RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

export class IqviaError extends Error {}

/** IQVIA answered, but has no forecast for this ZIP code. */
export class InvalidZipCodeError extends IqviaError {
  constructor(zipCode) {
    super(`IQVIA has no forecast for the ZIP code ${zipCode}`);
    this.zipCode = zipCode;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET one IQVIA endpoint for a ZIP code, with a timeout and a few retries on
 * network and server errors.
 * @param {string} endpoint one of ENDPOINTS
 * @param {string} zipCode 5-digit US ZIP code
 */
export async function requestIqvia(endpoint, zipCode) {
  const url = `${endpoint}/${encodeURIComponent(zipCode)}`;
  const { origin } = new URL(endpoint);
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    if (attempt > 0) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
    try {
      logger.debug(`GET ${url}`);
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Referer: origin,
          'User-Agent': USER_AGENT,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const error = new IqviaError(`IQVIA HTTP ${response.status} on ${url}`);
        // A 4xx will not get better by retrying.
        if (response.status < 500) {
          throw Object.assign(error, { final: true });
        }
        throw error;
      }
      return await response.json();
    } catch (err) {
      if (err.final) {
        throw err;
      }
      lastError = err;
      logger.warn(`IQVIA request failed (attempt ${attempt + 1}/${RETRIES + 1}): ${err.message}`);
    }
  }
  throw lastError;
}

const round = (value) => Math.round(value * 10) / 10;

function toIndex(value) {
  const index = Number(value);
  return Number.isFinite(index) ? round(Math.min(Math.max(index, 0), 12)) : null;
}

function locationOf(body, zipCode) {
  const location = body?.Location ?? {};
  return {
    zipCode: location.ZIP ?? zipCode,
    name: location.DisplayLocation ?? [location.City, location.State].filter(Boolean).join(', '),
  };
}

function periodsOf(body, zipCode) {
  const periods = body?.Location?.periods;
  if (!Array.isArray(periods) || periods.length === 0) {
    throw new InvalidZipCodeError(zipCode);
  }
  return periods;
}

/**
 * Parse a "current" response (pollen or asthma): yesterday, today and
 * tomorrow, each with its index and the names of its main triggers.
 */
export function parseCurrent(body, zipCode) {
  const periods = periodsOf(body, zipCode);
  const day = (type) => {
    const period = periods.find((p) => p.Type === type);
    if (!period) {
      return null;
    }
    return {
      index: toIndex(period.Index),
      triggers: (period.Triggers ?? []).map((trigger) => String(trigger.Name)).filter(Boolean),
    };
  };
  return {
    forecastDate: body.ForecastDate ?? null,
    location: locationOf(body, zipCode),
    yesterday: day('Yesterday'),
    today: day('Today'),
    tomorrow: day('Tomorrow'),
  };
}

/** Parse an "extended" response: the index of the next days. */
export function parseExtended(body, zipCode) {
  const periods = periodsOf(body, zipCode);
  return {
    forecastDate: body.ForecastDate ?? null,
    location: locationOf(body, zipCode),
    days: periods
      .map((period) => ({
        date: String(period.Period ?? '').slice(0, 10),
        index: toIndex(period.Index),
      }))
      .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && day.index !== null),
  };
}

/** Parse the pollen outlook: the dominant pollen season and its trend. */
export function parseOutlook(body) {
  return {
    season: body?.Season ? String(body.Season) : null,
    trend: body?.Trend ? String(body.Trend) : null,
    outlook: body?.Outlook ? String(body.Outlook) : null,
  };
}

/** Pollen: current + 5-day forecast + seasonal outlook. */
export async function fetchPollen(zipCode) {
  const [current, extended, outlook] = await Promise.all([
    requestIqvia(ENDPOINTS.pollenCurrent, zipCode),
    requestIqvia(ENDPOINTS.pollenExtended, zipCode),
    // The outlook is a nice-to-have: never fail the whole read for it.
    requestIqvia(ENDPOINTS.pollenOutlook, zipCode).catch((err) => {
      logger.warn(`Pollen outlook unavailable for ${zipCode}: ${err.message}`);
      return null;
    }),
  ]);
  return {
    ...parseCurrent(current, zipCode),
    days: parseExtended(extended, zipCode).days,
    ...parseOutlook(outlook),
  };
}

/** Asthma: current + 5-day forecast. */
export async function fetchAsthma(zipCode) {
  const [current, extended] = await Promise.all([
    requestIqvia(ENDPOINTS.asthmaCurrent, zipCode),
    requestIqvia(ENDPOINTS.asthmaExtended, zipCode),
  ]);
  return { ...parseCurrent(current, zipCode), days: parseExtended(extended, zipCode).days };
}

/** Cold & flu: only an extended forecast exists, its first day is today. */
export async function fetchColdFlu(zipCode) {
  const extended = parseExtended(await requestIqvia(ENDPOINTS.coldFluExtended, zipCode), zipCode);
  const [today, tomorrow] = extended.days;
  return {
    forecastDate: extended.forecastDate,
    location: extended.location,
    yesterday: null,
    today: today ? { index: today.index, triggers: [] } : null,
    tomorrow: tomorrow ? { index: tomorrow.index, triggers: [] } : null,
    days: extended.days,
  };
}
