package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	dateLayout = "2006-01-02"
	// Two years of weeks, the longest history the page is expected to show.
	maxWeeks = 106
	// People per page.
	defaultLimit = 20
	maxLimit     = 500
)

type capacityResponse struct {
	// Weeks are Monday dates, "YYYY-MM-DD". Every person's Allocated slice
	// lines up with this one index for index.
	Weeks  []string         `json:"weeks"`
	People []capacityPerson `json:"people"`
	// Everyone on the roster, across all pages.
	Total  int `json:"total"`
	Offset int `json:"offset"`
	Limit  int `json:"limit"`
}

type capacityPerson struct {
	ID          int       `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	WeeklyHours float64   `json:"weekly_hours" db:"weekly_hours"`
	Allocated   []float64 `json:"allocated" db:"allocated"`
}

// Allocation per person per week, for the weeks between $1 (a Monday) and
// $2 (a Sunday), for one page of people. Only date arithmetic is used:
// date_trunc and the interval form of generate_series go through timestamptz
// and would depend on the session time zone.
//
// People sort by name with ICU collation. The database's default collation
// comes from musl on the Alpine image and sorts byte-wise, which put
// "Álvarez" after "Ruiz". id breaks ties so pages never overlap.
// $3 is the page size and $4 the offset.
const capacityQuery = `
WITH page AS (
  SELECT id, name, weekly_hours
  FROM people
  ORDER BY name COLLATE "und-x-icu", id
  LIMIT $3 OFFSET $4
),
weeks AS (
  SELECT $1::date + 7 * i AS week_start
  FROM generate_series(0, ($2::date - $1::date) / 7) AS i
),
alloc AS (
  SELECT a.person_id,
         d.day - (extract(isodow FROM d.day)::int - 1) AS week_start,
         sum(a.hours_per_day) AS hours
  FROM assignments a
  CROSS JOIN LATERAL (
    SELECT greatest(a.start_date, $1::date) + n AS day
    FROM generate_series(0, least(a.end_date, $2::date) - greatest(a.start_date, $1::date)) AS n
  ) d
  WHERE a.person_id IN (SELECT id FROM page)
    AND a.start_date <= $2::date
    AND a.end_date >= $1::date
    AND extract(isodow FROM d.day) <= 5 -- Monday to Friday; weekends aren't working days
  GROUP BY 1, 2
)
SELECT p.id,
       p.name,
       p.weekly_hours::float8 AS weekly_hours,
       array_agg(coalesce(al.hours, 0)::float8 ORDER BY w.week_start) AS allocated
FROM page p
CROSS JOIN weeks w
LEFT JOIN alloc al ON al.person_id = p.id AND al.week_start = w.week_start
GROUP BY p.id, p.name, p.weekly_hours
ORDER BY p.name COLLATE "und-x-icu", p.id`

// handleCapacity serves
// GET /api/capacity?from=YYYY-MM-DD&to=YYYY-MM-DD[&limit=20][&offset=0]
//
// The range is widened to whole weeks: from back to its Monday, to forward
// to its Sunday.
func (s *server) handleCapacity(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	from, to, err := parseRange(q.Get("from"), q.Get("to"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	limit, err := parseLimit(q.Get("limit"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	offset, err := parseOffset(q.Get("offset"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	monday := startOfWeek(from)
	sunday := startOfWeek(to).AddDate(0, 0, 6)

	var weeks []string
	for d := monday; !d.After(sunday); d = d.AddDate(0, 0, 7) {
		weeks = append(weeks, d.Format(dateLayout))
	}
	if len(weeks) > maxWeeks {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("range covers %d weeks, at most %d allowed", len(weeks), maxWeeks),
		})
		return
	}

	rows, err := s.db.Query(r.Context(), capacityQuery, monday, sunday, limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	people, err := pgx.CollectRows(rows, pgx.RowToStructByName[capacityPerson])
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var total int
	if err := s.db.QueryRow(r.Context(), `SELECT count(*) FROM people`).Scan(&total); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, capacityResponse{
		Weeks:  weeks,
		People: people,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	})
}

func parseLimit(s string) (int, error) {
	if s == "" {
		return defaultLimit, nil
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 || n > maxLimit {
		return 0, fmt.Errorf("limit must be a whole number from 1 to %d", maxLimit)
	}
	return n, nil
}

func parseOffset(s string) (int, error) {
	if s == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(s)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("offset must be a whole number, 0 or more")
	}
	return n, nil
}

// parseRange reads from and to as calendar dates. time.Parse without a zone
// yields UTC midnight, so AddDate below never crosses a DST change.
func parseRange(fromStr, toStr string) (time.Time, time.Time, error) {
	if fromStr == "" || toStr == "" {
		return time.Time{}, time.Time{}, fmt.Errorf("from and to are required, as YYYY-MM-DD")
	}
	from, err := time.Parse(dateLayout, fromStr)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("from: expected YYYY-MM-DD, got %q", fromStr)
	}
	to, err := time.Parse(dateLayout, toStr)
	if err != nil {
		return time.Time{}, time.Time{}, fmt.Errorf("to: expected YYYY-MM-DD, got %q", toStr)
	}
	if to.Before(from) {
		return time.Time{}, time.Time{}, fmt.Errorf("to (%s) is before from (%s)", toStr, fromStr)
	}
	return from, to, nil
}

// startOfWeek returns the Monday on or before d.
func startOfWeek(d time.Time) time.Time {
	offset := (int(d.Weekday()) + 6) % 7 // Monday 0 ... Sunday 6
	return d.AddDate(0, 0, -offset)
}
