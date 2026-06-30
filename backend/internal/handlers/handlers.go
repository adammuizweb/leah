package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/services"
)

type Handler struct {
	svc *services.Service
}

func New(svc *services.Service) *Handler {
	return &Handler{svc: svc}
}

func respond(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) ListTickets(w http.ResponseWriter, r *http.Request) {
	tickets, err := h.svc.ListTickets(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, tickets)
}

func (h *Handler) CreateTicket(w http.ResponseWriter, r *http.Request) {
	var t models.Ticket
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.CreateTicket(r.Context(), &t); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, t)
}

func (h *Handler) GetTicket(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	t, err := h.svc.GetTicket(r.Context(), id)
	if err != nil {
		respond(w, 404, map[string]string{"error": "not found"})
		return
	}
	respond(w, 200, t)
}

func (h *Handler) UpdateTicket(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	var t models.Ticket
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	t.ID = id
	if err := h.svc.UpdateTicket(r.Context(), &t); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, t)
}

func (h *Handler) DeleteTicket(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	if err := h.svc.DeleteTicket(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

func (h *Handler) ListAssets(w http.ResponseWriter, r *http.Request) {
	assets, err := h.svc.ListAssets(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, assets)
}

func (h *Handler) CreateAsset(w http.ResponseWriter, r *http.Request) {
	var a models.Asset
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.CreateAsset(r.Context(), &a); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, a)
}

func (h *Handler) GetAsset(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	a, err := h.svc.GetAsset(r.Context(), id)
	if err != nil {
		respond(w, 404, map[string]string{"error": "not found"})
		return
	}
	respond(w, 200, a)
}

func (h *Handler) UpdateAsset(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	var a models.Asset
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	a.ID = id
	if err := h.svc.UpdateAsset(r.Context(), &a); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, a)
}

func (h *Handler) DeleteAsset(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	if err := h.svc.DeleteAsset(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}
