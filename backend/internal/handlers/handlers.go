package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/repository"
	"github.com/adammuiz/leah/internal/services"
)

type Handler struct {
	svc       *services.Service
	jwtSecret string
}

func New(svc *services.Service, jwtSecret string) *Handler {
	return &Handler{svc: svc, jwtSecret: jwtSecret}
}

func userIDFromCtx(r *http.Request) int64 {
	id, _ := r.Context().Value(middleware.CtxKeyUserID).(int64)
	return id
}

func orgIDFromCtx(r *http.Request) *int64 {
	id, _ := r.Context().Value(middleware.CtxKeyOrgID).(int64)
	if id == 0 { return nil }
	return &id
}

func int64Ptr(n int64) *int64 { return &n }

func decodeJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return errors.New("request body is empty")
	}
	return json.NewDecoder(r.Body).Decode(v)
}

func respond(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func parsePagination(r *http.Request) (page, perPage int) {
	page, _ = strconv.Atoi(r.URL.Query().Get("page"))
	perPage, _ = strconv.Atoi(r.URL.Query().Get("per_page"))
	if page < 1 { page = 1 }
	if perPage < 1 { perPage = 20 }
	return
}

func (h *Handler) ListTickets(w http.ResponseWriter, r *http.Request) {
	page, perPage := parsePagination(r)
	orgID, _ := strconv.ParseInt(r.URL.Query().Get("organization_id"), 10, 64)
	holdingID, _ := strconv.ParseInt(r.URL.Query().Get("holding_id"), 10, 64)
	f := repository.TicketFilter{
		Search:         r.URL.Query().Get("search"),
		Status:         r.URL.Query().Get("status"),
		Priority:       r.URL.Query().Get("priority"),
		OrganizationID: orgID,
		HoldingID:      holdingID,
		Page:           page,
		PerPage:        perPage,
	}
	result, err := h.svc.ListTickets(r.Context(), f)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, result)
}

func (h *Handler) CreateTicket(w http.ResponseWriter, r *http.Request) {
	var t models.Ticket
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	t.CreatedBy = userIDFromCtx(r)
	t.OrganizationID = orgIDFromCtx(r)
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
	if err := h.svc.UpdateTicket(r.Context(), &t, userIDFromCtx(r)); err != nil {
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
	if err := h.svc.DeleteTicket(r.Context(), id, userIDFromCtx(r)); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

func (h *Handler) ListAssets(w http.ResponseWriter, r *http.Request) {
	page, perPage := parsePagination(r)
	typeID, _ := strconv.ParseInt(r.URL.Query().Get("type_id"), 10, 64)
	orgID, _ := strconv.ParseInt(r.URL.Query().Get("organization_id"), 10, 64)
	holdingID, _ := strconv.ParseInt(r.URL.Query().Get("holding_id"), 10, 64)
	f := repository.AssetFilter{
		Search:         r.URL.Query().Get("search"),
		Status:         r.URL.Query().Get("status"),
		TypeID:         typeID,
		OrganizationID: orgID,
		HoldingID:      holdingID,
		Page:           page,
		PerPage:        perPage,
	}
	result, err := h.svc.ListAssets(r.Context(), f)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, result)
}

func (h *Handler) CreateAsset(w http.ResponseWriter, r *http.Request) {
	var a models.Asset
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	a.CreatedBy = int64Ptr(userIDFromCtx(r))
	a.OrganizationID = orgIDFromCtx(r)
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
	if err := h.svc.UpdateAsset(r.Context(), &a, userIDFromCtx(r)); err != nil {
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
	if err := h.svc.DeleteAsset(r.Context(), id, userIDFromCtx(r)); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}
