package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/adammuiz/leah/internal/middleware"
)

const avatarMaxSize = 2 << 20 // 2MB
const uploadDir = "uploads/avatars"

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.CtxKeyUserID).(int64)

	var req struct {
		Name      string  `json:"name"`
		AvatarURL *string `json:"avatar_url,omitempty"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Name == "" {
		respond(w, 400, map[string]string{"error": "name is required"})
		return
	}

	if err := h.svc.UpdateUserProfile(r.Context(), userID, req.Name, req.AvatarURL); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}

	user, err := h.svc.GetUserByID(r.Context(), userID)
	if err != nil {
		respond(w, 500, map[string]string{"error": "internal error"})
		return
	}
	respond(w, 200, user)
}

func (h *Handler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.CtxKeyUserID).(int64)

	r.Body = http.MaxBytesReader(w, r.Body, avatarMaxSize)
	if err := r.ParseMultipartForm(avatarMaxSize); err != nil {
		respond(w, 400, map[string]string{"error": "file too large (max 2MB)"})
		return
	}

	file, header, err := r.FormFile("avatar")
	if err != nil {
		respond(w, 400, map[string]string{"error": "avatar file required"})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowedTypes := map[string]string{
		"image/jpeg": ".jpg",
		"image/png":  ".png",
		"image/gif":  ".gif",
		"image/webp": ".webp",
	}
	headerBytes := make([]byte, 512)
	n, readErr := file.Read(headerBytes)
	if readErr != nil && readErr != io.EOF {
		respond(w, http.StatusBadRequest, map[string]string{"error": "failed to read avatar"})
		return
	}
	canonicalExt, allowed := allowedTypes[http.DetectContentType(headerBytes[:n])]
	if !allowed {
		respond(w, 400, map[string]string{"error": "invalid file type (jpg, png, gif, webp only)"})
		return
	}
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".webp" {
		respond(w, 400, map[string]string{"error": "invalid file extension (jpg, png, gif, webp only)"})
		return
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "failed to read avatar"})
		return
	}

	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		respond(w, 500, map[string]string{"error": "failed to create upload directory"})
		return
	}

	existingUser, err := h.svc.GetUserByID(r.Context(), userID)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to load profile"})
		return
	}
	oldFilename := ""
	if existingUser.AvatarURL != nil {
		oldFilename = filepath.Base(*existingUser.AvatarURL)
	}

	filename := fmt.Sprintf("user_%d%s", userID, canonicalExt)
	tempFile, err := os.CreateTemp(uploadDir, fmt.Sprintf("user_%d_upload_*", userID))
	if err != nil {
		respond(w, 500, map[string]string{"error": "failed to save file"})
		return
	}
	tempPath := tempFile.Name()
	defer func() { _ = os.Remove(tempPath) }()
	if _, err := io.Copy(tempFile, file); err != nil {
		_ = tempFile.Close()
		respond(w, 500, map[string]string{"error": "failed to save file"})
		return
	}
	if err := tempFile.Close(); err != nil {
		respond(w, 500, map[string]string{"error": "failed to save file"})
		return
	}
	finalPath := filepath.Join(uploadDir, filename)
	if err := os.Rename(tempPath, finalPath); err != nil {
		respond(w, 500, map[string]string{"error": "failed to save file"})
		return
	}
	tempPath = ""

	avatarURL := &filename
	if err := h.svc.UpdateUserProfile(r.Context(), userID, "", avatarURL); err != nil {
		if oldFilename != filename {
			_ = os.Remove(finalPath)
		}
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	patterns := []string{
		filepath.Join(uploadDir, fmt.Sprintf("user_%d_*", userID)),
		filepath.Join(uploadDir, fmt.Sprintf("user_%d.*", userID)),
	}
	for _, pattern := range patterns {
		matches, _ := filepath.Glob(pattern)
		for _, match := range matches {
			if match != finalPath {
				_ = os.Remove(match)
			}
		}
	}

	respond(w, 200, map[string]string{"avatar_url": filename})
}

func (h *Handler) MyOrganizations(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.CtxKeyUserID).(int64)
	orgs, err := h.svc.GetUserOrganizationsWithDetails(r.Context(), userID)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, orgs)
}
