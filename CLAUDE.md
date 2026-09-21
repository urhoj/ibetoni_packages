# ibetoni_packages

Also follow the shared workspace rules in [../CLAUDE.md](../CLAUDE.md). This directory is its own git repo (`urhoj/ibetoni_packages`), consumed as a nested submodule by `puminet4`, `puminet5api`, `puminet7-functions-app` and `betonijerry`; the workspace symlinks make an edit here visible to every consumer immediately.

## Rules

- **Dual ESM/CJS pairs.** Several packages ship `src/<name>.js` (ESM, frontend) AND `src/<name>.cjs` (CJS, backend) with the same logic. Editing one half fails SILENTLY in the other consumer — the token still verifies, the cache key still forms, only the data is wrong. Change both halves in the same commit and run the round-trip test where one exists (`jwtPayloadCodec` is the load-bearing case: a claim missing from the codec is dropped at sign time).
- **A package without a `test` script is run by nothing.** Root `npm test` uses `--workspaces --if-present`, so tests in a package that declares no `test` script never execute anywhere, locally or in CI. Add the script when you add the tests.
- **Persisting a change:** commit + push here (`git push origin master`), then `npm run sync` from the workspace root to bump all four consumer pointers. The bump moves each pointer to this repo's master HEAD, not just to your commit, so check `git log --oneline origin/master -5` first.
