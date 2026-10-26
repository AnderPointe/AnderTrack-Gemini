# Rich theme and request assistant

## Visual system

Shared `apps/driver/src/brand-rich.css` keeps the black canvas with teal/amber brand anchors, deeper blue/emerald panels and violet accents. Driver service cards and the customer form use distinct service accents. Website entry, signup, customer hub, dark operations surfaces and universal driver pages share the palette. Existing light operations mode remains scoped separately. Focus indicators, readable form text and reduced-motion behavior are preserved.

## Customer assistant

The customer request page includes a conversational panel with guided extraction on device. It can suggest only the selected service's fields: service, explicit addresses/instructions, mileage supplied by the user, cargo counts/weight where relevant, urgency, explicit local timestamps and whitelisted service details. Food cannot receive freight payload/pallet fields.

Proposed changes appear with before/after values, individual selection checkboxes and a separate replacement/service-change control. Applying suggestions changes only the local draft. It does not submit a request, book/accept work, approve a quote, alter rates, change provider/company/permissions, process payments, or grant tracking access. Newer manual edits are protected from stale suggestions. Service changes reset previous service-specific values only after explicit review. Customer chats reset by identity and are not written to browser storage or the application database.

Guided mode is explicitly labeled and uses conservative patterns plus follow-up questions. Labeled facts such as `Restaurant:`, `Order:`, `Pickup:` and `Destination:` avoid invented values. It does not resolve relative dates, geocode addresses or calculate routes. Missing facts remain missing. Driver Home includes on-device workflow guidance for jobs, queue, foreground GPS and photo proof; it cannot operate those controls.

## Optional cloud AI

Signed-in customers can opt into Cloud AI, which sends the bounded conversation and whitelisted current request fields through Vercel AI Gateway. This control is off by default. Demo requests always use on-device guided mode. The API verifies the bearer token through Supabase Auth, checks same-origin requests when an Origin is present, accepts only POST, bounds messages/body/output, and sanitizes structured suggestions against service schemas. It has no database mutation tools or privileged key. Provider/auth failures fall back to guided assistance with an explicit notice.

The server uses pinned AI SDK 7 with `generateText` / `Output.object` and validated JSON schema. The current catalog was checked for the configured extraction model `openai/gpt-5.4-nano`; model choice is server-configurable with `AI_GATEWAY_MODEL`. Preview-only `AI_ASSISTANT_ENABLED=true` is set on this branch; Vercel deployment OIDC supplies Gateway authentication. No provider API key is embedded or newly created.

An 8-request/minute per-user, per-instance throttle limits ordinary retries, with 1,400 output tokens, 8 short messages, no model retries and a 15-second generation timeout. This is not a distributed billing limit. Before public production, configure an appropriate project/Gateway budget and shared rate limiter, confirm provider data handling, and complete a real authenticated model request. The UI does not claim model availability from configuration alone. Chat retention claims apply to this application interface, not to provider logs or platform retention.

## Verification

- 158 website tests and 30 driver tests pass; both builds pass.
- New tests cover food extraction, disallowed security/price fields, review-only service changes, manual-edit protection, malformed values, bounded prompt context, bearer/origin guards, per-instance throttling, sanitized provider failure and explicit service corrections.
- API tests inject mocked auth/model dependencies; they do not prove a live model call or Gateway credit availability.
- Browser acceptance covers the guided customer conversation → review → local autofill path, service-safe fields, no automatic request submission, rich customer surfaces and rich driver cards/help.
- Actual cloud inference requires a working customer Auth session and Gateway access/credits. No production deployment, database migration or real customer shipment write is part of this change.

## Brand appearance update

The shared theme now uses bright teal (#00E0CE), bright orange (#FF8A18), white and black. Service cards alternate teal/orange accents; no separate violet, blue, coral or lime service palette. Light backgrounds use a darker teal for readable text while keeping bright teal borders and highlights. Warning/error colors may still indicate operational status.

A labeled sun/moon button is available on website and driver routes, including signed-out screens. The existing dispatch controls use the same React theme state. Dark is the first-visit default. Appearance persists under `andertrack_ui_theme`, survives reload/navigation, and synchronizes across tabs on the same origin. Separate app and website origins store preferences independently; this is a device/browser setting, not an account/database preference. Storage failures do not prevent switching for the current session. Mode changes do not clear forms, chat or job state. Native form controls follow the active color scheme; light connected map tiles use normal brightness.
