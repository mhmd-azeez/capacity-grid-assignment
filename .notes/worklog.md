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
- The first version of the capacity endpoint takes the data completely literally, weekends included. I wanted to see what the raw data says before correcting anything. Ana's first week comes out at 56 of her 40 hours.
- The endpoint always works in whole weeks, Monday to Sunday, even if you ask for a Wednesday. That way a column always means a full week. More than two years at once gets a 400.
- Dates are kept as plain dates everywhere, never timestamps. Postgres quietly turns some date functions into timestamps with a time zone, and when I set the session to UTC+14, Monday Dec 29 came back as Sunday. Browsers west of UTC have the same problem with timestamps in JSON, so the API sends "2025-12-29" style strings.
- The response lists the weeks once, then one row per person with their weekly hours and an array of allocated hours, one per week. Capacity only exists per person in the database, so that's where it lives in the response too. It also means saving a person's new hours only changes one number on the client.
- Looked at the output across all the data. A third of busy weeks come out over capacity, and most of that is weekends: every assignment starts on a Monday, but plenty run to Saturday or Sunday. Counting only weekdays cuts the over-allocated weeks from 4,779 to 1,626.
- We're counting all 7 days for now and will come back to it. That's why Ana still shows 56 of 40.
- The generated data runs in a three-week cycle, busy, less busy, then empty. The week of Jan 12, 2026 is the exception. It only has the handful of hand-written assignments for Ana, Bo, Cem and Dee, and the default date range is set to show exactly those. Holidays like Jan 1 count as normal days because there's no holiday data.
- The grid's first version is a plain table. If the range changes while a request is still loading, the old request gets cancelled so it can't overwrite the new one.
- Names don't sort alphabetically: "Guillermo Álvarez" ends up after "Guillermo Ruiz", and the Greek, Arabic and other non-Latin names all end up at the bottom. The Alpine Postgres image sorts text byte by byte. Asking for ICU sorting in the query fixes it, but I haven't changed it yet.
- The heading says the range ends on Jan 16, a Friday, but the grid actually runs to Sunday the 18th. I'll fix it with the navigation work.
- Only over-allocated weeks get highlighted, in red with the extra hours next to them. Eli has 0 hours of capacity, so any work at all shows as over. I skipped anything fancier because the brief just says over-allocation should be obvious at a glance.
- Dates on the frontend go through Temporal's `PlainDate`, which is a date with no time or zone attached, so the day-shifting problem can't happen. I'd hand-written the helpers at first but switched, since the library does exactly this.
- The range lives in the URL, so a refresh or a shared link opens the same weeks. It replaces the history entry instead of adding one, so the back button doesn't step through every week you clicked past.
- While a new range loads, the old grid stays on screen, faded, instead of going blank on every click. If the load fails, the old grid goes away and you get the error with a retry button, because leaving it up would show numbers for different weeks under the new heading.
- A bad range in the date inputs (end before start, or over two years) shows a message and never reaches the API.
