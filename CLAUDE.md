# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

**IQVIA Allergy**, a Gladys Assistant **external integration**: a Node.js
service (Node 22+, ESM, no build step) that runs in its own sandboxed Docker
container and talks to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js),
its only runtime dependency. It started from the official JavaScript template
(`GladysAssistant/integration-template-js`).

It reads the IQVIA forecasts — pollen (pollen.com), asthma
(asthmaforecast.com), cold & flu (flustar.com data, served by pollen.com) —
per US ZIP code, and publishes them as read-only devices. IQVIA sells no
hardware: there is nothing to control, `onSetValue` always refuses. The
endpoints and headers mirror the open-source `pyiqvia` library (Home
Assistant's IQVIA integration).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/devices.test.js          # one file
node --test --test-name-pattern "widget"  # tests whose name matches
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npx github:GladysAssistant/integration-store .   # store admission checks
```

`LOG_LEVEL=error npm test` silences the logs of the code under test.

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image: run the three commands before
pushing.

## Architecture

```
index.js                          SDK wiring only: handlers registered before connect()
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults), ZIP code parsing
src/iqvia.js                      IQVIA client: endpoints, retries, response parsers
src/i18n.js                       levels (0-12 bands), en/fr/de/es texts
src/devices/forecast.js           shared shape of a forecast device (features, states)
src/devices/{pollen,asthma,coldFlu}.js   the three forecasts
src/devices/triggers.js           scene events derived from two successive reads
src/devices/index.js              registry, in-memory last reads, refresh, poller, transports
src/actions.js                    manifest `actions` handlers (Configuration screen buttons)
src/scenes.js                     scene action handlers (manifest `scene_actions`)
src/widgets.js                    dashboard widget handlers (manifest `widgets`)
gladys-assistant-integration.json manifest: name, config_schema, actions, scenes, widgets...
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (en + fr mandatory)
test/                             node --test, against the SDK's fake Gladys; test/fixtures.js fakes IQVIA
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** Devices are
  `gladys.externalIds(<type>, <zip code>)` with `<type>` among `pollen`,
  `asthma`, `cold-flu`; feature keys are in `FEATURE` (src/devices/forecast.js).
  Never rename one: Gladys keys devices, their history, scenes and dashboards
  on them. The same goes for every key users store: manifest `config_schema`,
  `actions`, widget and scene keys, level keys (`low` … `high`).
- **Every feature carries `name`, `min`, `max`, `read_only` and
  `has_feedback`**: Gladys stores them NOT NULL. Indexes are `risk`/`integer`
  0–12, texts `text`/`text` 0/0. `test/devices.test.js` checks them.
- **The container rootfs is read-only.** Write only under `/data`. Never log
  tokens, passwords or API keys (there are none today: keep it that way).
- **Tests never touch the network.** Mock `globalThis.fetch` with
  `fakeFetch()` from `test/fixtures.js`, and call `resetForecasts()` in
  `beforeEach`: the last reads are module state.
- **Scene triggers fire on transitions only**, never on the first read after
  a start, and their `data` only carries keys declared in the manifest
  (`fields` + `variables`). `test/scenes.test.js` checks it.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading: the Release workflow moves the section.
- **Manifest.** Texts are multi-language objects in **English, French, German
  and Spanish** (`label`, `description`, `placeholder`, option labels): a
  test walks the whole manifest. The catalog `description` holds 10 to 100
  characters per language. `widgets`, `scene_triggers` and `scene_actions`
  require `gladys_version >= 5.1.0`. `transports` is `["cloud"]`: IQVIA has
  no local API.
- **User-facing text** is in the four languages: action and widget messages
  (`src/i18n.js`), manifest texts, and `docs/{en,fr,de,es}.md`, kept in sync.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English.
