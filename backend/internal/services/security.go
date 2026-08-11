package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/adammuiz/leah/internal/models"
	"github.com/adammuiz/leah/internal/repository"
)

var ErrLoginLockBusy = errors.New("login lock is busy")

func (s *Service) GetLoginSecuritySettings(ctx context.Context) (*models.LoginSecuritySettings, error) {
	return s.repo.GetLoginSecuritySettings(ctx)
}

func (s *Service) AcquireLoginLock(ctx context.Context, ip, email string) (context.Context, func() error, error) {
	lockedCtx, release, err := s.repo.AcquireLoginLock(ctx, ip, email)
	if errors.Is(err, repository.ErrLoginLockBusy) {
		return nil, nil, ErrLoginLockBusy
	}
	return lockedCtx, release, err
}

func (s *Service) UpdateLoginSecuritySettings(ctx context.Context, settings *models.LoginSecuritySettings, actorID int64) error {
	if settings.AttemptWindowMinutes < 1 || settings.AttemptWindowMinutes > 1440 {
		return fmt.Errorf("attempt window must be between 1 and 1440 minutes")
	}
	if settings.IPAttemptLimit < 1 || settings.IPAttemptLimit > 100 {
		return fmt.Errorf("IP attempt limit must be between 1 and 100")
	}
	if settings.AccountAttemptLimit < 2 || settings.AccountAttemptLimit > 100 {
		return fmt.Errorf("account attempt limit must be between 2 and 100")
	}
	if settings.AccountAttemptLimit < settings.IPAttemptLimit {
		return fmt.Errorf("account attempt limit must be greater than or equal to IP attempt limit")
	}
	if settings.AccountLockMinutes < 1 || settings.AccountLockMinutes > 43200 {
		return fmt.Errorf("account lock duration must be between 1 and 43200 minutes")
	}
	return s.repo.UpdateLoginSecuritySettings(ctx, settings, actorID)
}

func (s *Service) CountIPLoginFailures(ctx context.Context, ip string, since time.Time) (int, time.Time, error) {
	return s.repo.CountIPLoginFailures(ctx, ip, since)
}

func (s *Service) CountEmailLoginFailures(ctx context.Context, email string, since time.Time) (int, error) {
	return s.repo.CountEmailLoginFailures(ctx, email, since)
}

func (s *Service) RecordLoginFailure(ctx context.Context, ip string, email *string) error {
	return s.repo.RecordLoginFailure(ctx, ip, email)
}

func (s *Service) ResolveLoginFailures(ctx context.Context, email string) error {
	return s.repo.ResolveLoginFailures(ctx, email)
}

func (s *Service) LockUser(ctx context.Context, id int64, until time.Time) error {
	return s.repo.LockUser(ctx, id, until)
}

func (s *Service) UnlockUser(ctx context.Context, id int64) error {
	return s.repo.UnlockUser(ctx, id)
}

func (s *Service) ListLoginAttempts(ctx context.Context, since time.Time) ([]models.LoginAttemptSummary, error) {
	return s.repo.ListLoginAttempts(ctx, since)
}

func (s *Service) ClearLoginAttempts(ctx context.Context) error {
	return s.repo.ClearLoginAttempts(ctx)
}
