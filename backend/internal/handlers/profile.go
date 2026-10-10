package handlers

import (
	"net/http"

	"brickbot/internal/httpx"
	"brickbot/internal/services"
)

// ProfileHandler serves the public salesman profile.
type ProfileHandler struct {
	svc         *services.ProfileService
	chatEnabled bool
}

// NewProfileHandler returns a ProfileHandler. chatEnabled tells the SPA
// whether to show the chat launcher.
func NewProfileHandler(svc *services.ProfileService, chatEnabled bool) *ProfileHandler {
	return &ProfileHandler{svc: svc, chatEnabled: chatEnabled}
}

type contactDTO struct {
	Phone string `json:"phone"`
	Email string `json:"email"`
}

type profileDTO struct {
	Name           string     `json:"name"`
	Bio            string     `json:"bio"`
	PhotoURL       *string    `json:"photo_url"`
	WhatsappNumber string     `json:"whatsapp_number"`
	ServiceAreas   []string   `json:"service_areas"`
	Contact        contactDTO `json:"contact"`
	CountryCode    string     `json:"country_code"`
	Currency       string     `json:"currency"`
	AreaUnit       string     `json:"area_unit"`
	ChatEnabled    bool       `json:"chat_enabled"`
}

// Get handles GET /api/profile.
func (h *ProfileHandler) Get(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.Get(r.Context())
	if err != nil {
		writeServiceError(w, r, err)
		return
	}
	var photo *string
	if p.PhotoPath != nil {
		u := mediaURL(*p.PhotoPath)
		photo = &u
	}
	areas := p.ServiceAreas
	if areas == nil {
		areas = []string{}
	}
	httpx.WriteJSON(w, http.StatusOK, profileDTO{
		Name:           p.Name,
		Bio:            p.Bio,
		PhotoURL:       photo,
		WhatsappNumber: p.WhatsappNumber,
		ServiceAreas:   areas,
		Contact:        contactDTO{Phone: p.Phone, Email: p.Email},
		CountryCode:    p.CountryCode,
		Currency:       p.Currency,
		AreaUnit:       p.AreaUnit,
		ChatEnabled:    h.chatEnabled,
	})
}
