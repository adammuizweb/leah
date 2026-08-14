package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/services"
	"github.com/go-chi/chi/v5"
)

// ─── Users ──────────────────────────────────────────────────────

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	var orgID, holdingID *int64
	if v := r.URL.Query().Get("organization_id"); v != "" {
		if id, err := strconv.ParseInt(v, 10, 64); err == nil {
			orgID = &id
		}
	}
	if v := r.URL.Query().Get("holding_id"); v != "" {
		if id, err := strconv.ParseInt(v, 10, 64); err == nil {
			holdingID = &id
		}
	}
	users, err := h.svc.ListUsers(r.Context(), orgID, holdingID)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if requestIsRoot(r) {
		items := make([]models.UserSecurityView, len(users))
		for i := range users {
			items[i] = models.UserSecurityView{User: users[i], LockedUntil: users[i].LockedUntil}
		}
		respond(w, 200, items)
		return
	}
	respond(w, 200, users)
}

func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if !h.svc.UserInScope(r.Context(), id) {
		respond(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	u, err := h.svc.GetUserByID(r.Context(), id)
	if err != nil {
		respond(w, 404, map[string]string{"error": "user not found"})
		return
	}
	if requestIsRoot(r) {
		respond(w, 200, models.UserSecurityView{User: *u, LockedUntil: u.LockedUntil})
		return
	}
	respond(w, 200, u)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string  `json:"email"`
		Name     string  `json:"name"`
		Password string  `json:"password"`
		RoleID   *int64  `json:"role_id"`
		OrgIDs   []int64 `json:"org_ids"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if err := services.ValidatePassword(req.Password); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if !h.canAssignRole(w, r, req.RoleID) {
		return
	}
	u := &models.User{Email: strings.ToLower(strings.TrimSpace(req.Email)), Name: req.Name, RoleID: req.RoleID}
	if err := h.svc.CreateUser(r.Context(), u, req.Password, req.OrgIDs); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, u)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if !h.canManageUser(w, r, id) {
		return
	}
	var req struct {
		Email          string  `json:"email"`
		Name           string  `json:"name"`
		RoleID         *int64  `json:"role_id"`
		OrganizationID *int64  `json:"organization_id"`
		OrgIDs         []int64 `json:"org_ids"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid request body"})
		return
	}
	if !h.canAssignRole(w, r, req.RoleID) {
		return
	}
	u := &models.User{ID: id, Email: strings.ToLower(strings.TrimSpace(req.Email)), Name: req.Name, RoleID: req.RoleID, OrganizationID: req.OrganizationID}
	var orgIDs *[]int64
	if req.OrgIDs != nil {
		orgIDs = &req.OrgIDs
	}
	if err := h.svc.UpdateUser(r.Context(), u, orgIDs); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, u)
}

