package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
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
	typeID, _ := strconv.ParseInt(r.URL.Query().Get("type_id"), 10, 64)
	orgID, _ := strconv.ParseInt(r.URL.Query().Get("organization_id"), 10, 64)
	holdingID, _ := strconv.ParseInt(r.URL.Query().Get("holding_id"), 10, 64)
	f := repository.TicketFilter{
		Search:         r.URL.Query().Get("search"),
		Status:         r.URL.Query().Get("status"),
		Priority:       r.URL.Query().Get("priority"),
		TypeID:         typeID,
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
	if t.OrganizationID == nil { t.OrganizationID = orgIDFromCtx(r) }
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
	if a.OrganizationID == nil { a.OrganizationID = orgIDFromCtx(r) }
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

// ─── Asset Models ───────────────────────────────────────────────

func (h *Handler) ListAssetModels(w http.ResponseWriter, r *http.Request) {
	models, err := h.svc.ListAssetModels(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, models)
}

func (h *Handler) CreateAssetModel(w http.ResponseWriter, r *http.Request) {
	var m models.AssetModel
	if err := decodeJSON(r, &m); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.CreateAssetModel(r.Context(), &m); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, m)
}

func (h *Handler) UpdateAssetModel(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	var m models.AssetModel
	if err := decodeJSON(r, &m); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	m.ID = id
	if err := h.svc.UpdateAssetModel(r.Context(), &m); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, m)
}

func (h *Handler) DeleteAssetModel(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	if err := h.svc.DeleteAssetModel(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

// ─── Bulk Asset Create ─────────────────────────────────────────

func (h *Handler) BulkCreateAssets(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ModelID        int64    `json:"model_id"`
		Quantity       int      `json:"quantity"`
		SerialNumbers  []string `json:"serial_numbers,omitempty"`
		SerialPrefix   string   `json:"serial_prefix,omitempty"`
		Status         string   `json:"status"`
		OrganizationID *int64   `json:"organization_id,omitempty"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if req.Quantity < 1 || req.Quantity > 500 {
		respond(w, 400, map[string]string{"error": "quantity must be between 1 and 500"})
		return
	}

	model, err := h.svc.GetAssetModel(r.Context(), req.ModelID)
	if err != nil {
		respond(w, 400, map[string]string{"error": "model not found"})
		return
	}

	// Resolve type name
	typeName := ""
	if model.TypeID != nil {
		types, _ := h.svc.ListAssetTypes(r.Context())
		for _, t := range types {
			if t.ID == *model.TypeID {
				typeName = t.Name
				break
			}
		}
	}

	userID := userIDFromCtx(r)
	orgID := req.OrganizationID
	if orgID == nil { orgID = orgIDFromCtx(r) }
	if req.Status == "" { req.Status = "active" }

	assets := make([]models.Asset, 0, req.Quantity)
	for i := 0; i < req.Quantity; i++ {
		var serial string
		if req.SerialNumbers != nil && i < len(req.SerialNumbers) {
			serial = req.SerialNumbers[i]
		} else if req.SerialPrefix != "" {
			serial = fmt.Sprintf("%s%d", req.SerialPrefix, i+1)
		}

		assets = append(assets, models.Asset{
			Name:           model.Name,
			Type:           typeName,
			TypeID:         model.TypeID,
			CategoryID:     model.CategoryID,
			ModelID:        &req.ModelID,
			Status:         req.Status,
			CreatedBy:      &userID,
			OrganizationID: orgID,
			Serial:         serial,
		})
	}

	created, err := h.svc.BulkCreateAssets(r.Context(), assets)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, map[string]any{"created": len(created), "assets": created})
}

// ─── Ticket Status ───────────────────────────────────────────────

func (h *Handler) UpdateTicketStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	var body struct {
		Status string  `json:"status"`
		Note   *string `json:"note,omitempty"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.UpdateTicketStatus(r.Context(), id, body.Status, userIDFromCtx(r), body.Note); err != nil {
		respond(w, 400, map[string]string{"error": err.Error()})
		return
	}
	t, _ := h.svc.GetTicket(r.Context(), id)
	respond(w, 200, t)
}

// ─── Ticket Types ───────────────────────────────────────────────

func (h *Handler) ListTicketTypes(w http.ResponseWriter, r *http.Request) {
	types, err := h.svc.ListTicketTypes(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, types)
}

func (h *Handler) CreateTicketType(w http.ResponseWriter, r *http.Request) {
	var t models.TicketType
	if err := decodeJSON(r, &t); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.CreateTicketType(r.Context(), &t); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, t)
}

func (h *Handler) UpdateTicketType(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	var t models.TicketType
	if err := decodeJSON(r, &t); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	t.ID = id
	if err := h.svc.UpdateTicketType(r.Context(), &t); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, t)
}

func (h *Handler) DeleteTicketType(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	if err := h.svc.DeleteTicketType(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

// ─── Ticket Comments ────────────────────────────────────────────

func (h *Handler) ListTicketComments(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	includeInternal := false
	perms, _ := r.Context().Value(middleware.CtxKeyPermissions).([]string)
	role, _ := r.Context().Value(middleware.CtxKeyUserRole).(string)
	isSuper, _ := r.Context().Value(middleware.CtxKeyIsSuperuser).(bool)
	if isSuper || role == "admin" || role == "superadmin" || contains(perms, "tickets.internal") {
		includeInternal = true
	}
	comments, err := h.svc.ListTicketComments(r.Context(), id, includeInternal)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, comments)
}

func (h *Handler) CreateTicketComment(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	var body struct {
		Content    string `json:"content"`
		IsInternal bool   `json:"is_internal"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	c := &models.TicketComment{
		TicketID:   id,
		UserID:     userIDFromCtx(r),
		Content:    body.Content,
		IsInternal: body.IsInternal,
	}
	if err := h.svc.CreateTicketComment(r.Context(), c); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, c)
}

func (h *Handler) DeleteTicketComment(w http.ResponseWriter, r *http.Request) {
	cid, err := strconv.ParseInt(chi.URLParam(r, "cid"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid comment id"})
		return
	}
	if err := h.svc.DeleteTicketComment(r.Context(), cid); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

// ─── Status History ─────────────────────────────────────────────

func (h *Handler) GetTicketHistory(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	history, err := h.svc.GetStatusHistory(r.Context(), id)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, history)
}

// ─── SLA Policies ───────────────────────────────────────────────

func (h *Handler) ListSLAPolicies(w http.ResponseWriter, r *http.Request) {
	policies, err := h.svc.ListSLAPolicies(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, policies)
}

func (h *Handler) CreateSLAPolicy(w http.ResponseWriter, r *http.Request) {
	var p models.SLAPolicy
	if err := decodeJSON(r, &p); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.CreateSLAPolicy(r.Context(), &p); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, p)
}

func (h *Handler) UpdateSLAPolicy(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	var p models.SLAPolicy
	if err := decodeJSON(r, &p); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	p.ID = id
	if err := h.svc.UpdateSLAPolicy(r.Context(), &p); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, p)
}

func (h *Handler) DeleteSLAPolicy(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, 400, map[string]string{"error": "invalid id"})
		return
	}
	if err := h.svc.DeleteSLAPolicy(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

// ─── Helper: contains ────────────────────────────────────────────

func contains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s { return true }
	}
	return false
}
