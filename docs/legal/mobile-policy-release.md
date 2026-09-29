# Shared web, Android and iOS policies — September 28, 2026

## Content source

Edit `shared/legal/policies.json`. Web routes and native screens both render that
source. Native wording is bundled into the app: a web deployment does not update
an already installed native binary. Publish an app build/update when policies
change. Metro watches the shared folder. Keep that folder in build uploads.

Customer-facing policy routes retain their existing slugs. `/delete-account` is
a public, unauthenticated page with in-app instructions and an email request link.
It does not automatically delete anything. Requests go to support@evebash.com.

## Outstanding decisions — do not treat this draft as store/legal sign-off

- Supply the legal operator name, business address and required grievance contact.
  These were not provided; no identity/address has been invented. Add them to the
  shared contact sections once confirmed.
- Confirm retention and actual cleanup for submitted selfies, query embeddings,
  stored gallery embeddings, media, logs, CDN caches and provider backups. Specify
  durations or concrete retention criteria and post-deletion timelines. Current
  copy deliberately does not promise immediate erasure or an unverified duration.
- Confirm refund review/processing periods and storage-overage grace periods;
  implement and disclose them consistently with the actual plans.
- Confirm supported countries, account age eligibility and handling of minors'
  images, including consent requirements.
- Decide the mobile billing model. Conditional Apple/Google wording does not add
  IAP or authorise a Razorpay checkout inside a native app. Verify regional rules,
  price/renewal disclosures, cancellation and restore flows before offering sales.

## Implementation gates

- Verify app Settings → Delete Account and web Profile → Delete Account end to end.
  There were pre-existing uncommitted deletion changes in this workspace; this
  policy task does not certify or modify them. Ensure Auth identity, profile,
  media/storage objects, facial representations and processor copies are handled,
  with lawful retention exceptions. Do not ship a promise unsupported by cleanup.
- Make sure the support mailbox is monitored, ownership verification is safe,
  requests receive completion/status information, and public deletion URL works
  on production without app installation.
- Find You requires feature-level disclosure/consent as appropriate; a policy
  paragraph is not an affirmative consent UI. Confirm permissions, processing of
  non-user faces and children, processor configuration and deployed worker behavior.
- Verify moderation/reporting/blocking and third-party login requirements in the
  released app. These are not implemented by the policy text.
- Complete Apple App Privacy and Google Play Data safety/deletion declarations
  against actual SDKs and data flows. Review Expo/APNs/FCM notification processing.
- Existing staging/production resources are shared; do not promise data isolation.
- Validate production URLs for all policies and `/delete-account` before submitting
  store metadata. Shared code prevents copy drift but does not deploy itself.

## Official reference material reviewed

- https://developer.apple.com/app-store/review/guidelines/
- https://developer.apple.com/support/offering-account-deletion-in-your-app/
- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/9858738

Legal operator/retention decisions remain open pending the owner's response.
