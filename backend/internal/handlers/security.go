package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/adammuiz/leah/internal/models"
	"github.com/go-chi/chi/v5"
)

func (h *Handler) GetLoginSecuritySettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.svc.GetLoginSecuritySettings(r.Context())
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to load login security settings"})
		return
	}
	respond(w, http.StatusOK, settings)
}

func (h *Handler) UpdateLoginSecuritySettings(w http.ResponseWriter, r *http.Request) {
	var settings models.LoginSecuritySettings
	if err := decodeJSON(r, &settings); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.UpdateLoginSecuritySettings(r.Context(), &settings, userIDFromCtx(r)); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	respond(w, http.StatusOK, settings)
}

func (h *Handler) ListLoginAttempts(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListLoginAttempts(r.Context(), time.Now().Add(-24*time.Hour))
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to load login attempts"})
		return
	}
	respond(w, http.StatusOK, items)
}

func (h *Handler) ClearLoginAttempts(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.ClearLoginAttempts(r.Context()); err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to clear login attempts"})
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) UnlockUser(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "invalid user ID"})
		return
	}
	if err := h.svc.UnlockUser(r.Context(), id); err != nil {
		respond(w, http.StatusNotFound, map[string]string{"error": err.Error()})
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}