func (h *Handler) UpdateUserPassword(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if !h.canManageUser(w, r, id) {
		return
	}
	var req struct {
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil || req.Password == "" {
		respond(w, 400, map[string]string{"error": "password required"})
		return
	}
	if err := services.ValidatePassword(req.Password); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
	if !h.canManageUser(w, r, id) {
		return
	}
	target, err := h.svc.GetUserByID(r.Context(), id)
	if err != nil {
		respond(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return
	}
	if target.IsRoot {
		respond(w, http.StatusForbidden, map[string]string{"error": "root account cannot be deleted"})
		return
	}
	if err := h.svc.SoftDeleteUser(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

func (h *Handler) canManageUser(w http.ResponseWriter, r *http.Request, id int64) bool {
	if !h.svc.UserInScope(r.Context(), id) {
		respond(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return false
	}
	target, err := h.svc.GetUserByID(r.Context(), id)
	if err != nil {
		respond(w, http.StatusNotFound, map[string]string{"error": "user not found"})
		return false
	}
	if target.IsRoot && !requestIsRoot(r) {
		respond(w, http.StatusForbidden, map[string]string{"error": "root access required"})
		return false
	}
	if !requestIsRoot(r) && !requestHasPermission(r, "settings.update") && target.RoleID != nil {
		privileged, err := h.svc.RoleHasSettingsAccess(r.Context(), *target.RoleID)
		if err != nil {
			respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate role"})
			return false
		}
		if privileged {
			respond(w, http.StatusForbidden, map[string]string{"error": "settings.update permission required to manage this role"})
			return false
		}
	}
	return true
}

func (h *Handler) canAssignRole(w http.ResponseWriter, r *http.Request, roleID *int64) bool {
	if requestIsRoot(r) || requestHasPermission(r, "settings.update") || roleID == nil {
		return true
	}
	privileged, err := h.svc.RoleHasSettingsAccess(r.Context(), *roleID)
	if err != nil {
		respond(w, http.StatusInternalServerError, map[string]string{"error": "failed to validate role"})
		return false
	}
	if privileged {
		respond(w, http.StatusForbidden, map[string]string{"error": "settings.update permission required to assign this role"})
		return false
	}
	return true
}

func requestIsRoot(r *http.Request) bool {
	isRoot, _ := r.Context().Value(middleware.CtxKeyIsRoot).(bool)
	return isRoot
}

func requestHasPermission(r *http.Request, permission string) bool {
	permissions, _ := r.Context().Value(middleware.CtxKeyPermissions).([]string)
	for _, granted := range permissions {
		if granted == permission {
			return true
		}
	}
	return false
}

// ─── Roles ──────────────────────────────────────────────────────

func (h *Handler) ListRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.svc.ListRoles(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, roles)
}

func (h *Handler) CreateRole(w http.ResponseWriter, r *http.Request) {
	var ro models.Role
	if err := decodeJSON(r, &ro); err != nil {
		respond(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if err := h.svc.CreateRole(r.Context(), &ro); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, ro)
}

func (h *Handler) UpdateRole(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var ro models.Role
	if err := decodeJSON(r, &ro); err != nil {
		respond(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	ro.ID = id
	if err := h.svc.UpdateRole(r.Context(), &ro); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, ro)
}

func (h *Handler) DeleteRole(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err := h.svc.DeleteRole(r.Context(), id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

func (h *Handler) GetRolePermissions(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	perms, err := h.svc.GetRolePermissions(r.Context(), id)
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, perms)
}

func (h *Handler) SetRolePermissions(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	var req struct {
		PermissionIDs []int64 `json:"permission_ids"`
	}
	if err := decodeJSON(r, &req); err != nil {
		respond(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if err := h.svc.SetRolePermissions(r.Context(), id, req.PermissionIDs); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) ListAllPermissions(w http.ResponseWriter, r *http.Request) {
	perms, err := h.svc.ListAllPermissions(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, perms)
}

// ─── Bin ────────────────────────────────────────────────────────

func (h *Handler) ListBin(w http.ResponseWriter, r *http.Request) {
	items, err := h.svc.ListBin(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, items)
}

func (h *Handler) RestoreItem(w http.ResponseWriter, r *http.Request) {
	typ := chi.URLParam(r, "type")
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if typ == "user" {
		target, err := h.svc.GetUserByID(r.Context(), id)
		if err != nil {
			respond(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		if target.IsRoot && !requestIsRoot(r) {
			respond(w, http.StatusForbidden, map[string]string{"error": "root access required"})
			return
		}
	}
	if err := h.svc.RestoreItem(r.Context(), typ, id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) PermanentlyDelete(w http.ResponseWriter, r *http.Request) {
	typ := chi.URLParam(r, "type")
	id, _ := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if typ == "user" {
		target, err := h.svc.GetUserByID(r.Context(), id)
		if err != nil {
			respond(w, http.StatusNotFound, map[string]string{"error": "user not found"})
			return
		}
		if target.IsRoot {
			respond(w, http.StatusForbidden, map[string]string{"error": "root account cannot be deleted"})
			return
		}
	}
	if err := h.svc.PermanentlyDelete(r.Context(), typ, id); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 204, nil)
}

func (h *Handler) ListHoldings(w http.ResponseWriter, r *http.Request) {
	hh, err := h.svc.ListHoldings(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 200, hh)
}

func (h *Handler) CreateHolding(w http.ResponseWriter, r *http.Request) {
	var hh models.Holding
	if err := decodeJSON(r, &hh); err != nil {
		respond(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if err := h.svc.CreateHolding(r.Context(), &hh); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, hh)
}

func (h *Handler) UpdateHoldingITOrganization(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}
	var body struct {
		ITOrganizationID *int64 `json:"it_organization_id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if err := h.svc.UpdateHoldingITOrganization(r.Context(), id, body.ITOrganizationID); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) CreateOrganization(w http.ResponseWriter, r *http.Request) {
	var oo models.Organization
	if err := decodeJSON(r, &oo); err != nil {
		respond(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if err := h.svc.CreateOrganization(r.Context(), &oo); err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
	respond(w, 201, oo)
}

func (h *Handler) UpdateOrganizationManager(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
		return
	}
	var body struct {
		ManagerUserID *int64 `json:"manager_user_id"`
	}
	if err := decodeJSON(r, &body); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if err := h.svc.UpdateOrganizationManager(r.Context(), id, body.ManagerUserID); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	respond(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) ListOrganizations(w http.ResponseWriter, r *http.Request) {
	oo, err := h.svc.ListOrganizations(r.Context())
	if err != nil {
		respond(w, 500, map[string]string{"error": err.Error()})
		return
	}
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
	if err := services.ValidatePassword(req.Password); err != nil {
		respond(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
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
