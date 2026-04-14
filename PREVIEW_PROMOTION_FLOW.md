# Preview Before Live

This repository can now use a safer GitHub-only test-before-live flow.

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
- `master` publishes the live site to `gh-pages`
- pull requests publish preview pages under `pr-preview/`

## Normal flow

Use this every time you want to change the live PoC:

1. A change is made on a separate branch.
2. That branch is pushed to GitHub.
3. A pull request is opened against `master`.
4. GitHub runs `Deploy PR Preview`.
5. The workflow comments with a preview URL.
6. Test the preview URL.
7. If it is correct, click `Merge pull request`.
8. GitHub runs `Deploy GitHub Pages`.
9. The live PoC updates automatically.

## What to click in GitHub

When a pull request is ready:

1. Open the pull request.
2. Wait for the checks to finish.
3. Open the preview link from the PR comment.
4. Test that preview site.
5. If it is correct, click `Merge pull request`.
6. Click `Confirm merge`.

That merge is the promotion step.

## Important rule

- Pull request preview = safe test copy
- `master` = live PoC
- Merge only when you want to promote to live

## Preview smoke check

If you only want to verify the preview system itself, open a docs-only pull request, confirm the preview URL appears, load the site, then close the pull request without merging.
