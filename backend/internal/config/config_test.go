package config

import (
	"strings"
	"testing"
)

func TestLoad(t *testing.T) {
	base := map[string]string{
		"DATABASE_URL":   "postgres://x",
		"SESSION_SECRET": strings.Repeat("s", 32),
		"UPLOAD_DIR":     "/data/uploads",
	}
	tests := []struct {
		name    string
		set     map[string]string
		wantErr string
	}{
		{name: "ok"},
		{name: "short secret", set: map[string]string{"SESSION_SECRET": strings.Repeat("s", 31)}, wantErr: "SESSION_SECRET"},
		{name: "missing secret", set: map[string]string{"SESSION_SECRET": ""}, wantErr: "SESSION_SECRET"},
		{name: "missing upload dir", set: map[string]string{"UPLOAD_DIR": ""}, wantErr: "UPLOAD_DIR"},
		{name: "bad bool", set: map[string]string{"COOKIE_SECURE": "yes please"}, wantErr: "COOKIE_SECURE"},
		{name: "bad origin", set: map[string]string{"APP_ORIGIN": "localhost:5173/app"}, wantErr: "APP_ORIGIN"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := map[string]string{}
			for k, v := range base {
				env[k] = v
			}
			for k, v := range tt.set {
				env[k] = v
			}
			c, err := Load(func(k string) string { return env[k] })
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if c.AppOrigin != "http://localhost:5173" || c.Port != "8080" {
					t.Fatalf("defaults not applied: %+v", c)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("err = %v, want mention of %s", err, tt.wantErr)
			}
		})
	}
}
