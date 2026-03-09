# G42 Tech & Cyber Risk Quantifier — CLAUDE.md

## Project Overview
A single-page static web application for internal cyber and technology risk assessment at G42 / ADX Group entities. It quantifies financial exposure across BIS/EAR export controls, UAE regulatory obligations, and enterprise risk domains using FAIR-informed methodology (min / expected / max exposure ranges).

Deployed as a static site on **GitHub Pages**.
Repository: `git@github.com:slackspac3/risk-calculator.git`

---

## Architecture

### Single-file design — no exceptions
The entire application lives in **`index.html`**. CSS and JavaScript are embedded inline. There is no:
- Build tool, bundler, or task runner
- Package manager (no `package.json`, `node_modules`)
- External JavaScript framework or library
- Backend or API

Do not introduce any of the above unless explicitly requested. Keep it one file.

### File structure
```
Risk Calculator/
├── index.html     ← entire app: HTML + <style> + <script>
├── CLAUDE.md      ← this file
└── README.md      ← minimal GitHub README
```

---

## Code Structure (index.html)

### Sections (in order)
1. **CSS custom properties** (`:root`) — design tokens: `--ink`, `--gold`, `--teal`, `--red`, `--amber`, `--green`, `--muted`, `--white`, `--border`, `--glow`
2. **Component styles** — header, steps, panels, risk grid, form fields, buttons, output
3. **HTML skeleton** — 3-panel wizard: `#p1` (risk type), `#p2` (details form), `#out` (result)
4. **`RISKS` object** — one key per risk category; each entry has `label`, `regime`, `flags`, `fields[]`, and `calc(v)` function
5. **`CARD_DEFS` array** — drives the visual risk-type cards in step 1 (icon, name, sub-label, tag)
6. **State & navigation** — `selRisk()`, `toStep1()`, `toStep2()`, `setStep()`
7. **`fmtM(n)`** — formats AED millions; outputs `AED Xm` / `AED X.XB`
8. **`calc()`** — reads form values, calls `RISKS[selId].calc(v)`, hands result to `renderOutput()`
9. **`renderOutput(r, res)`** — populates result panel (flags, breakdown rows, driver pills, action items)
10. **`reset()`** — returns to step 1

### calc() contract
Every `RISKS[key].calc(v)` must return:
```js
{
  min: Number,        // AED millions — best case
  mid: Number,        // AED millions — expected case
  max: Number,        // AED millions — worst case / statutory ceiling
  bk: [               // exposure breakdown rows
    { cls: "penalty"|"suspend"|"remediat"|"repute"|"other", n: String, s: String, v: String }
  ],
  drivers: [          // key risk driver pills
    { t: String, c: "red"|"amber"|"teal" }
  ],
  acts: [String]      // 5 priority action items
}
```
`null` entries in `bk` and `drivers` arrays are filtered out with `.filter(Boolean)`.

---

## Risk Categories (14 total)

| Key | Label | Tag |
|-----|-------|-----|
| `bis_screen` | Export Control — Screening Failure | BIS |
| `bis_nist` | Export Control — NIST Control Gap | BIS |
| `bis_sub` | Export Control — ADX Subsidiary Governance | BIS |
| `bis_flow` | Export Control — End User / Flow-Down | BIS |
| `esg_env` | ESG — Environmental Breach | UAE |
| `esg_gov` | ESG — Corporate Governance Failure | UAE |
| `fin_fraud` | Financial — Fraud & Misstatement | UAE |
| `fin_aml` | Financial — AML / Sanctions | UAE |
| `procurement` | Procurement — Supply Chain Risk | UAE |
| `hr` | HR — Labour & Emiratisation | UAE |
| `cyber` | Cybersecurity — Data Breach | UAE |
| `contract` | Legal — Contract Breach | Global |
| `ip` | IP — Technology Transfer Risk | BIS |
| `adx_disc` | Capital Markets — ADX Disclosure Failure | UAE |

---

## Design System

### Colour tokens
| Token | Use |
|-------|-----|
| `--gold` / `--gold2` | Primary brand, CTAs, highlights |
| `--teal` / `--teal2` | Positive/done state, teal buttons |
| `--red` | High-risk drivers, penalties |
| `--amber` | Medium-risk drivers, warnings |
| `--green` | Success states |
| `--muted` | Secondary text, labels |
| `--ink` / `--ink2` | Page background |
| `--surf` / `--surf2` | Card/panel backgrounds |

### Typography
- Headlines: `Playfair Display` (serif, Google Fonts)
- Body / UI: `DM Sans` (sans-serif, Google Fonts)
- Numbers / mono: `DM Mono` (monospace, Google Fonts)

---

## Rules & Conventions

### DO
- Keep all code in `index.html` — single file, always
- Use existing CSS tokens for any new colour values
- Follow the `calc()` return contract exactly when adding or modifying risk types
- Format currency with `fmtM()` — never inline `toFixed()` calls in output
- Add null-safety (`.filter(Boolean)`) to `bk` and `drivers` arrays
- Maintain the 3-step wizard UX pattern for any new risk categories
- Use AED millions as the internal unit for all monetary values
- Keep `CARD_DEFS` in sync with `RISKS` keys — one entry per risk type

### DON'T
- Don't add build tools, npm packages, or a bundler
- Don't load additional external scripts or CSS beyond the existing Google Fonts import
- Don't store any real user data — this is a stateless, client-side tool
- Don't change the internal monetary unit (AED millions throughout)
- Don't add a backend — everything stays client-side
- Don't commit `.DS_Store`

### Adding a new risk category
1. Add a key to `RISKS` with `label`, `regime`, `flags[]`, `fields[]`, and `calc(v)` following the existing contract
2. Add a matching entry to `CARD_DEFS` with `id`, `icon`, `name`, `sub`, `tag` (`tbis` / `tuae` / `tglob`), and `tl`
3. No other changes required — the UI renders dynamically

---

## Git & Deployment

- Branch: `master`
- Remote: `git@github.com:slackspac3/risk-calculator.git`
- Deployment: GitHub Pages (serves `index.html` from `master` directly)
- No CI/CD pipeline — push to `master` deploys automatically

### Commit style
Short imperative sentences: `Add fin_aml risk category`, `Fix fmtM precision for sub-1M values`, `Update BIS penalty multipliers`
