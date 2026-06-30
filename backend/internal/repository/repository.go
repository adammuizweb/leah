package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/adammuiz/leah/internal/models"
)

type Repository struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Repository { return &Repository{db: db} }

// ─── Tickets ────────────────────────────────────────────────────

const ticketCols = `id, title, description, status, priority, assigned_to, created_by, updated_by, deleted_by, asset_id, organization_id, created_at, updated_at`

type TicketFilter struct {
	Search   string
	Status   string
	Priority string
	Page     int
	PerPage  int
}

type PaginatedResult[T any] struct {
	Data       []T   `json:"data"`
	Total      int   `json:"total"`
	Page       int   `json:"page"`
	PerPage    int   `json:"per_page"`
	TotalPages int   `json:"total_pages"`
}

func (r *Repository) ListTickets(ctx context.Context, f TicketFilter) (*PaginatedResult[models.Ticket], error) {
	if f.Page < 1 { f.Page = 1 }
	if f.PerPage < 1 { f.PerPage = 20 }

	where := `WHERE t.deleted_at IS NULL`
	args := []any{}
	aidx := 1

	if f.Search != "" {
		where += fmt.Sprintf(` AND (t.title ILIKE $%d OR t.description ILIKE $%d)`, aidx, aidx)
		args = append(args, "%"+f.Search+"%")
		aidx++
	}
	if f.Status != "" {
		where += fmt.Sprintf(` AND t.status = $%d`, aidx)
		args = append(args, f.Status)
		aidx++
	}
	if f.Priority != "" {
		where += fmt.Sprintf(` AND t.priority = $%d`, aidx)
		args = append(args, f.Priority)
		aidx++
	}

	var total int
	countQuery := `SELECT COUNT(*) FROM tickets t ` + where
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	offset := (f.Page - 1) * f.PerPage
	dataQuery := `SELECT `+ticketCols+` FROM tickets t ` + where + ` ORDER BY t.created_at DESC LIMIT $` + fmt.Sprintf("%d", aidx) + ` OFFSET $` + fmt.Sprintf("%d", aidx+1)
	args = append(args, f.PerPage, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tickets := make([]models.Ticket, 0)
	for rows.Next() {
		var t models.Ticket
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.AssignedTo, &t.CreatedBy, &t.UpdatedBy, &t.DeletedBy, &t.AssetID, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tickets = append(tickets, t)
	}

	totalPages := (total + f.PerPage - 1) / f.PerPage
	return &PaginatedResult[models.Ticket]{Data: tickets, Total: total, Page: f.Page, PerPage: f.PerPage, TotalPages: totalPages}, nil
}

func (r *Repository) CreateTicket(ctx context.Context, t *models.Ticket) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO tickets (title, description, status, priority, assigned_to, created_by, asset_id, organization_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at, updated_at`,
		t.Title, t.Description, t.Status, t.Priority, t.AssignedTo, t.CreatedBy, t.AssetID, t.OrganizationID,
	).Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *Repository) GetTicket(ctx context.Context, id int64) (*models.Ticket, error) {
	t := &models.Ticket{}
	err := r.db.QueryRow(ctx,
		`SELECT `+ticketCols+` FROM tickets WHERE id=$1 AND deleted_at IS NULL`, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.AssignedTo, &t.CreatedBy, &t.UpdatedBy, &t.DeletedBy, &t.AssetID, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("ticket not found")
	}
	return t, nil
}

func (r *Repository) UpdateTicket(ctx context.Context, t *models.Ticket, userID int64) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE tickets SET title=$1, description=$2, status=$3, priority=$4, assigned_to=$5, asset_id=$6, updated_at=NOW(), updated_by=$7 WHERE id=$8 AND deleted_at IS NULL`,
		t.Title, t.Description, t.Status, t.Priority, t.AssignedTo, t.AssetID, userID, t.ID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket not found")
	}
	return nil
}

func (r *Repository) DeleteTicket(ctx context.Context, id, userID int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE tickets SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("ticket not found")
	}
	return nil
}

