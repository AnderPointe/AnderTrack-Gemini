# Map rendering and geographically spread beacon tests

## Changes

- Reconcile fleet markers by stable beacon ID. Unchanged beacons keep their layer instances, handlers and popups; position/style/text changes update only the corresponding data. Removed/invalid beacons leave the map.
- More than 200 points use Leaflet's canvas circle renderer instead of individual HTML pins. Large fleets also disable animated pin shadows. Smaller fleets retain keyboard-accessible pins. Dense canvas markers should be paired with accessible fleet lists; the test lab provides a labeled beacon selector.
- Popup/tooltip DOM content is created only when opened, stays text-only, and uses current beacon data.
- Freshness refreshes every five seconds while visible. Fleet default remains the existing five-minute reporting window; the lab explicitly uses the connected tracking 60-second threshold. Server authorization/tracking expiry rules are unchanged.
- Initial fit runs once; GPS updates preserve dispatcher pan/zoom. A Fit all beacons control handles geographically dispersed points and later additions.
- Tile updates wait for interaction to finish; no bulk tile prefetching or forced network cache bypass. Cold tile downloads still depend on provider/network speed.
- Driver/customer single-beacon map moves its marker without recentering for every small GPS movement. It recenters when the beacon leaves the inner visible bounds, preserving the current zoom.

## Test lab

`/tracking-lab` is an explicitly labeled simulation with no GPS permission, Supabase imports, database writes or real driver records. Six seed locations: Fort Worth, Orlando, Seattle, Los Angeles, Chicago and New York. Larger runs include synthetic grid points across the US region (not road-matched routes). Choose 6/100/500/1000 beacons; start/pause moving updates, advance one snapshot, make a selected beacon stale, restore it or remove it. Large runs move 10% of points per snapshot, deliberately leaving the others unchanged; those without fresh pings will eventually become stale. Updates pause while the tab is hidden. Stats measure marker reconciliation only, excluding network tiles and final browser painting. Not a tracking permission bypass or actual device test.

## Automated and database evidence

- Four new meaningful reconciliation tests: 1000 unchanged snapshots preserve instances; only 100/1000 moved points update; deletion/invalid positions remove layers; stale/fresh transitions and duplicate/current identity handling.
- Logic benchmark: 1000 initial creations, then 100 snapshots with 100 moving beacons each: 10,000 updates, zero additional creations, zero removals. The old full rebuild would create and remove 100,000 markers. Pure reconciliation took about 103 ms total in this container; this is not a browser render or network benchmark.
- `tests/sql/geographic_beacon_lifecycle.sql`: PASS on staging. Six independent customer/driver shipments spread across TX/FL/WA/CA/IL/NY, fresh coordinates, stale location suppression, moving recovery, dispatch sees all six, customer/driver scopes, reciprocal messages and delivery tracking cutoff. All synthetic identities and data rolled back. SQL role simulation is not real sign-in or simultaneous physical devices.
- Website: 166 tests; driver: 30 tests. Both builds pass.

A contracted production map provider and real simultaneous device/network/background GPS acceptance are still needed before claiming production tracking performance or availability. No map/network latency SLA is established here.

## Deployed browser checks

On the staging test lab, six moving beacons, stale-to-fresh restoration and removal controls passed. Switching 100 beacons to DOM markers and 500/1000 to canvas passed. A 1000-beacon browser run observed about 27.6 ms for initial layer creation and 1.2–3.0 ms for sampled updates moving 100 beacons, with zero replacements and 900 unchanged. These are observations from one cloud browser, not before/after controlled percentiles or device/network guarantees. A paused freshness-only scan was about 0.8–1.4 ms. No application console errors were observed (browser-extension messages excluded). Both staging builds are READY. A follow-up expands the large-count fixtures from city clusters to a US-region test grid for better visual spread.
