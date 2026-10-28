# Twenty-beacon tracking stability audit

October 28, 2026 (America/Chicago). Simulation on Vercel preview code `ec7259cde668f389a7d3a12f98ab5d2890f958b2`. No real driver GPS, account/session changes or database writes. Production and the scheduled liveness monitor's immutable baseline are unchanged.

## Test correction

The existing lab offered 6/100/500/1000 points. Only the six-point case moved every point; larger counts moved one in ten. A requested 20-concurrent-moving test therefore could not be represented honestly. Added a selectable/default 20-point Fort Worth metro fixture that moves **every point every visible second**. Larger national fixtures retain their documented 10% movement behavior. The lab displays bounded last-600 movement-sample p95/max reconciliation time, excluding no-op freshness checks and initial creation.

## Automated stress

- Website suite: 180 passing tests; production build passes; diff checks pass.
- Twenty stable marker IDs subjected to 1,200 synchronous rounds (24,000 marker updates). Every round moved all twenty; registry remained twenty; twenty initial creations, zero recreations or removals during the movement run.
- A 70-second stale transition restyled all twenty; fresh updates restored all twenty without replacing markers. Deliberate removal reduced the registry to nineteen.
- Fixture checks confirm distinct IDs, metro positions and updated coordinates/timestamps for every point.
- This is accelerated logic stress, **not** twenty elapsed minutes in a browser and not a database/realtime concurrency test.

## Browser checkpoints

At the initial 40-second / 40-update checkpoint:

| Signal | Observation |
|---|---|
| Moving markers | All 20 DOM marker transforms changed |
| Markers | 20 before and after |
| Map subtree nodes | 105 before and after |
| Tile elements | 18 before and after |
| Map-pane transform | Unchanged before exercising zoom |
| Movement sample time | p95 0.80 ms; maximum 1.10 ms |
| Marker reconciliation | 20 moved, 0 created, 0 removed on update |
| Controls during updates | Blackout and zoom-out responded |

Final sustained checkpoint: **172 wall-clock seconds**, **171 one-second movement rounds**, with **3,420 marker movements**. All twenty markers remained present; final movement sample p95 **2.60 ms**, maximum **15.70 ms** (includes zoom and popup interaction). At the settled final view, map subtree nodes returned to **105**, with **18 tile elements** and **20 marker elements**, matching the baseline counts. This does not prove the JavaScript heap was flat.

Pause held the movement counter at 171 while controls were tested. A selected marker could be made stale (1 stale) and restored (0 stale). Removing it produced exactly 19 map markers. Popup selection correctly opened TEST-20 during movement; zoom and blackout remained responsive. No application console errors were observed (extension errors excluded).

One minor UI issue was found: after removing the selected beacon, the dropdown visually fell back to the first option while the inspector held the removed ID, disabling its controls. The removal handler now selects the next remaining beacon. This does not affect production tracking or the reconciler. The sample collector also excludes fixture-reset/creation/removal deltas so resetting the scenario cannot be counted as a timed movement round.

Screenshot evidence: `docs/qa/twenty-beacon-stability.jpg` (synthetic metro beacons).

## Interpretation and limits

Stable marker counts and a bounded metrics buffer are positive evidence; they are not a heap-memory leak certification. DOM tile counts legitimately vary with zoom/pan because Leaflet loads the visible tile region. No frame-rate, CPU, heap, network-delivery, battery or low-end-mobile benchmark is claimed.

The test exercises the actual map renderer/reconciler and UI against synthetic point snapshots. Real Supabase subscriptions/polling, twenty physical devices, disconnected/reordered updates, Auth/RLS scope and background GPS behavior need a separate end-to-end staging test. Current foreground-sharing/stop-on-hide behavior is unchanged. Map tiles still depend on the configured provider/network.

## Next validation priorities

1. Run twenty authorized staging device/client sessions through real location ingestion; measure publish-to-dispatch/customer visibility and stale cutoff. Keep tenant/driver qualification protections intact.
2. Test network loss/reconnect, out-of-order fixes, reconnect bursts and client retry/coalescing. Capture p95 end-to-end latency, duplicate events, request volume and errors.
3. Profile a physical low-end phone and dispatcher tablet for rendering/frame time, memory and battery over a full shift; compare baseline and twice workload.
4. Preserve the current incremental marker identity/reconciliation approach. Do not infer capacity from one workstation's local sync time or remove safety/access gates to make a test pass.
