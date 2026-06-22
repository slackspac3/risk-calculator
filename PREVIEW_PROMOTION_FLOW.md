# Preview And Promotion Flow

The public GitHub Pages `/test/` preview has been retired. It is replaced by a noindex placeholder during the live Pages publish so stale test assets do not remain publicly reachable.

## Current Rule

- `master` publishes the live pilot at `https://slackspac3.github.io/risk-calculator/`.
- `https://slackspac3.github.io/risk-calculator/test/` is not an app preview target.
- Validate candidate changes with local managed QA and, when needed, a fresh protected preview environment.
- Do not rely on old `/test/` assets when making release decisions.

## Normal Flow

Use this before changing the live pilot:

1. Prepare the change on the working branch.
2. Run the relevant local checks, normally `npm run qa:release` for release candidates.
3. If browser review is needed, use a fresh protected preview build rather than the public `/test/` path.
4. Promote the validated change to `master`.
5. Wait for `Deploy GitHub Pages`.
6. Recheck the live root URL after publish.

## GitHub Pages Setup

Repository Pages should remain configured as:

1. `Settings` > `Actions` > `General` > `Workflow permissions`: `Read and write permissions`.
2. `Settings` > `Pages` > `Build and deployment`: `Deploy from a branch`.
3. Branch: `gh-pages`; folder: `/(root)`.

## Important Rule

- root URL = live pilot
- `/test/` = retired placeholder, not validation evidence
- only `master` is for end users
