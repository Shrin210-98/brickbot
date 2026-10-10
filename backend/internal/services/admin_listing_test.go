package services

import (
	"strings"
	"testing"
)

func TestSlugify(t *testing.T) {
	tests := []struct{ in, want string }{
		{"2 BHK in Andheri (West)", "2-bhk-in-andheri-west"},
		{"  --Villa!!  ", "villa"},
		{"Café Plot", "caf-plot"},
		{"मुंबई फ्लैट", "listing"},
		{"", "listing"},
		{strings.Repeat("ab ", 50), strings.TrimRight(strings.Repeat("ab-", 27), "-")[:80]},
	}
	for _, tt := range tests {
		if got := Slugify(tt.in); got != tt.want {
			t.Errorf("Slugify(%q) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestImageExt(t *testing.T) {
	tests := []struct {
		name string
		head []byte
		want string
	}{
		{"jpeg", []byte{0xFF, 0xD8, 0xFF, 0xE0}, ".jpg"},
		{"png", []byte("\x89PNG\r\n\x1a\n...."), ".png"},
		{"webp", []byte("RIFF\x00\x00\x00\x00WEBPVP8 "), ".webp"},
		{"gif", []byte("GIF89a"), ""},
		{"text", []byte("hello"), ""},
		{"empty", nil, ""},
	}
	for _, tt := range tests {
		if got := imageExt(tt.head); got != tt.want {
			t.Errorf("%s: imageExt = %q, want %q", tt.name, got, tt.want)
		}
	}
}
