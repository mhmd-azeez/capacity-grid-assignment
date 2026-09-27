# Decisions

Yours to write, not your AI's. Short is good — bullets are fine, and half a page is
plenty. We read this first.

## What did the spec not tell you?

There are things this brief doesn't specify. Which ones did you hit, what did you decide,
and why?

- What a week is. weekdays are not the same everywhere. Example: in some countries Weekdays are Sunday - Thursday. It can also vary by business.

- What to do about partial ranges (i.e. the From/To filter starts/ends in the middle of a week)

- Weekends. A lot of the assignments cover weekends, but the spec didnt specify the behavior. I went with only counting weekdays, but this depends on the use case and needs input from customers.

- How to handle duplicate rows. I decided to sum them up because that gives us reaslistic weeks

- Changing someone's hours affects previous weeks too. I didnt add history because that requies schema change.

- Searching "soren" doesn't find "Søren". Left as is, since fixing it needs a schema change.

## What did you notice that looked wrong?

Anything in the output that didn't match what you expected. Whether you fixed it or left
it, we want to know you saw it.

- Names sorted byte-by-byte not by actual characters because of the postgres image we're using. I switched to ICU sorting.

- Some rows (Ana and Bo) only looked overbooked because of weekends

- Every third week in the seed is completely empty

## What did the AI get wrong that you caught?

One concrete example. Every real session has one.

- Tried to use strpos() and lower() to do case-insenstive name search instead of ILIKE
- Tried to hand-roll date/time helpers
- Handrolled sql scanning instead of using pgx.CollectRows

## What would you do differently with a week?
- Go test against a real database
- Inline edits without a "save/cancel" button
- Better styling
- Capacity history with effective dates
- Conflict check when two users (managers) save at the same time
- Accent and Arabic normalization for search