# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- First release of the IQVIA Allergy integration for Gladys Assistant (5.1.0
  or later), started from the official JavaScript integration template.
- Three read-only forecast devices per US ZIP code (up to 5 ZIP codes):
  pollen (index today and tomorrow, allergens of the day, pollen season and
  trend), asthma (index today and tomorrow, triggers of the day) and cold &
  flu (index today and tomorrow), read from pollen.com, asthmaforecast.com
  and flustar.com.
- Cloud transport badge on every device: `cloud`, or `unreachable` when the
  last read failed (the previous values are kept).
- Configuration actions: **Test the connection** and **Refresh the
  forecasts**.
- Scene triggers **Allergy level changed** and **New daily forecast**, scene
  actions **Get an allergy forecast** and **Refresh the allergy forecasts**.
- Dashboard widget **Allergy forecast**: live indexes, chart of the next
  days, levels, allergens, pollen season and a refresh button.
- English, French, German and Spanish texts (manifest, messages, widget and
  documentation).

[Unreleased]: https://github.com/gboulvin/Gladys-IQVIA-Allergy/commits/main
