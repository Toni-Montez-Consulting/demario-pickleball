# Terms versions

Every booking stores `waiver_version`: the terms the student accepted when booking. This
folder maps each stored version to its exact text, so a booking can always be matched to
what its student agreed to.

From version `2026-10-30` on, `<version>.txt` holds the text as the booking dialog and
`/terms` render it, one block per line. `src/components/TermsContent.test.tsx` fails when the
rendered terms stop matching the file for the current `WAIVER_VERSION`, so the text cannot
change without a new version. To change the terms, follow the comment above
`TERMS_EFFECTIVE_DATE` in `src/components/TermsContent.tsx`, and keep the old files.

## History

Before 2026-10-30, one version string covered four texts. Read each one from git, for example
`git show a9636fb:src/components/TermsContent.tsx`. Dates are when the change reached
`master`; from May to 2026-10-19 production deploys were started by hand (`docs/SETUP.md`,
section 8), so a text can have gone live later than its date.

| Stored version | Text from | Text until | Where the text is |
|---|---|---|---|
| `2026-04-24` | 2026-04-24 | 2026-04-28 | `src/app/terms/page.tsx` at `94dc684` |
| `2026-04-24` | 2026-04-28 | 2026-04-29 | `src/app/terms/page.tsx` at `5b423ff` |
| `2026-04-24` | 2026-04-29 | 2026-10-20 | `src/components/TermsContent.tsx` at `a9636fb`; the 2026-10-19 commits `453063b` and `db464c5` left the visible text unchanged |
| `2026-04-24` | 2026-10-20 | this version | `src/components/TermsContent.tsx` at `43934dd`, which added Drilling Session and Play with the Pro with their prices |
| `2026-10-30` | the deploy of this version | | `2026-10-30.txt`; the same text as `43934dd` under a new date |
