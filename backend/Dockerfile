# syntax=docker/dockerfile:1

# ---- dev: toolchain + air live reload; source is bind-mounted at /app ----
FROM golang:1.27.2 AS dev
ARG HOST_UID=1000
ARG HOST_GID=1000
ENV GOMODCACHE=/go/pkg/mod \
    GOCACHE=/go-cache \
    GOFLAGS=-modcacherw
RUN GOBIN=/usr/local/bin go install github.com/air-verse/air@v1.67.4 \
 && go clean -modcache -cache \
 && mkdir -p /go/pkg/sumdb /go/pkg/mod/cache /go-cache /data/uploads \
 # compose runs as the host UID; empty named volumes inherit this ownership
 && chown -R ${HOST_UID}:${HOST_GID} /go/pkg /go-cache /data/uploads \
 && chmod 0755 /go/pkg /go/pkg/sumdb /go/pkg/mod /go-cache /data/uploads
WORKDIR /app
EXPOSE 8080
CMD ["air", "-c", ".air.toml"]