// ─── Assets ─────────────────────────────────────────────────────

const assetCols = `id, name, type, type_id, category_id, serial, status, location, assigned_to, created_by, updated_by, deleted_by, organization_id, created_at, updated_at`

type AssetFilter struct {
	Search  string
	Status  string
	TypeID  int64
	Page    int
	PerPage int
}

func (r *Repository) ListAssets(ctx context.Context, f AssetFilter) (*PaginatedResult[models.Asset], error) {
	if f.Page < 1 { f.Page = 1 }
	if f.PerPage < 1 { f.PerPage = 20 }

	where := `WHERE a.deleted_at IS NULL`
	args := []any{}
	aidx := 1

	if f.Search != "" {
		where += fmt.Sprintf(` AND (a.name ILIKE $%d OR a.serial ILIKE $%d)`, aidx, aidx)
		args = append(args, "%"+f.Search+"%")
		aidx++
	}
	if f.Status != "" {
		where += fmt.Sprintf(` AND a.status = $%d`, aidx)
		args = append(args, f.Status)
		aidx++
	}
	if f.TypeID > 0 {
		where += fmt.Sprintf(` AND a.type_id = $%d`, aidx)
		args = append(args, f.TypeID)
		aidx++
	}

	var total int
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM assets a `+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	offset := (f.Page - 1) * f.PerPage
	dataQuery := `SELECT `+assetCols+` FROM assets a ` + where + ` ORDER BY a.name LIMIT $` + fmt.Sprintf("%d", aidx) + ` OFFSET $` + fmt.Sprintf("%d", aidx+1)
	args = append(args, f.PerPage, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	assets := make([]models.Asset, 0)
	for rows.Next() {
		var a models.Asset
		if err := rows.Scan(&a.ID, &a.Name, &a.Type, &a.TypeID, &a.CategoryID, &a.Serial, &a.Status, &a.Location, &a.AssignedTo, &a.CreatedBy, &a.UpdatedBy, &a.DeletedBy, &a.OrganizationID, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		assets = append(assets, a)
	}

	totalPages := (total + f.PerPage - 1) / f.PerPage
	return &PaginatedResult[models.Asset]{Data: assets, Total: total, Page: f.Page, PerPage: f.PerPage, TotalPages: totalPages}, nil
}

func (r *Repository) CreateAsset(ctx context.Context, a *models.Asset) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO assets (name, type, type_id, category_id, serial, status, location, assigned_to, created_by, organization_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id, created_at, updated_at`,
		a.Name, a.Type, a.TypeID, a.CategoryID, a.Serial, a.Status, a.Location, a.AssignedTo, a.CreatedBy, a.OrganizationID,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt)
}

func (r *Repository) GetAsset(ctx context.Context, id int64) (*models.Asset, error) {
	a := &models.Asset{}
	err := r.db.QueryRow(ctx,
		`SELECT `+assetCols+` FROM assets WHERE id=$1 AND deleted_at IS NULL`, id,
	).Scan(&a.ID, &a.Name, &a.Type, &a.TypeID, &a.CategoryID, &a.Serial, &a.Status, &a.Location, &a.AssignedTo, &a.CreatedBy, &a.UpdatedBy, &a.DeletedBy, &a.OrganizationID, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("asset not found")
	}
	return a, nil
}

func (r *Repository) UpdateAsset(ctx context.Context, a *models.Asset, userID int64) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE assets SET name=$1, type=$2, type_id=$3, category_id=$4, serial=$5, status=$6, location=$7, assigned_to=$8, organization_id=$9, updated_at=NOW(), updated_by=$10 WHERE id=$11 AND deleted_at IS NULL`,
		a.Name, a.Type, a.TypeID, a.CategoryID, a.Serial, a.Status, a.Location, a.AssignedTo, a.OrganizationID, userID, a.ID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("asset not found")
	}
	return nil
}

func (r *Repository) DeleteAsset(ctx context.Context, id, userID int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE assets SET deleted_at=NOW(), deleted_by=$1 WHERE id=$2 AND deleted_at IS NULL`, userID, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("asset not found")
	}
	return nil
}

