// -----------------------------------------------------------------------------
// Entry point of the IQVIA Allergy integration for Gladys Assistant.
//
// Role of this file: wire the SDK to the forecast devices (src/devices/). It
// holds NO IQVIA logic. It only:
//   1. instantiates the SDK (connection, auth, reconnection: handled for you);
//   2. registers the event handlers BEFORE connect();
//   3. connects, publishes the devices and reads the forecasts.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import {
  buildDiscoveredDevices,
  buildTransportEntries,
  createPoller,
  refreshAll,
} from './src/devices/index.js';
import { ACTIONS } from './src/actions.js';
import { MESSAGES } from './src/i18n.js';
import { SCENE_ACTIONS } from './src/scenes.js';
import { WIDGETS, refreshWidgets } from './src/widgets.js';

const gladys = new GladysIntegration();

// Current configuration (hot-reloaded via onConfigUpdated).
let config = normalizeConfig();

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing discovered devices');
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
});

// --- Command: the forecasts are read-only -------------------------------------
gladys.onSetValue(async (device, feature) => {
  // Throw: the SDK sends a success:false acknowledgement to Gladys.
  throw new Error(`${feature.external_id} is a read-only IQVIA forecast`);
});

// --- Polling: Gladys asks to refresh a device --------------------------------
// Gladys polls the devices once a minute; the poller reads IQVIA at the
// interval the user chose in the config.
const pollDevice = createPoller();
gladys.onPoll(async (device) => {
  let read;
  try {
    read = await pollDevice(gladys, device, config);
  } catch (err) {
    // Show the failure on the badge (`unreachable`), then ack it as failed.
    await publishDeviceTransports().catch(() => {});
    throw err;
  }
  if (read) {
    await publishDeviceTransports();
  } else {
    logger.debug(`onPoll skipped (not due) for ${device.external_id}`);
  }
});

// --- Manifest actions: buttons in the Configuration screen -------------------
for (const [actionKey, handler] of Object.entries(ACTIONS)) {
  gladys.onAction(actionKey, async (fields) => {
    const message = await handler(gladys, { fields, config });
    await afterRefresh();
    return message;
  });
}

// --- Scene actions ------------------------------------------------------------
for (const [actionKey, handler] of Object.entries(SCENE_ACTIONS)) {
  gladys.onSceneAction(actionKey, (fields) => handler(gladys, { fields, config }));
}

// --- Dashboard widgets --------------------------------------------------------
for (const [widgetKey, widget] of Object.entries(WIDGETS)) {
  gladys.onWidgetGet(widgetKey, (request) => widget.get(gladys, { ...request, config }));
  if (typeof widget.action === 'function') {
    gladys.onWidgetAction(widgetKey, async (actionKey, params, { settings }) => {
      const message = await widget.action(gladys, { actionKey, params, settings, config });
      await publishDeviceTransports();
      return message;
    });
  }
}

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  config = normalizeConfig(newConfig);
  await initialize();
});

// --- Connection lifecycle ----------------------------------------------------
gladys.on('connected', async () => {
  try {
    config = normalizeConfig(await gladys.getConfig());
    await initialize();
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys.setConnectionStatus(false, MESSAGES.initFailed).catch(() => {});
  }
});

/**
 * Publish the devices of the configured ZIP codes, read every forecast, and
 * report the outcome (transport badges, connection status, widgets).
 */
async function initialize() {
  // publishDiscoveredDevices is idempotent (upsert by external_id).
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
  if (config.zipCodes.length === 0) {
    await gladys.setConnectionStatus(false, MESSAGES.noZipCode);
    refreshWidgets(gladys);
    return;
  }
  await refreshAll(gladys, config);
  await afterRefresh();
}

/**
 * Reflect the last reads: transport badges, application-level connection
 * status (shown in the Configuration screen) and dashboard widgets.
 */
async function afterRefresh() {
  const entries = await publishDeviceTransports();
  if (config.zipCodes.length === 0) {
    await gladys.setConnectionStatus(false, MESSAGES.noZipCode);
  } else if (entries.length > 0 && entries.every((entry) => entry.transport === 'unreachable')) {
    await gladys.setConnectionStatus(false, MESSAGES.unreachable);
  } else {
    await gladys.setConnectionStatus(true);
  }
  refreshWidgets(gladys);
}

// Publish the effective transport of every forecast device: `cloud` when its
// last read succeeded, `unreachable` otherwise.
async function publishDeviceTransports() {
  const entries = buildTransportEntries(gladys, config);
  if (entries.length > 0) {
    await gladys.publishTransports(entries);
  }
  return entries;
}

// --- Graceful shutdown -------------------------------------------------------
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the IQVIA Allergy integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
