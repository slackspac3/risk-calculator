# Test PoC Before Live

This repository now uses a simple two-link GitHub-only flow.

## One-time GitHub setup

Do these steps once in the repository settings:

1. Open `Settings`.
2. Open `Actions` > `General`.
3. Under `Workflow permissions`, choose `Read and write permissions`.
4. Save.
5. Open `Settings` > `Pages`.
6. Under `Build and deployment`, set `Source` to `Deploy from a branch`.
7. Set the branch to `gh-pages` and the folder to `/(root)`.
8. Save.

After that:
- `master` publishes the live PoC at `https://slackspac3.github.io/risk-calculator/`
- `test-poc` publishes the fixed test PoC at `https://slackspac3.github.io/risk-calculator/test/`

## Normal flow

Use this every time you want to change the live PoC:

1. A change is prepared on the `test-poc` branch.
2. GitHub runs `Deploy Test PoC`.
3. Test the fixed test URL: `https://slackspac3.github.io/risk-calculator/test/`
4. If it is correct, promote that same change to `master`.
5. GitHub runs `Deploy GitHub Pages`.
6. The live PoC updates automatically.

## What to click in GitHub

When you want to test:

1. Open the fixed test URL.
2. Confirm the expected change is there.
3. Do not use the live link for testing.

When you want to promote:

1. Promote the tested change from `test-poc` to `master`.
2. Wait for `Deploy GitHub Pages`.
3. Recheck the live URL.

## Important rule

- `/test/` = safe test PoC
- root URL = live PoC
- only `master` is for end users
