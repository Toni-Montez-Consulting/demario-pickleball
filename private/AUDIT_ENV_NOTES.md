# Audit environment notes (private; gitignored and vercelignored)

Read by `docs/AUDIT_PROMPT.md` (Appendix C). Written 2026-10-23 for Tonio's Windows on ARM
machine. Verify each note before relying on it; tools change.

## Accounts and IDs

- GitHub: repo `Toni-Montez-Consulting/demario-pickleball`, default branch `master`. Run `gh`
  as the personal account per command, without switching the active account:
  `GH_TOKEN="$(gh auth token --user toniomon96)" gh ...`
- Vercel: team `tonimontezco` (`team_bm4gbtrH0tvJ3N0uWORrgk1y`), project `demario-pickleball`
  (`prj_iXuTmuloqMnv2q5bNIyK5k7jsMSQ`).
- Supabase project ref: `vowwokjesgdjridrikqp`.

## Reading the numbers

- Vercel Web Analytics: the MCP analytics tools answer "Web Analytics not found". The CLI
  works:
  `vercel api "/v1/query/web-analytics/visits/aggregate?projectId=prj_iXuTmuloqMnv2q5bNIyK5k7jsMSQ&teamId=team_bm4gbtrH0tvJ3N0uWORrgk1y&by=day&since=<ISO>&until=<ISO>" --method GET`
  - Custom events: `events/aggregate` with `by=eventName&by=eventData/<property>`.
  - The JSON is the stdout line beginning with `{`; stderr carries update-check noise.
  - Grouping by UTM answers 402 (needs Web Analytics Plus).
- Analytics exclusion, checked 2026-10-23:
  - The live script (served from a build-seeded `/<16 hex>/script.js` path, for example
    `/a30646fb1ca90646/script.js`) skips sessions where `navigator.webdriver` is true or the
    user agent contains "Headless". Playwright sessions are skipped.
  - There is NO `va-disable` opt-out in it. Setting `localStorage va-disable` does nothing.
  - Its endpoint is the configured `endpoint`, or `/_vercel/insights`.
- Supabase read-only SQL: use the Supabase MCP `execute_sql`, wrapped as
  `begin transaction read only; ...; rollback;`. Do not run `supabase link`.

## Local tooling quirks

- The machine's npm registry proxy lacks some packages. `npm ci` can fail and leave
  `node_modules` empty. Do not change the registry. CI logs are the test evidence.
- `.env.local` holds production credentials. Never start the app from the main working tree.
- Chrome: `/c/Program Files/Google/Chrome/Application/chrome.exe` (Lighthouse:
  `CHROME_PATH=... npx --yes lighthouse@12 <url> --chrome-flags="--headless=new"`).
  Lighthouse with a mobile preset sends an emulated user agent, so block the analytics script
  and endpoint as well.
- Playwright MCP screenshots land under `C:\Users\tonimontez\dse-content\.playwright-mcp\`;
  move them to the session scratchpad.
- The Bash tool collapses doubled backslashes in heredocs and cuts long heredocs short. Write
  files with the Write tool.
- A secret-guard hook blocks literal values assigned to secret-like names. In tests, use
  `fake-` values and neutral names (`SIGNER`, `cronToken`).
- To test a migration on real Postgres: PGlite 0.5.9 (`@electric-sql/pglite`, with
  `contrib/btree_gist`) in a scratch folder.
- A PR that conflicts with `master` gets no `pull_request` CI run (only CodeQL).
