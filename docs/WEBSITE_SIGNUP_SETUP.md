# Website registration and onboarding

## Available flows

- `/operations?signup=1`: individual or company registration with any email address (including Gmail and company addresses). Sends a confirmation link using Supabase Auth; new identities are allowed only in Create account mode.
- `/operations`: existing-user email sign-in, with account creation disabled for the email sign-in call.
- Google/Gmail and Apple buttons use Supabase OAuth when the public Auth settings report that the provider is enabled. A disabled or unavailable provider cannot launch a broken flow. Google covers Gmail and Google Workspace; Gmail is not a separate identity provider.
- After confirmed sign-in, accounts without company membership complete onboarding. Individuals get their own account page. Company founders create a new organization and receive admin access only to that new organization. Joining an existing company still requires an administrator to add the member.
- Profile metadata is only an onboarding suggestion. It never grants a role. The protected server function derives identity from `auth.uid()`, requires a confirmed email, and accepts no existing organization ID or role parameter.
- Company creation is transactional and idempotent per user. Account rows have RLS and are readable only by their owner; clients cannot insert or edit them directly. Onboarding type is immutable in this version.

## Staging configuration observed

Project `ofyfausfhinwgrfmapgc`: email enabled, registrations allowed, email confirmation required. Google and Apple are disabled. No provider secrets or Auth settings were changed. The new account migration was applied only to this staging project.

## Required provider activation

1. Google: create a Google OAuth web client, configure the project callback URL `https://ofyfausfhinwgrfmapgc.supabase.co/auth/v1/callback`, and save its client ID/secret in Supabase Authentication → Sign In / Providers → Google. Configure Google consent branding and publish the OAuth app for the intended audience.
2. Apple: configure the Apple App/Services IDs, verified website domain, and the same callback URL, then save the Services ID and generated client secret in Supabase's Apple provider. Keep Apple signing material out of the website and repository. Apple web OAuth secrets require periodic rotation (currently six months).
3. Allow the exact website origins and `/operations` redirects in Supabase URL Configuration, including the protected staging branch alias used for acceptance. Allow `/driver` if testing website driver sign-in. Use the same backend for website and app.
4. Verify custom SMTP and sender-domain delivery for addresses outside the project team. Supabase's default email service can restrict recipients and rate limits; public Auth settings do not prove delivery to arbitrary users. Configure production SMTP before public launch.
5. Test a real external email confirmation, returning sign-in, Google/Gmail OAuth, Apple OAuth, and company onboarding in separate sessions. Do not disable email confirmation or deployment protection to test.

Official setup references:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/social-sign-in/auth-apple
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-smtp

## Verification

137 website tests pass, including new auth-request/metadata validation cases. The website builds. `tests/sql/website_signup_security.sql` passed with role-simulated existing staging identities: individual isolation, company isolation, idempotent creation, invalid role rejection, blocked direct mutations, and anonymous access denial. All SQL fixtures rolled back; no real Auth identities were created. These tests do not substitute for real email delivery or OAuth acceptance.

Security advisor reports no new finding on the new table/functions. Existing DVIR RPC advisories and disabled leaked-password protection predate this change. See https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
