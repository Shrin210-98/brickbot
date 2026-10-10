-- ---------- chat ----------

-- name: CreateChatSession :one
INSERT INTO chat_sessions (visitor_id) VALUES ($1)
RETURNING *;

-- A session is only visible to the visitor that created it.
-- name: GetChatSession :one
SELECT * FROM chat_sessions WHERE id = $1 AND visitor_id = $2;

-- Append-only: chat_messages rows are never updated or deleted.
-- name: CreateChatMessage :one
INSERT INTO chat_messages (session_id, role, content) VALUES ($1, $2, $3)
RETURNING *;

-- Newest first; the caller reverses it into the history window.
-- name: ListRecentChatMessages :many
SELECT * FROM chat_messages
WHERE session_id = $1
ORDER BY id DESC
LIMIT sqlc.arg('limit')::bigint;

-- name: ListChatMessages :many
SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY id;
