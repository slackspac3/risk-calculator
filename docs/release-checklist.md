# Release Checklist

Run this before pushing frontend or shared-backend changes.

## Core checks
- Run `node scripts/smoke-check.js`
- Run `node --check assets/app.js`
- Run `node --check assets/services/llmService.js`
- Run `node --check assets/services/exportService.js`
- Run `node --check assets/services/reportPresentation.js`
- Run `node --check api/settings.js`
- Run `node --check api/user-state.js`
- Run `node --check api/users.js`

## Manual regression sweep
- Admin login loads and each admin section opens after refresh
- User Accounts can change role, BU, and function without bouncing sections
- BU admin can add a function or department
- Dashboard archive, restore, and delete actions work
- Assessment wizard still runs end to end
- Executive results tab and PDF export match on key numbers and decision wording
- Currency switch updates visible assessment/report values
- AI assist outputs show confidence, evidence quality, and missing-information guidance

## Challenge questions
- Does this change introduce a second formatter or schema for something that already exists?
- Does any new UI helper resolve promises or close modals twice?
- Does a rerender return the user to the same section and preserve expected context?
- Does a frontend change require an asset version bump in `index.html`?
