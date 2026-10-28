# Blackout map appearance

The map's **Blackout On/Off** button controls its basemap independently of the app light/dark theme. Standard shows normal OpenStreetMap raster colors; Blackout applies a dark, mostly desaturated treatment to the existing raster tiles. The tile provider is unchanged. This is a raster appearance treatment, not a new vector-map/navigation service.

Implemented on fleet tracking, shared driver/customer location maps, replay, cinematic vehicle maps and the driver's illustrative preview route. Vehicle pins, vector route lines and other overlays retain their existing colors; popups, controls and attribution remain readable. The demo route remains clearly illustrative.

The browser stores `andertrack_map_appearance_v1` per deployment origin. Mounted maps and other tabs on that origin synchronize. Separate website and driver deployment origins save their preferences separately. Unavailable browser storage falls back safely; mode changes still work in the current page. No account, location consent, GPS transmission or database setting changes.

Validation: 178 website + 33 driver tests and both builds pass. Browser checks on code 88f6aa6c2f066a705526c356eaa2aa92f3431b80 confirm the fleet basemap filter changes from none to blackout while all six synthetic markers, tile count and map-pane transform stay unchanged. Marker-pane filter remains none. A simulated location update continues, the setting survives reload, and switching the overall app theme does not change blackout selection. Driver demo/map verification is recorded in PR #24. No actual location was requested or published in demo QA.
