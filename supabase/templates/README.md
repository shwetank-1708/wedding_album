# Authentication email templates

`confirmation.html` is the hosted Supabase **Confirm signup** email body.
Subject: **Verify your email | EveBash**.

Keep `{{ .ConfirmationURL }}` in both the button and fallback link. It contains
Supabase's verification token and requested redirect; do not replace it with a
plain website URL. No expiry duration is hard-coded.

The template uses inline CSS, presentation tables, a public PNG logo, and a text
brand name that remains visible when email clients block images. It requires no
JavaScript, tracking pixels, web fonts, or external stylesheets.

Hosted templates are managed through Supabase Authentication > Emails > Confirm
signup (or the Management API), not automatically deployed by Vercel or Railway.
Staging and production currently share this project's template. Updating the
body does not change SMTP, redirect settings, or previously delivered emails.

After changes, preview at desktop and mobile widths and test a new confirmation
email. Real inbox delivery and Gmail/Outlook rendering require separate validation.
