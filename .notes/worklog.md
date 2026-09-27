# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

## 2026-09-27

- Working on `feat/capacity-view`. `origin` is my fork, toggl's repo is `upstream`.
- Most assignment rows in the seed are exact duplicates, each one repeated 14 times. Adding them up as-is would inflate everyone's hours, so we'll probably need to dedupe. Not decided yet.
- `hours_per_day` only has values like 0.125 and 0.5, which look more like fractions of a day than hours. Not sure yet how to read it.
- Lots of assignments run into the weekend, so whether weekends count is going to matter. Eli Nakamura has 0 weekly hours but still has work assigned, so there's no sensible percentage for him.
- Scratch the dedupe idea. The duplicates come in pairs: each assignment is 14 rows at some value plus one more row at double that value, so the rows add up to 16 times the base. Added up as-is, you get whole hours per day and week totals that look like a real team. Deduping would make everything wrong. That also settles `hours_per_day`: once all the rows are added up, it's plain hours.
