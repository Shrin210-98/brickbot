package handlers

import (
	"net/http"

	"brickbot/internal/httpx"
)

// Health is the liveness probe used by the compose healthcheck.
func Health(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
