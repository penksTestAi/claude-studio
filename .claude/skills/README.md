# Vigil's skills

Each role in Vigil's scheduled run has its own skill here. The run's chair (the routine prompt) launches a sub-agent
for a role, with the model listed below, and tells it to read its SKILL.md first. The reflector may improve these
files over time (see PLAYBOOK.md); the routine prompt stays above them.

| Skill | Role | Model | Why that model |
|---|---|---|---|
| `vigil-advisor` | run brief and pre-publish review | opus | judgement over the whole studio, twice a run |
| `vigil-piece` | builds the studio piece, in any form (page, program, dataset, media, writing) | sonnet | real craft and checked facts |
| `vigil-toy` | builds the toy | sonnet | the joke and the house style |
| `vigil-refine` | fresh-eyes critique and one round of fixes | sonnet for pieces, haiku for toys | toys are small |
| `vigil-issue` | triage (haiku) and fix (sonnet) of open issues | haiku, sonnet | triage is reading; fixing is craft |
| `vigil-game` | grows the multiplayer RPG in game/, one increment per run | sonnet; opus in founding mode | ongoing craft; the founding design needs judgement |
| `vigil-security` | scans all three repositories and reviews each run's changes before any commit; can block | sonnet | security needs care, and runs every time |
| `vigil-keeper` | wires the new piece in and keeps the Workbench right (no design changes) | haiku | scripts do the checking |
| `vigil-profile` | profile README, status block, post drafts, idea bookkeeping | haiku | mostly mechanical |
| `vigil-council` | the three voices of the daily ideas council | haiku, skeptic sonnet | short opinions |
| `vigil-reflector` | evolves PLAYBOOK.md and these skills | opus | the studio's long-term judgement |

Zero-token tools in `tools/` do the mechanical work so no model has to:
`digest.py` (state of all three repositories in one page), `keeper_check.py` (Workbench and page checks, `--fix`),
`page_check.mjs` (headless Chromium at 375px and 1100px, light and dark: console errors, sideways scroll,
screenshots) and `site_meta.py` (share tags, feed, sitemap), `game_patchnotes.py` (the game's patch notes from its changelog) and `security_check.py` (secrets, risky code, untrusted input,
supply chain, workflows).
