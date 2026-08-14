package repository

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/models"
)

func TestOrganizationScope(t *testing.T) {
	repo, pool := testSecurityRepository(t)
	ctx := context.Background()
	suffix := time.Now().UnixNano()

	var holdingID int64
	if err := pool.QueryRow(ctx,
		`INSERT INTO holdings (name, slug) VALUES ($1,$2) RETURNING id`,
		"Scope Test", fmt.Sprintf("scope-test-%d", suffix),
	).Scan(&holdingID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM user_organizations WHERE organization_id IN (SELECT id FROM organizations WHERE holding_id=$1)`, holdingID)
		_, _ = pool.Exec(ctx, `DELETE FROM tickets WHERE organization_id IN (SELECT id FROM organizations WHERE holding_id=$1)`, holdingID)
		_, _ = pool.Exec(ctx, `DELETE FROM assets WHERE organization_id IN (SELECT id FROM organizations WHERE holding_id=$1)`, holdingID)
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE organization_id IN (SELECT id FROM organizations WHERE holding_id=$1)`, holdingID)
		_, _ = pool.Exec(ctx, `DELETE FROM organizations WHERE holding_id=$1`, holdingID)
		_, _ = pool.Exec(ctx, `DELETE FROM holdings WHERE id=$1`, holdingID)
	})

	createOrganization := func(name string, parentID *int64, path string, level int) int64 {
		t.Helper()
		var id int64
		if err := pool.QueryRow(ctx,
			`INSERT INTO organizations (name, parent_id, holding_id, path, level) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			name, parentID, holdingID, path, level,
		).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}

	parentID := createOrganization("Scope Parent", nil, "/scope-parent/", 0)
	childID := createOrganization("Scope Child", &parentID, "/scope-parent/child/", 1)
	siblingID := createOrganization("Scope Sibling", nil, "/scope-sibling/", 0)
	itOrganizationID := createOrganization("Scope IT", nil, "/scope-it/", 0)

	var roleID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM roles WHERE name='user'`).Scan(&roleID); err != nil {
		t.Fatal(err)
	}

	insertUser := func(email string, organizationID int64) int64 {
		t.Helper()
		var id int64
		if err := pool.QueryRow(ctx,
			`INSERT INTO users (email, name, password_hash, role_id, organization_id) VALUES ($1,$2,'test-hash',$3,$4) RETURNING id`,
			email, "Scope User", roleID, organizationID,
		).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}

	childUserID := insertUser(fmt.Sprintf("scope-child-%d@example.test", suffix), childID)
	siblingUserID := insertUser(fmt.Sprintf("scope-sibling-%d@example.test", suffix), siblingID)
	departmentManagerID := insertUser(fmt.Sprintf("scope-manager-%d@example.test", suffix), parentID)
	itReviewerID := insertUser(fmt.Sprintf("scope-it-reviewer-%d@example.test", suffix), itOrganizationID)
	itManagerID := insertUser(fmt.Sprintf("scope-it-manager-%d@example.test", suffix), itOrganizationID)
	if _, err := pool.Exec(ctx, `UPDATE users SET role_id=(SELECT id FROM roles WHERE name='agent') WHERE id=$1`, itReviewerID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE organizations SET manager_user_id=$1 WHERE id=$2`, departmentManagerID, parentID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE organizations SET manager_user_id=$1 WHERE id=$2`, itManagerID, itOrganizationID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE holdings SET it_organization_id=$1 WHERE id=$2`, itOrganizationID, holdingID); err != nil {
		t.Fatal(err)
	}
	containsOrganization := func(organizationIDs []int64, wanted int64) bool {
		for _, organizationID := range organizationIDs {
			if organizationID == wanted {
				return true
			}
		}
		return false
	}
	itReviewerState, err := repo.LoadAuthorizationState(ctx, itReviewerID)
	if err != nil {
		t.Fatal(err)
	}
	if containsOrganization(itReviewerState.OrgIDs, childID) || containsOrganization(itReviewerState.OrgIDs, siblingID) {
		t.Fatalf("IT reviewer received global organization scope: %#v", itReviewerState.OrgIDs)
	}
	itManagerState, err := repo.LoadAuthorizationState(ctx, itManagerID)
	if err != nil {
		t.Fatal(err)
	}
	if containsOrganization(itManagerState.OrgIDs, childID) {
		t.Fatalf("IT manager received global organization scope: %#v", itManagerState.OrgIDs)
	}

	insertAsset := func(name string, organizationID int64) int64 {
		t.Helper()
		var id int64
		if err := pool.QueryRow(ctx,
			`INSERT INTO assets (name, type, status, organization_id) VALUES ($1,'test','active',$2) RETURNING id`,
			name, organizationID,
		).Scan(&id); err != nil {
			t.Fatal(err)
		}
		return id
	}

	childAssetID := insertAsset("Scoped Child Asset", childID)
	siblingAssetID := insertAsset("Scoped Sibling Asset", siblingID)

	scopedCtx := context.WithValue(ctx, middleware.CtxKeyOrgIDs, []int64{parentID})
	scopedCtx = context.WithValue(scopedCtx, middleware.CtxKeyOrgPaths, []string{"/scope-parent/"})

	result, err := repo.ListAssets(scopedCtx, AssetFilter{Page: 1, PerPage: 100})
	if err != nil {
		t.Fatal(err)
	}
	if result.Total != 1 || len(result.Data) != 1 || result.Data[0].ID != childAssetID {
		t.Fatalf("scoped assets = %#v, want only child asset %d", result.Data, childAssetID)
	}
	if _, err := repo.GetAsset(scopedCtx, siblingAssetID); err == nil {
		t.Fatal("sibling asset was visible outside organization scope")
	}
	if !repo.scopedUserExists(scopedCtx, childUserID) {
		t.Fatal("child user was not included in descendant scope")
	}
	if repo.scopedUserExists(scopedCtx, siblingUserID) {
		t.Fatal("sibling user was visible outside organization scope")
	}
	crossOrganizationAsset := &models.Asset{
		Name:           "Invalid Cross-Organization Assignment",
		Type:           "test",
		Status:         "active",
		OrganizationID: &childID,
		AssignedTo:     &siblingUserID,
	}
	if err := repo.CreateAsset(scopedCtx, crossOrganizationAsset); err == nil {
		t.Fatal("cross-organization asset assignment succeeded")
	}

	created := &models.User{
		Email:        fmt.Sprintf("scope-created-%d@example.test", suffix),
		Name:         "Scoped Created User",
		PasswordHash: "test-hash",
		RoleID:       &roleID,
	}
	if err := repo.CreateUser(scopedCtx, created, []int64{childID}); err != nil {
		t.Fatal(err)
	}
	var primaryOrganizationID int64
	if err := pool.QueryRow(ctx, `SELECT organization_id FROM users WHERE id=$1`, created.ID).Scan(&primaryOrganizationID); err != nil {
		t.Fatal(err)
	}
	if primaryOrganizationID != childID {
		t.Fatalf("primary organization = %d, want %d", primaryOrganizationID, childID)
	}

	invalidOrganizations := []int64{siblingID}
	created.Name = "Must Not Persist"
	if err := repo.UpdateUser(scopedCtx, created, &invalidOrganizations); err == nil {
		t.Fatal("out-of-scope organization update succeeded")
	}
	var storedName string
	if err := pool.QueryRow(ctx, `SELECT name FROM users WHERE id=$1`, created.ID).Scan(&storedName); err != nil {
		t.Fatal(err)
	}
	if storedName == created.Name {
		t.Fatal("user fields changed despite rejected organization update")
	}

	softwareRequest := &models.Ticket{
		Title:             "Scope Software Request",
		Description:       "Request integration coverage",
		Status:            "new",
		Priority:          "medium",
		CreatedBy:         childUserID,
		OrganizationID:    &childID,
		RequestKind:       "software",
		ApprovalStatus:    "pending_manager",
		SoftwareName:      "Scope Hub",
		BusinessObjective: "Validate scoped request persistence",
		TargetUsers:       "Scope testers",
	}
	if err := repo.CreateTicket(scopedCtx, softwareRequest); err != nil {
		t.Fatal(err)
	}
	itReviewerCtx := context.WithValue(ctx, middleware.CtxKeyUserID, itReviewerID)
	itReviewerCtx = context.WithValue(itReviewerCtx, middleware.CtxKeyUserRole, itReviewerState.Role)
	itReviewerCtx = context.WithValue(itReviewerCtx, middleware.CtxKeyPermissions, itReviewerState.Permissions)
	itReviewerCtx = context.WithValue(itReviewerCtx, middleware.CtxKeyOrgIDs, itReviewerState.OrgIDs)
	itReviewerCtx = context.WithValue(itReviewerCtx, middleware.CtxKeyOrgPaths, itReviewerState.OrgPaths)
	itTickets, err := repo.ListTickets(itReviewerCtx, TicketFilter{Page: 1, PerPage: 100})
	if err != nil {
		t.Fatal(err)
	}
	if itTickets.Total != 1 || itTickets.Data[0].ID != softwareRequest.ID {
		t.Fatalf("IT reviewer ticket scope = %#v", itTickets.Data)
	}
	itAssets, err := repo.ListAssets(itReviewerCtx, AssetFilter{Page: 1, PerPage: 100})
	if err != nil {
		t.Fatal(err)
	}
	if itAssets.Total != 0 {
		t.Fatalf("IT reviewer received cross-department asset scope: %#v", itAssets.Data)
	}
	if err := repo.UpdateDepartmentManagerReview(scopedCtx, softwareRequest.ID, childUserID, "approved", "Unauthorized approval"); err == nil {
		t.Fatal("requester approved their own formal request")
	}
	if err := repo.UpdateDepartmentManagerReview(scopedCtx, softwareRequest.ID, departmentManagerID, "approved", "Department approved"); err != nil {
		t.Fatal(err)
	}
	if err := repo.UpdateITReview(scopedCtx, softwareRequest.ID, siblingUserID, "recommended", "Unauthorized recommendation"); err == nil {
		t.Fatal("user outside the IT organization reviewed a request")
	}
	if err := repo.UpdateITReview(scopedCtx, softwareRequest.ID, itReviewerID, "recommended", "Architecture is suitable"); err != nil {
		t.Fatal(err)
	}
	if err := repo.UpdateITManagerReview(scopedCtx, softwareRequest.ID, itReviewerID, "recommended", "Unauthorized sign-off"); err == nil {
		t.Fatal("IT reviewer completed the IT manager sign-off")
	}
	if err := repo.UpdateITManagerReview(scopedCtx, softwareRequest.ID, itManagerID, "recommended", "IT recommendation confirmed"); err != nil {
		t.Fatal(err)
	}
	approved, err := repo.GetTicket(scopedCtx, softwareRequest.ID)
	if err != nil {
		t.Fatal(err)
	}
	if approved.RequestKind != "software" || approved.ApprovalStatus != "approved" || approved.ApprovedAt == nil {
		t.Fatalf("approved request = %#v", approved)
	}
	workflowHistory, err := repo.ListRequestWorkflowHistory(scopedCtx, softwareRequest.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(workflowHistory) != 3 || workflowHistory[0].Stage != "department_manager" || workflowHistory[2].Stage != "it_manager" {
		t.Fatalf("request workflow history = %#v", workflowHistory)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM tickets WHERE id=$1`, softwareRequest.ID); err == nil {
		t.Fatal("formal request with workflow history was permanently deleted")
	}
	statusNote := "Discovery started"
	if err := repo.UpdateTicketStatus(scopedCtx, softwareRequest.ID, "new", "open", childUserID, &statusNote); err != nil {
		t.Fatal(err)
	}
	history, err := repo.ListStatusHistory(scopedCtx, softwareRequest.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(history) != 1 || history[0].FromStatus == nil || *history[0].FromStatus != "new" || history[0].ToStatus != "open" {
		t.Fatalf("request status history = %#v", history)
	}
	softwareRequest.Title = "Edited Scope Software Request"
	softwareRequest.OrganizationID = &siblingID
	if err := repo.UpdateTicket(scopedCtx, softwareRequest, childUserID); err == nil {
		t.Fatal("request moved to another organization after approval")
	}
	softwareRequest.OrganizationID = &childID
	if err := repo.UpdateTicket(scopedCtx, softwareRequest, childUserID); err != nil {
		t.Fatal(err)
	}
	edited, err := repo.GetTicket(scopedCtx, softwareRequest.ID)
	if err != nil {
		t.Fatal(err)
	}
	if edited.Title != softwareRequest.Title || edited.Status != "open" {
		t.Fatalf("stale metadata edit reverted workflow state: %#v", edited)
	}

	rejectedRequest := *softwareRequest
	rejectedRequest.ID = 0
	rejectedRequest.Title = "Rejected Scope Software Request"
	rejectedRequest.Status = "new"
	rejectedRequest.ApprovalStatus = "pending_manager"
	rejectedRequest.ApprovedBy = nil
	rejectedRequest.ApprovedAt = nil
	rejectedRequest.ApprovalNote = ""
	if err := repo.CreateTicket(scopedCtx, &rejectedRequest); err != nil {
		t.Fatal(err)
	}
	if err := repo.UpdateDepartmentManagerReview(scopedCtx, rejectedRequest.ID, departmentManagerID, "rejected", "Not aligned with current priorities"); err != nil {
		t.Fatal(err)
	}
	rejected, err := repo.GetTicket(scopedCtx, rejectedRequest.ID)
	if err != nil {
		t.Fatal(err)
	}
	if rejected.ApprovalStatus != "rejected" || rejected.Status != "cancelled" {
		t.Fatalf("rejected request state = %s/%s", rejected.ApprovalStatus, rejected.Status)
	}

	cancelledRequest := rejectedRequest
	cancelledRequest.ID = 0
	cancelledRequest.Title = "Cancelled Formal Request"
	cancelledRequest.Status = "new"
	cancelledRequest.ApprovalStatus = "pending_manager"
	cancelledRequest.ManagerReviewedBy = nil
	cancelledRequest.ManagerReviewedAt = nil
	cancelledRequest.ManagerReviewNote = ""
	if err := repo.CreateTicket(scopedCtx, &cancelledRequest); err != nil {
		t.Fatal(err)
	}
	cancelNote := "Requester cancelled"
	if err := repo.UpdateTicketStatus(scopedCtx, cancelledRequest.ID, "new", "cancelled", childUserID, &cancelNote); err != nil {
		t.Fatal(err)
	}
	if err := repo.UpdateDepartmentManagerReview(scopedCtx, cancelledRequest.ID, departmentManagerID, "approved", "Too late"); err == nil {
		t.Fatal("cancelled request continued through approval workflow")
	}
}
