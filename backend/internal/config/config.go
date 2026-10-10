// Package config reads the API's environment once at startup and fails fast on
// anything missing or unsafe.
package config

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// minSecretLen is the minimum SESSION_SECRET length in bytes (HMAC-SHA256 key).
const minSecretLen = 32

// Config is the API's typed environment.
type Config struct {
	Port          string
	DatabaseURL   string
	SessionSecret []byte
	CookieSecure  bool
	TrustProxy    bool   // trust the first X-Forwarded-For hop for client IPs
	UploadDir     string // media root on disk, served at /media/
	AppOrigin     string // the SPA's origin; non-GET requests from any other Origin get 403
	AnthropicKey  string // empty disables the chatbot
	ChatModel     string // ANTHROPIC_MODEL, see docs/chatbot.md
}

// defaultChatModel is Claude Haiku 5.5 (anthropic.ModelClaudeHaiku5_5).
const defaultChatModel = "claude-haiku-5-5"

// Load reads the config through getenv (os.Getenv in production).
func Load(getenv func(string) string) (Config, error) {
	c := Config{
		Port:          withDefault(getenv("PORT"), "8080"),
		DatabaseURL:   getenv("DATABASE_URL"),
		SessionSecret: []byte(getenv("SESSION_SECRET")),
		UploadDir:     getenv("UPLOAD_DIR"),
		AppOrigin:     strings.TrimRight(withDefault(getenv("APP_ORIGIN"), "http://localhost:5173"), "/"),
		AnthropicKey:  strings.TrimSpace(getenv("ANTHROPIC_API_KEY")),
		ChatModel:     withDefault(strings.TrimSpace(getenv("ANTHROPIC_MODEL")), defaultChatModel),
	}
	var errs []error
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if len(c.SessionSecret) < minSecretLen {
		errs = append(errs, fmt.Errorf("SESSION_SECRET must be at least %d bytes", minSecretLen))
	}
	if c.UploadDir == "" {
		errs = append(errs, errors.New("UPLOAD_DIR is required"))
	}
	if u, err := url.Parse(c.AppOrigin); err != nil || u.Scheme == "" || u.Host == "" || u.Path != "" {
		errs = append(errs, errors.New("APP_ORIGIN must be scheme://host[:port]"))
	}
	var err error
	if c.CookieSecure, err = parseBool(getenv, "COOKIE_SECURE"); err != nil {
		errs = append(errs, err)
	}
	if c.TrustProxy, err = parseBool(getenv, "TRUST_PROXY"); err != nil {
		errs = append(errs, err)
	}
	if len(errs) > 0 {
		return Config{}, errors.Join(errs...)
	}
	return c, nil
}

func parseBool(getenv func(string) string, key string) (bool, error) {
	s := getenv(key)
	if s == "" {
		return false, nil
	}
	b, err := strconv.ParseBool(s)
	if err != nil {
		return false, fmt.Errorf("%s must be true or false", key)
	}
	return b, nil
}

func withDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
