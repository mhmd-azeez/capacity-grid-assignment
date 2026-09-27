package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5"
)

// A week has 168 hours; anything above that is a typo, not a schedule.
const maxWeeklyHours = 168

type updatePersonRequest struct {
	// A pointer so a missing field can be told apart from an explicit 0.
	WeeklyHours *float64 `json:"weekly_hours"`
}

type person struct {
	ID          int     `json:"id" db:"id"`
	Name        string  `json:"name" db:"name"`
	WeeklyHours float64 `json:"weekly_hours" db:"weekly_hours"`
}

const updatePersonQuery = `
UPDATE people
SET weekly_hours = $2
WHERE id = $1
RETURNING id, name, weekly_hours::float8 AS weekly_hours`

// handleUpdatePerson serves PATCH /api/people/{id} with a body of
// {"weekly_hours": 32}.
//
// It returns the updated person. Allocations don't depend on weekly hours,
// so this one number is all the grid needs to stay correct.
func (s *server) handleUpdatePerson(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil || id < 1 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "id must be a positive integer"})
		return
	}

	var req updatePersonRequest
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<10))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": `body must be {"weekly_hours": <number>}`})
		return
	}
	if req.WeeklyHours == nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "weekly_hours is required"})
		return
	}
	hours := *req.WeeklyHours
	if hours < 0 || hours > maxWeeklyHours {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "weekly_hours must be between 0 and 168"})
		return
	}

	rows, err := s.db.Query(r.Context(), updatePersonQuery, id, hours)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	p, err := pgx.CollectExactlyOneRow(rows, pgx.RowToStructByName[person])
	if errors.Is(err, pgx.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no person with that id"})
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, http.StatusOK, p)
}
