// -----------------------------------------------------------------------------
// Integration configuration.
//
// The configuration is filled in by the user in Gladys, from the `config_schema`
// declared in `gladys-assistant-integration.json`. The SDK fetches it for you
// (`gladys.getConfig()`) and notifies you of every change through
// `gladys.onConfigUpdated()`.
//
// This module only provides defaults and normalizes the received object, so the
// rest of the code never has to deal with `undefined`.
// -----------------------------------------------------------------------------

// IQVIA forecasts are published per US ZIP code. The user may follow a few
// locations (home, office, school...): each one gets its own devices.
export const MAX_ZIP_CODES = 5;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest.
export const DEFAULT_CONFIG = {
  // Comma-separated list of 5-digit US ZIP codes. Required, no default value
  // in the manifest: an empty string means "not configured yet".
  zip_codes: '',
  // Seconds between two reads of the forecasts. IQVIA publishes a new daily
  // forecast once a day: one read per hour is plenty. Gladys polls at most
  // once a minute, slower intervals are applied by skipping polls (see
  // createPoller in src/devices/index.js).
  poll_frequency: 3600,
};

const ZIP_CODE_PATTERN = /^\d{5}$/;

/**
 * Split the `zip_codes` config value into valid and invalid entries.
 * Accepts commas, semicolons and spaces as separators; duplicates are dropped
 * and at most MAX_ZIP_CODES codes are kept (the others are reported invalid).
 * @param {string} raw value typed by the user
 * @returns {{ valid: string[], invalid: string[] }}
 */
export function parseZipCodes(raw = '') {
  const valid = [];
  const invalid = [];
  for (const entry of String(raw)
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    if (!ZIP_CODE_PATTERN.test(entry)) {
      invalid.push(entry);
    } else if (!valid.includes(entry)) {
      if (valid.length < MAX_ZIP_CODES) {
        valid.push(entry);
      } else {
        invalid.push(entry);
      }
    }
  }
  return { valid, invalid };
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const pollFrequency = Number(raw.poll_frequency ?? DEFAULT_CONFIG.poll_frequency);
  const zipCodes = String(raw.zip_codes ?? DEFAULT_CONFIG.zip_codes);
  return {
    ...DEFAULT_CONFIG,
    ...raw,
    zip_codes: zipCodes,
    // Force the type: config may arrive as a string from a form. An invalid
    // value falls back to the default rather than hammering the API.
    poll_frequency:
      Number.isFinite(pollFrequency) && pollFrequency >= 60
        ? pollFrequency
        : DEFAULT_CONFIG.poll_frequency,
    // Derived, never stored: the valid ZIP codes the devices are built from.
    zipCodes: parseZipCodes(zipCodes).valid,
  };
}
