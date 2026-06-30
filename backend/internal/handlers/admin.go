package handlers

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/models"
)

// ─── Users ──────────────────────────────────────────────────────

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.svc.ListUsers(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, users)
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	u, err := h.svc.GetUserByID(r.Context(), id)
	if err != nil {
		respond(w, 404, map[string]string{"error": "user not found"})
		return
	}
	respond(w, 200, u)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
		RoleID   *int64 `json:"role_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	u := &models.User{Email: req.Email, Name: req.Name, RoleID: req.RoleID}
	if err := h.svc.CreateUser(r.Context(), u, req.Password); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, u)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var req struct {
		Email  string `json:"email"`
		Name   string `json:"name"`
		RoleID *int64 `json:"role_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	u := &models.User{ID: id, Email: req.Email, Name: req.Name, RoleID: req.RoleID}
	if err := h.svc.UpdateUser(r.Context(), u); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, u)
}

func (h *Handler) UpdateUserPassword(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var req struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil || req.Password == "" {
		respond(w, 400, map[string]string{"error": "password required"})
		return
	}
	if err := h.svc.UpdatePassword(r.Context(), id, req.Password); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) SoftDeleteUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.SoftDeleteUser(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

// ─── Roles ──────────────────────────────────────────────────────

func (h *Handler) ListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.svc.ListRoles(r.Context())
	if err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, roles)
}

func (h *Handler) CreateRole(w http.ResponseWriter, r *http.Request) {
	var ro models.Role
	if err := decodeJSON(r, &ro); err != nil { respond(w, 400, map[string]string{"error": "invalid body"}); return }
	if err := h.svc.CreateRole(r.Context(), &ro); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 201, ro)
}

func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var ro models.Role
	if err := decodeJSON(r, &ro); err != nil { respond(w, 400, map[string]string{"error": "invalid body"}); return }
	ro.ID = id
	if err := h.svc.UpdateRole(r.Context(), &ro); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, ro)
}

func (h *Handler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.DeleteRole(r.Context(), id); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 204, nil)
}

func (h *Handler) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	perms, err := h.svc.GetRolePermissions(r.Context(), id)
	if err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, perms)
}

func (h *Handler) SetRolePermissions(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var req struct { PermissionIDs []int64 `json:"permission_ids"` }
	if err := decodeJSON(r, &req); err != nil { respond(w, 400, map[string]string{"error": "invalid body"}); return }
	if err := h.svc.SetRolePermissions(r.Context(), id, req.PermissionIDs); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) ListAllPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := h.svc.ListAllPermissions(r.Context())
	if err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, perms)
}

// ─── Bin ────────────────────────────────────────────────────────

func (h *Handler) ListBin(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListBin(r.Context())
	if err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, items)
}

func (h *Handler) RestoreItem(w http.ResponseWriter, r *http.Request) {
	typ := chi.URLParam(r, "type")
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.RestoreItem(r.Context(), typ, id); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) PermanentlyDelete(w http.ResponseWriter, r *http.Request) {
	typ := chi.URLParam(r, "type")
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.PermanentlyDelete(r.Context(), typ, id); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 204, nil)
}

func (h *Handler) ListHoldings(w http.ResponseWriter, r *http.Request) {
	hh, err := h.svc.ListHoldings(r.Context())
	if err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, hh)
}

func (h *Handler) CreateHolding(w http.ResponseWriter, r *http.Request) {
	var hh models.Holding
	if err := decodeJSON(r, &hh); err != nil { respond(w, 400, map[string]string{"error": "invalid body"}); return }
	if err := h.svc.CreateHolding(r.Context(), &hh); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 201, hh)
}

func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	var oo models.Organization
	if err := decodeJSON(r, &oo); err != nil { respond(w, 400, map[string]string{"error": "invalid body"}); return }
	if err := h.svc.CreateOrganization(r.Context(), &oo); err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 201, oo)
}

func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	oo, err := h.svc.ListOrganizations(r.Context())
	if err != nil { respond(w, 500, map[string]string{"error": err.Error()}); return }
	respond(w, 200, oo)
}

func (h *Handler) ChangeMyPassword(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(middleware.CtxKeyUserID).(int64)
	var req struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil || req.Password == "" {
		respond(w, 400, map[string]string{"error": "password required"})
		return
	}
	if err := h.svc.UpdatePassword(r.Context(), userID, req.Password); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, map[string]string{"status": "ok"})
}

// ─── Asset Types ────────────────────────────────────────────────

func (h *Handler) ListAssetTypes(w http.ResponseWriter, r *http.Request) {
	types, err := h.svc.ListAssetTypes(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, types)
}

func (h *Handler) CreateAssetType(w http.ResponseWriter, r *http.Request) {
	var t models.AssetType
	if err := decodeJSON(r, &t); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.CreateAssetType(r.Context(), &t); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, t)
}

func (h *Handler) UpdateAssetType(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var t models.AssetType
	if err := decodeJSON(r, &t); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	t.ID = id
	if err := h.svc.UpdateAssetType(r.Context(), &t); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, t)
}

func (h *Handler) DeleteAssetType(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.DeleteAssetType(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

// ─── Asset Categories ──────────────────────────────────────────

func (h *Handler) ListAssetCategories(w http.ResponseWriter, r *http.Request) {
	cats, err := h.svc.ListAssetCategories(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, cats)
}

func (h *Handler) CreateAssetCategory(w http.ResponseWriter, r *http.Request) {
	var c models.AssetCategory
	if err := decodeJSON(r, &c); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := h.svc.CreateAssetCategory(r.Context(), &c); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, c)
}

func (h *Handler) UpdateAssetCategory(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var c models.AssetCategory
	if err := decodeJSON(r, &c); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	c.ID = id
	if err := h.svc.UpdateAssetCategory(r.Context(), &c); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, c)
}

func (h *Handler) DeleteAssetCategory(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.DeleteAssetCategory(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}
