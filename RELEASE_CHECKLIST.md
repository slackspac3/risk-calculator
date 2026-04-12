# Pilot Release Checklist

Use this checklist before promoting a new pilot build to GitHub Pages or Vercel-backed shared use.

## Release Gate

- Confirm the target release stamp: version, channel, build, and asset version.
- Run `npm run qa:release`.
- Use the package-managed browser scripts, not raw `npx playwright test`, so the SPA is verified against a clean managed static origin.
- If `qa:release` fails on eval thresholds, treat that as a release blocker rather than a reporting warning.
- Confirm GitHub Actions `Pilot CI` is green on the release commit.
- Confirm GitHub Pages deploy is waiting on the validation job and did not bypass it.

## Frontend

- Verify the footer or admin diagnostics page shows the expected release stamp.
- Hard refresh the deployed Pages site and confirm the asset version changed.
- Open `#/login`, `#/dashboard`, `#/settings`, `#/wizard/1`, and a known `#/results/:id` route.
- Run one cold-session check from a cleared browser: `logged out boot -> login -> first authenticated render`.
- Repeat that cold-session check for at least one oversight role and confirm the real company structure appears before any generic fallback.
- Confirm review surfaces show a true empty state when clear and not a generic load failure.
- Confirm browser API traffic for shared routes uses the hosted API origin rather than the page origin.
- Confirm no major client-side console crashes appear in smoke coverage or manual spot checks.

## Backend

- Confirm required Vercel environment variables are present and unchanged unless intentionally rotated.
- Confirm bootstrap accounts, if used, match the intended pilot seed pack.
- Confirm shared storage remains writable for `users`, `settings`, and `user-state`.
- Confirm auth, settings, and user-state routes return healthy responses in the deployed environment.

## Demo / Pilot Data

- Confirm the intended sample users file is the one being used for bootstrap seeding.
- Confirm the intended sample assessments import cleanly in the dashboard.
- Confirm at least one admin, one BU admin, one function admin, and one standard user can sign in.
- Confirm at least one seeded result opens with the expected explainability and run-metadata panels.

## Final Approval

- Capture the release commit SHA and deployed URL.
- Note any known pilot limitations or temporary workarounds.
- Share the rollback owner and rollback trigger conditions before go-live.