// ─── Auth / Users ───────────────────────────────────────────────

func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*models.User, error) {
	u := &models.User{}
	err := r.db.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(ro.name,'') as role, u.is_superuser, u.organization_id, u.created_at, u.deleted_at
		 FROM users u LEFT JOIN roles ro ON ro.id = u.role_id WHERE u.email=$1`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.IsSuperuser, &u.OrganizationID, &u.CreatedAt, &u.DeletedAt)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	return u, nil
}

func (r *Repository) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	u := &models.User{}
	err := r.db.QueryRow(ctx,
		`SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(ro.name,'') as role, u.is_superuser, u.organization_id, u.created_at, u.deleted_at
		 FROM users u LEFT JOIN roles ro ON ro.id = u.role_id WHERE u.id=$1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.IsSuperuser, &u.OrganizationID, &u.CreatedAt, &u.DeletedAt)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}
	return u, nil
}

func (r *Repository) GetUserPermissions(ctx context.Context, userID int64) ([]models.Permission, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.id, p.name, p.module, p.action FROM permissions p
		 JOIN role_permissions rp ON rp.permission_id=p.id JOIN users u ON u.role_id=rp.role_id WHERE u.id=$1`, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	perms := make([]models.Permission, 0)
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(&p.ID, &p.Name, &p.Module, &p.Action); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}

// ─── User Management ────────────────────────────────────────────

func (r *Repository) ListUsers(ctx context.Context) ([]models.User, error) {
	rows, err := r.db.Query(ctx,
		`SELECT u.id, u.email, u.name, u.password_hash, u.role_id, COALESCE(ro.name,'') as role, u.is_superuser, u.organization_id, u.created_at, u.deleted_at
		 FROM users u LEFT JOIN roles ro ON ro.id=u.role_id ORDER BY u.created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.PasswordHash, &u.RoleID, &u.Role, &u.IsSuperuser, &u.OrganizationID, &u.CreatedAt, &u.DeletedAt); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, nil
}

