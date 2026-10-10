// Package main runs the BrickBot HTTP API.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	"github.com/jackc/pgx/v5/pgxpool"

	"brickbot/internal/auth"
	"brickbot/internal/config"
	"brickbot/internal/db"
	"brickbot/internal/handlers"
	"brickbot/internal/server"
	"brickbot/internal/services"
	"brickbot/internal/services/chat"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	slog.SetDefault(log)

	cfg, err := config.Load(os.Getenv)
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(cfg.UploadDir, 0o750); err != nil {
		log.Error("upload dir", "err", err)
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Error("db pool", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	pingCtx, cancelPing := context.WithTimeout(ctx, 5*time.Second)
	err = pool.Ping(pingCtx)
	cancelPing()
	if err != nil {
		log.Error("db ping", "err", err)
		os.Exit(1)
	}

	q := db.New(pool)
	authSvc := services.NewAuthService(q)
	profileSvc := services.NewProfileService(q)
	listingSvc := services.NewListingService(q)
	inquirySvc := services.NewInquiryService(q)

	var chatSvc *chat.Service // nil: chatbot disabled, chat routes answer 503
	if cfg.AnthropicKey != "" {
		client := anthropic.NewClient(option.WithAPIKey(cfg.AnthropicKey))
		chatSvc = chat.NewService(client, cfg.ChatModel, pool, profileSvc, listingSvc, inquirySvc)
	}
	log.Info("chatbot", "enabled", chatSvc != nil, "model", cfg.ChatModel)

	sessions := auth.NewSessions(cfg.SessionSecret, cfg.CookieSecure)
	handler := server.Routes(server.Handlers{
		Profile:       handlers.NewProfileHandler(profileSvc, chatSvc != nil),
		Listings:      handlers.NewListingsHandler(listingSvc),
		Auth:          handlers.NewAuthHandler(authSvc, sessions),
		Inquiries:     handlers.NewInquiriesHandler(inquirySvc),
		AdminListings: handlers.NewAdminListingsHandler(services.NewAdminListingService(q), services.NewMediaService(q, cfg.UploadDir)),
		Media:         handlers.NewMediaHandler(cfg.UploadDir),
		Chat:          handlers.NewChatHandler(chatSvc),
	}, server.Security{
		AppOrigin:  cfg.AppOrigin,
		TrustProxy: cfg.TrustProxy,
		Sessions:   sessions,
		Checker:    authSvc,
	})

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Info("api listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("listen", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("shutdown", "err", err)
	}
}
