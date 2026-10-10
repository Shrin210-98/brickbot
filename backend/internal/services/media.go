package services

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"path"
	"path/filepath"
	"uuid"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"brickbot/internal/db"
)

// MaxUploadBytes caps one media file.
const MaxUploadBytes = 10 << 20

// Domain errors for media. Both wrap ErrInvalid.
var (
	ErrUnsupportedMedia = fmt.Errorf("%w: file must be a JPEG, PNG or WebP image", ErrInvalid)
	ErrMediaSetMismatch = fmt.Errorf("%w: media_ids must list every media item of the listing exactly once", ErrInvalid)
)

// MediaService stores listing images under root (UPLOAD_DIR), served at /media/.
// Files live at listings/<listing id>/<random uuid>.<ext>.
type MediaService struct {
	q    *db.Queries
	root string
}

// NewMediaService returns a MediaService writing under root.
func NewMediaService(q *db.Queries, root string) *MediaService {
	return &MediaService{q: q, root: root}
}

// Add stores an image and appends it to the listing's media.
func (s *MediaService) Add(ctx context.Context, listingID pgtype.UUID, r io.Reader) (db.ListingMedia, error) {
	if _, err := getListing(ctx, s.q, listingID); err != nil {
		return db.ListingMedia{}, err
	}
	rel, err := s.store(listingID, r)
	if err != nil {
		return db.ListingMedia{}, err
	}
	pos, err := s.q.NextListingMediaPosition(ctx, listingID)
	if err != nil {
		s.remove(rel)
		return db.ListingMedia{}, fmt.Errorf("next media position: %w", err)
	}
	m, err := s.q.CreateListingMedia(ctx, db.CreateListingMediaParams{
		ListingID: listingID, Path: rel, MediaType: "image", Position: pos,
	})
	if err != nil {
		s.remove(rel)
		return db.ListingMedia{}, fmt.Errorf("create listing media: %w", err)
	}
	return m, nil
}

// Replace swaps the file behind one media item, keeping its id and position.
// The new file gets a new name so cached URLs do not serve the old image.
func (s *MediaService) Replace(ctx context.Context, listingID, mediaID pgtype.UUID, r io.Reader) (db.ListingMedia, error) {
	if _, err := getListing(ctx, s.q, listingID); err != nil {
		return db.ListingMedia{}, err
	}
	old, err := s.q.GetListingMedia(ctx, db.GetListingMediaParams{ID: mediaID, ListingID: listingID})
	if errors.Is(err, pgx.ErrNoRows) {
		return db.ListingMedia{}, fmt.Errorf("%w: media", ErrNotFound)
	}
	if err != nil {
		return db.ListingMedia{}, fmt.Errorf("get listing media: %w", err)
	}
	rel, err := s.store(listingID, r)
	if err != nil {
		return db.ListingMedia{}, err
	}
	m, err := s.q.UpdateListingMediaPath(ctx, db.UpdateListingMediaPathParams{
		ID: mediaID, ListingID: listingID, Path: rel, MediaType: "image",
	})
	if err != nil {
		s.remove(rel)
		if errors.Is(err, pgx.ErrNoRows) {
			return db.ListingMedia{}, fmt.Errorf("%w: media", ErrNotFound)
		}
		return db.ListingMedia{}, fmt.Errorf("update listing media: %w", err)
	}
	s.remove(old.Path)
	return m, nil
}

// Delete removes one media item and its file.
func (s *MediaService) Delete(ctx context.Context, listingID, mediaID pgtype.UUID) error {
	if _, err := getListing(ctx, s.q, listingID); err != nil {
		return err
	}
	m, err := s.q.DeleteListingMedia(ctx, db.DeleteListingMediaParams{ID: mediaID, ListingID: listingID})
	if errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("%w: media", ErrNotFound)
	}
	if err != nil {
		return fmt.Errorf("delete listing media: %w", err)
	}
	s.remove(m.Path)
	return nil
}

// Reorder sets positions to the order of ids, which must be exactly the
// listing's media ids, or ErrMediaSetMismatch.
func (s *MediaService) Reorder(ctx context.Context, listingID pgtype.UUID, ids []pgtype.UUID) error {
	if _, err := getListing(ctx, s.q, listingID); err != nil {
		return err
	}
	cur, err := s.q.ListListingMedia(ctx, listingID)
	if err != nil {
		return fmt.Errorf("list listing media: %w", err)
	}
	if len(ids) != len(cur) {
		return ErrMediaSetMismatch
	}
	want := make(map[[16]byte]bool, len(cur))
	for _, m := range cur {
		want[m.ID.Bytes] = true
	}
	for _, id := range ids {
		if !want[id.Bytes] {
			return ErrMediaSetMismatch // unknown or duplicate
		}
		delete(want, id.Bytes)
	}
	if _, err := s.q.ReorderListingMedia(ctx, db.ReorderListingMediaParams{ListingID: listingID, MediaIds: ids}); err != nil {
		return fmt.Errorf("reorder listing media: %w", err)
	}
	return nil
}

// store sniffs r's type, writes it to a temp file and renames it into place.
// It returns the path relative to root, with forward slashes.
func (s *MediaService) store(listingID pgtype.UUID, r io.Reader) (string, error) {
	head := make([]byte, 512)
	n, err := io.ReadFull(r, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("read upload: %w", err)
	}
	head = head[:n]
	ext := imageExt(head)
	if ext == "" {
		return "", ErrUnsupportedMedia
	}

	rel := path.Join("listings", uuid.UUID(listingID.Bytes).String(), uuid.New().String()+ext)
	abs := filepath.Join(s.root, filepath.FromSlash(rel))
	dir := filepath.Dir(abs)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return "", fmt.Errorf("create media dir: %w", err)
	}
	tmp, err := os.CreateTemp(dir, ".upload-*")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	_, err = io.Copy(tmp, io.MultiReader(bytes.NewReader(head), r))
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Rename(tmp.Name(), abs)
	}
	if err != nil {
		_ = os.Remove(tmp.Name())
		return "", fmt.Errorf("write upload: %w", err)
	}
	return rel, nil
}

// remove deletes a stored file. Failures are logged, not returned: the DB row
// is already gone and an orphaned file is harmless.
func (s *MediaService) remove(rel string) {
	err := os.Remove(filepath.Join(s.root, filepath.FromSlash(rel)))
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		slog.Warn("remove media file", "path", rel, "err", err)
	}
}

// imageExt recognises JPEG, PNG and WebP by magic bytes, or returns "".
func imageExt(b []byte) string {
	switch {
	case bytes.HasPrefix(b, []byte{0xFF, 0xD8, 0xFF}):
		return ".jpg"
	case bytes.HasPrefix(b, []byte("\x89PNG\r\n\x1a\n")):
		return ".png"
	case len(b) >= 12 && bytes.Equal(b[0:4], []byte("RIFF")) && bytes.Equal(b[8:12], []byte("WEBP")):
		return ".webp"
	default:
		return ""
	}
}
