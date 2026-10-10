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

type processStepDTO struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

type profileDTO struct {
	ID              int16             `json:"id"`
	FullName        string            `json:"full_name"`
	AgencyName      string            `json:"agency_name"`
	Tagline         *string           `json:"tagline"`
	Headline        *string           `json:"headline"`
	Bio             string            `json:"bio"`
	PhotoURL        *string           `json:"photo_url"`
	Phone           string            `json:"phone"`
	WhatsappNumber  string            `json:"whatsapp_number"`
	Email           string            `json:"email"`
	ServiceAreas    []string          `json:"service_areas"`
	LicenseNo       *string           `json:"license_no"`
	Socials         map[string]string `json:"socials"`
	YearsExperience *int16            `json:"years_experience"`
	DealsClosed     *int32            `json:"deals_closed"`
	Specialties     []string          `json:"specialties"`
	ProcessSteps    []processStepDTO  `json:"process_steps"`
	CountryCode     string            `json:"country_code"`
	Currency        string            `json:"currency"`
	AreaUnit        string            `json:"area_unit"`
	ChatEnabled     bool              `json:"chat_enabled"`
}

// Get handles GET /api/profile.
func (h *ProfileHandler) Get(w http.ResponseWriter, r *http.Request) {
	p, err := h.svc.GetPublic(r.Context())
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
	specialties := p.Specialties
	if specialties == nil {
		specialties = []string{}
	}
	steps := make([]processStepDTO, len(p.ProcessSteps))
	for i, s := range p.ProcessSteps {
		steps[i] = processStepDTO{Title: s.Title, Description: s.Description}
	}
	httpx.WriteJSON(w, http.StatusOK, profileDTO{
		ID:              p.ID,
		FullName:        p.Name,
		AgencyName:      p.AgencyName,
		Tagline:         p.Tagline,
		Headline:        p.Headline,
		Bio:             p.Bio,
		PhotoURL:        photo,
		Phone:           p.Phone,
		WhatsappNumber:  p.WhatsappNumber,
		Email:           p.Email,
		ServiceAreas:    areas,
		LicenseNo:       p.LicenseNo,
		Socials:         p.Socials,
		YearsExperience: p.YearsExperience,
		DealsClosed:     p.DealsClosed,
		Specialties:     specialties,
		ProcessSteps:    steps,
		CountryCode:     p.CountryCode,
		Currency:        p.Currency,
		AreaUnit:        p.AreaUnit,
		ChatEnabled:     h.chatEnabled,
	})
}
