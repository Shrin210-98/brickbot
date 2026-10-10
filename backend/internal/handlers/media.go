package handlers

import (
	"io/fs"
	"net/http"
	"os"

	"brickbot/internal/httpx"
)

// MediaHandler serves uploaded files from UPLOAD_DIR at /media/.
type MediaHandler struct {
	fsys fs.FS
}

// NewMediaHandler serves files under root.
func NewMediaHandler(root string) *MediaHandler {
	return &MediaHandler{fsys: os.DirFS(root)}
}

// Serve handles GET /media/{path...}. Directories and hidden files (temp
// uploads) are 404; there is no directory listing.
func (h *MediaHandler) Serve(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("path")
	if !fs.ValidPath(name) || hasHiddenElem(name) {
		mediaNotFound(w)
		return
	}
	info, err := fs.Stat(h.fsys, name)
	if err != nil || !info.Mode().IsRegular() {
		mediaNotFound(w)
		return
	}
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// Listing uploads get fresh random names on replace, so a day of caching is safe.
	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFileFS(w, r, h.fsys, name) // #nosec G703 -- fs.ValidPath above; os.DirFS cannot escape root
}

func hasHiddenElem(name string) bool {
	start := 0
	for i := 0; i <= len(name); i++ {
		if i == len(name) || name[i] == '/' {
			if i > start && name[start] == '.' {
				return true
			}
			start = i + 1
		}
	}
	return false
}

func mediaNotFound(w http.ResponseWriter) {
	httpx.Error(w, http.StatusNotFound, httpx.CodeNotFound, "Not found", nil)
}
