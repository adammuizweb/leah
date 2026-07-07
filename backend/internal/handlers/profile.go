package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

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
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".webp" {
		respond(w, 400, map[string]string{"error": "invalid file type (jpg, png, gif, webp only)"})
		return
	}

	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		respond(w, 500, map[string]string{"error": "failed to create upload directory"})
		return
	}

	filename := fmt.Sprintf("user_%d_%d%s", userID, time.Now().UnixMilli(), ext)
	dst, err := os.Create(filepath.Join(uploadDir, filename))
	if err != nil {
		respond(w, 500, map[string]string{"error": "failed to save file"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		respond(w, 500, map[string]string{"error": "failed to save file"})
		return
	}

	avatarURL := &filename
	if err := h.svc.UpdateUserProfile(r.Context(), userID, "", avatarURL); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
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