func (r *Repository) CreateUser(ctx context.Context, u *models.User) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO users (email, name, password_hash, role_id) VALUES ($1,$2,$3,$4) RETURNING id, created_at`,
		u.Email, u.Name, u.PasswordHash, u.RoleID,
	).Scan(&u.ID, &u.CreatedAt)
}

func (r *Repository) UpdateUser(ctx context.Context, u *models.User) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE users SET name=$1, email=$2, role_id=$3 WHERE id=$4 AND deleted_at IS NULL`,
		u.Name, u.Email, u.RoleID, u.ID,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (r *Repository) UpdateUserPassword(ctx context.Context, id int64, hash string) error {
	tag, err := r.db.Exec(ctx, `UPDATE users SET password_hash=$1 WHERE id=$2 AND deleted_at IS NULL`, hash, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (r *Repository) SoftDeleteUser(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE users SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// ─── Roles ──────────────────────────────────────────────────────

func (r *Repository) ListRoles(ctx context.Context) ([]models.Role, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, label, is_admin, created_at FROM roles ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	roles := make([]models.Role, 0)
	for rows.Next() {
		var ro models.Role
		if err := rows.Scan(&ro.ID, &ro.Name, &ro.Label, &ro.IsAdmin, &ro.CreatedAt); err != nil {
			return nil, err
		}
		roles = append(roles, ro)
	}
	return roles, nil
}

func (r *Repository) CreateRole(ctx context.Context, ro *models.Role) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO roles (name, label, is_admin) VALUES ($1,$2,$3) RETURNING id, created_at`,
		ro.Name, ro.Label, ro.IsAdmin,
	).Scan(&ro.ID, &ro.CreatedAt)
}

func (r *Repository) UpdateRole(ctx context.Context, ro *models.Role) error {
	_, err := r.db.Exec(ctx,
		`UPDATE roles SET name=$1, label=$2, is_admin=$3 WHERE id=$4`,
		ro.Name, ro.Label, ro.IsAdmin, ro.ID,
	)
	return err
}

func (r *Repository) DeleteRole(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM roles WHERE id=$1 AND is_admin=false`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("role not found or cannot delete admin role")
	}
	return nil
}

func (r *Repository) GetRolePermissions(ctx context.Context, roleID int64) ([]models.Permission, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.id, p.name, p.module, p.action FROM permissions p
		 JOIN role_permissions rp ON rp.permission_id=p.id WHERE rp.role_id=$1 ORDER BY p.module, p.action`, roleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	perms := make([]models.Permission, 0)
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(&p.ID, &p.Name, &p.Module, &p.Action); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}

func (r *Repository) SetRolePermissions(ctx context.Context, roleID int64, permissionIDs []int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `DELETE FROM role_permissions WHERE role_id=$1`, roleID); err != nil {
		return err
	}
	for _, pid := range permissionIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, roleID, pid); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListAllPermissions(ctx context.Context) ([]models.Permission, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, module, action FROM permissions ORDER BY module, action`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	perms := make([]models.Permission, 0)
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(&p.ID, &p.Name, &p.Module, &p.Action); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}

// ─── Bin (soft delete) ──────────────────────────────────────────

type BinItem struct {
	Type      string     `json:"type"`
	ID        int64      `json:"id"`
	Title     string     `json:"title"`
	DeletedAt time.Time  `json:"deleted_at"`
}

func (r *Repository) ListBin(ctx context.Context) ([]BinItem, error) {
	items := make([]BinItem, 0)

	rows, err := r.db.Query(ctx, `SELECT 'ticket' as type, id, title, deleted_at FROM tickets WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var b BinItem
		if err := rows.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows2, err := r.db.Query(ctx, `SELECT 'asset' as type, id, name, deleted_at FROM assets WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows2.Close()
	for rows2.Next() {
		var b BinItem
		if err := rows2.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows3, err := r.db.Query(ctx, `SELECT 'user' as type, id, name, deleted_at FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows3.Close()
	for rows3.Next() {
		var b BinItem
		if err := rows3.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows4, err := r.db.Query(ctx, `SELECT 'type' as type, id, name, deleted_at FROM asset_types WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows4.Close()
	for rows4.Next() {
		var b BinItem
		if err := rows4.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	rows5, err := r.db.Query(ctx, `SELECT 'category' as type, id, name, deleted_at FROM asset_categories WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows5.Close()
	for rows5.Next() {
		var b BinItem
		if err := rows5.Scan(&b.Type, &b.ID, &b.Title, &b.DeletedAt); err != nil {
			return nil, err
		}
		items = append(items, b)
	}

	return items, nil
}

func (r *Repository) RestoreItem(ctx context.Context, itemType string, id int64) error {
	var table string
	switch itemType {
	case "ticket":
		table = "tickets"
	case "asset":
		table = "assets"
	case "user":
		table = "users"
	case "type":
		table = "asset_types"
	case "category":
		table = "asset_categories"
	default:
		return fmt.Errorf("unknown type: %s", itemType)
	}
	tag, err := r.db.Exec(ctx, fmt.Sprintf(`UPDATE %s SET deleted_at=NULL WHERE id=$1`, table), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

func (r *Repository) PermanentlyDelete(ctx context.Context, itemType string, id int64) error {
	var table string
	switch itemType {
	case "ticket":
		table = "tickets"
	case "asset":
		table = "assets"
	case "user":
		table = "users"
	case "type":
		table = "asset_types"
	case "category":
		table = "asset_categories"
	default:
		return fmt.Errorf("unknown type: %s", itemType)
	}
	tag, err := r.db.Exec(ctx, fmt.Sprintf(`DELETE FROM %s WHERE id=$1 AND deleted_at IS NOT NULL`, table), id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("item not found")
	}
	return nil
}

// ─── Asset Types & Categories ──────────────────────────────────

func (r *Repository) ListAssetTypes(ctx context.Context) ([]models.AssetType, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, created_at FROM asset_types WHERE deleted_at IS NULL ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	types := make([]models.AssetType, 0)
	for rows.Next() {
		var t models.AssetType
		if err := rows.Scan(&t.ID, &t.Name, &t.CreatedAt); err != nil {
			return nil, err
		}
		types = append(types, t)
	}
	return types, nil
}

func (r *Repository) CreateAssetType(ctx context.Context, t *models.AssetType) error {
	return r.db.QueryRow(ctx, `INSERT INTO asset_types (name) VALUES ($1) RETURNING id, created_at`, t.Name).Scan(&t.ID, &t.CreatedAt)
}

func (r *Repository) UpdateAssetType(ctx context.Context, t *models.AssetType) error {
	_, err := r.db.Exec(ctx, `UPDATE asset_types SET name=$1 WHERE id=$2 AND deleted_at IS NULL`, t.Name, t.ID)
	return err
}

func (r *Repository) DeleteAssetType(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE asset_types SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	// Also soft-delete categories under this type
	r.db.Exec(ctx, `UPDATE asset_categories SET deleted_at=NOW() WHERE type_id=$1 AND deleted_at IS NULL`, id)
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("type not found")
	}
	return nil
}

func (r *Repository) ListAssetCategories(ctx context.Context) ([]models.AssetCategory, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, parent_id, type_id, created_at FROM asset_categories WHERE deleted_at IS NULL ORDER BY type_id, name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cats := make([]models.AssetCategory, 0)
	for rows.Next() {
		var c models.AssetCategory
		if err := rows.Scan(&c.ID, &c.Name, &c.ParentID, &c.TypeID, &c.CreatedAt); err != nil {
			return nil, err
		}
		cats = append(cats, c)
	}
	return cats, nil
}

func (r *Repository) CreateAssetCategory(ctx context.Context, c *models.AssetCategory) error {
	return r.db.QueryRow(ctx,
		`INSERT INTO asset_categories (name, parent_id, type_id) VALUES ($1,$2,$3) RETURNING id, created_at`,
		c.Name, c.ParentID, c.TypeID,
	).Scan(&c.ID, &c.CreatedAt)
}

func (r *Repository) UpdateAssetCategory(ctx context.Context, c *models.AssetCategory) error {
	_, err := r.db.Exec(ctx,
		`UPDATE asset_categories SET name=$1, parent_id=$2, type_id=$3 WHERE id=$4`,
		c.Name, c.ParentID, c.TypeID, c.ID,
	)
	return err
}

func (r *Repository) ListHoldings(ctx context.Context) ([]models.Holding, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, slug, created_at FROM holdings ORDER BY name`)
	if err != nil { return nil, err }
	defer rows.Close()
	hh := make([]models.Holding, 0)
	for rows.Next() {
		var h models.Holding
		if err := rows.Scan(&h.ID, &h.Name, &h.Slug, &h.CreatedAt); err != nil { return nil, err }
		hh = append(hh, h)
	}
	return hh, nil
}

func (r *Repository) CreateHolding(ctx context.Context, h *models.Holding) error {
	return r.db.QueryRow(ctx, `INSERT INTO holdings (name, slug) VALUES ($1,$2) RETURNING id, created_at`, h.Name, h.Slug).Scan(&h.ID, &h.CreatedAt)
}

func (r *Repository) ListOrganizations(ctx context.Context) ([]models.Organization, error) {
	rows, err := r.db.Query(ctx, `SELECT id, name, parent_id, holding_id, path, level, created_at FROM organizations ORDER BY path`)
	if err != nil { return nil, err }
	defer rows.Close()
	oo := make([]models.Organization, 0)
	for rows.Next() {
		var o models.Organization
		if err := rows.Scan(&o.ID, &o.Name, &o.ParentID, &o.HoldingID, &o.Path, &o.Level, &o.CreatedAt); err != nil { return nil, err }
		oo = append(oo, o)
	}
	return oo, nil
}

func (r *Repository) DeleteAssetCategory(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `UPDATE asset_categories SET deleted_at=NOW() WHERE id=$1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("category not found")
	}
	return nil
}
