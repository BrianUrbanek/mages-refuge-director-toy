# Mage's Refuge Director Toy

A static design-validation prototype for finite encounter funding, personality
decks, portal selection, room progression and abstract player combat.

## Run and validate

Use Node.js 22 or later. No installation or build step is needed.

```sh
node serve.mjs
node run-checks.mjs
node run-director-checks.mjs
```

The local server serves `dist` at http://127.0.0.1:5173.

## GitHub Pages

Create a repository with default branch `main`, upload this directory's contents,
and select **Settings > Pages > Source > GitHub Actions**. The included workflow
runs all current checks before deploying only `dist`. Run the workflow manually
after enabling Pages if the initial push has already happened.

Files use relative paths, so the app supports a project-site URL such as
`https://ACCOUNT.github.io/mages-refuge-director-toy/`.

Pages visibility is separate from repository visibility. Ordinary Pages sites
are public; a private source repository requires a qualifying plan. Restricted
Pages hosting requires an eligible Enterprise organization setup.

## Module boundaries

- `dist/core`: independently extractable Director, budgets, composition,
  personality selection and portal assignment. No browser or game dependencies.
- `dist/game`: zone adapter, abstract combat and progression.
- `dist/display`: canvas presentation.
- `dist/telemetry`: journal and run results.
- `dist/ui`: browser controls and rendering composition.

Read `SELECTION-PORT-GUIDE.txt` and `DIRECTOR-PORT-GUIDE.txt` for the engineering
contracts. JavaScript-to-C# translation and Last Epoch integration are untested.

This export excludes the original Site's configuration, local source documents,
credentials, historical archives and Git history. It does not grant an open
source license.
