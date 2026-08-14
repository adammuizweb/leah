package services

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/adammuiz/leah/internal/models"
)

func TestValidateRequest(t *testing.T) {
	tests := []struct {
		name    string
		ticket  models.Ticket
		wantErr string
	}{
		{name: "support", ticket: models.Ticket{Title: "Printer is offline", RequestKind: "support"}},
		{
			name: "software",
			ticket: models.Ticket{
				Title:             "Leave management",
				RequestKind:       "software",
				SoftwareName:      "Leave Hub",
				BusinessObjective: "Replace the manual approval spreadsheet",
				TargetUsers:       "All employees",
			},
		},
		{
			name: "technology review",
			ticket: models.Ticket{
				Title:             "Review vendor server",
				RequestKind:       "technology_review",
				TechnologyName:    "Dell R760",
				BusinessObjective: "Run research workloads",
				Specification:     "Dual CPU, 256 GB RAM",
			},
		},
		{name: "missing title", ticket: models.Ticket{RequestKind: "support"}, wantErr: "title is required"},
		{name: "invalid kind", ticket: models.Ticket{Title: "Unknown", RequestKind: "project"}, wantErr: "invalid request kind"},
		{name: "software name required", ticket: models.Ticket{Title: "New software", RequestKind: "software", BusinessObjective: "Automate work"}, wantErr: "software name is required"},
		{name: "objective required", ticket: models.Ticket{Title: "New software", RequestKind: "software", SoftwareName: "Work Hub"}, wantErr: "business objective is required"},
		{name: "technology name required", ticket: models.Ticket{Title: "Review server", RequestKind: "technology_review", BusinessObjective: "Research", Specification: "Server specification"}, wantErr: "technology or vendor name is required"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := validateRequest(&test.ticket)
			if test.wantErr == "" && err != nil {
				t.Fatalf("validateRequest() error = %v", err)
			}
			if test.wantErr != "" && (err == nil || !strings.Contains(err.Error(), test.wantErr)) {
				t.Fatalf("validateRequest() error = %v, want %q", err, test.wantErr)
			}
		})
	}
}

func TestValidateRequestTrimsSoftwareFields(t *testing.T) {
	ticket := models.Ticket{
		Title:             "  Internal portal  ",
		RequestKind:       "software",
		SoftwareName:      "  Portal  ",
		BusinessObjective: "  Centralize employee services  ",
		TargetUsers:       "  All employees  ",
	}
	if err := validateRequest(&ticket); err != nil {
		t.Fatal(err)
	}
	if ticket.Title != "Internal portal" || ticket.SoftwareName != "Portal" || ticket.TargetUsers != "All employees" {
		t.Fatalf("request fields were not normalized: %#v", ticket)
	}
}

func TestSoftwareRequestRequiresApprovalBeforeWork(t *testing.T) {
	ticket := &models.Ticket{RequestKind: "software", ApprovalStatus: "pending_manager"}
	if err := validateRequestStatusChange(ticket, "open"); err == nil {
		t.Fatal("pending software request advanced without approval")
	}
	if err := validateRequestStatusChange(ticket, "cancelled"); err != nil {
		t.Fatalf("pending software request could not be cancelled: %v", err)
	}
	ticket.ApprovalStatus = "approved"
	if err := validateRequestStatusChange(ticket, "open"); err != nil {
		t.Fatalf("approved software request could not advance: %v", err)
	}
}

func TestPrepareNewSoftwareRequestOverridesClientState(t *testing.T) {
	ticket := &models.Ticket{
		Title:             "Workflow request",
		Status:            "closed",
		Priority:          "high",
		RequestKind:       "software",
		ApprovalStatus:    "approved",
		SoftwareName:      "Workflow Hub",
		BusinessObjective: "Track controlled delivery",
		TargetUsers:       "Operations",
	}
	if err := prepareNewRequest(ticket); err != nil {
		t.Fatal(err)
	}
	if ticket.Status != "new" || ticket.ApprovalStatus != "pending_manager" {
		t.Fatalf("new software request state = %s/%s", ticket.Status, ticket.ApprovalStatus)
	}
}

func TestRejectedRequestRequiresNote(t *testing.T) {
	service := &Service{}
	if _, err := service.UpdateDepartmentManagerReview(context.Background(), 1, 1, "rejected", "   "); !errors.Is(err, ErrInvalidRequest) {
		t.Fatalf("UpdateDepartmentManagerReview() error = %v, want ErrInvalidRequest", err)
	}
}
