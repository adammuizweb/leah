package repository

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/adammuiz/leah/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type loginTxKey struct{}

var ErrLoginLockBusy = errors.New("login lock is busy")

type dbExecutor interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (r *Repository) executor(ctx context.Context) dbExecutor {
	if tx, ok := ctx.Value(loginTxKey{}).(pgx.Tx); ok {
		return tx
	}
	return r.db
}

func (r *Repository) GetLoginSecuritySettings(ctx context.Context) (*models.LoginSecuritySettings, error) {
	s := &models.LoginSecuritySettings{}
	err := r.db.QueryRow(ctx, `
		SELECT enabled, attempt_window_minutes, ip_attempt_limit,
		       account_attempt_limit, account_lock_minutes, updated_by, updated_at
		FROM login_security_settings WHERE id = 1
	`).Scan(
		&s.Enabled, &s.AttemptWindowMinutes, &s.IPAttemptLimit,
		&s.AccountAttemptLimit, &s.AccountLockMinutes, &s.UpdatedBy, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *Repository) AcquireLoginLock(ctx context.Context, ip, email string) (context.Context, func() error, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, err
	}

	var first, second int64
	if err := tx.QueryRow(ctx, `
		SELECT LEAST(hashtextextended('ip:' || $1, 0), hashtextextended('email:' || $2, 0)),
		       GREATEST(hashtextextended('ip:' || $1, 0), hashtextextended('email:' || $2, 0))
	`, ip, email).Scan(&first, &second); err != nil {
		_ = tx.Rollback(context.Background())
		return nil, nil, err
	}
	var acquired bool
	if err := tx.QueryRow(ctx, `SELECT pg_try_advisory_xact_lock($1)`, first).Scan(&acquired); err != nil {
		_ = tx.Rollback(context.Background())
		return nil, nil, err
	}
	if !acquired {
		_ = tx.Rollback(context.Background())
		return nil, nil, ErrLoginLockBusy
	}
	if second != first {
		if err := tx.QueryRow(ctx, `SELECT pg_try_advisory_xact_lock($1)`, second).Scan(&acquired); err != nil {
			_ = tx.Rollback(context.Background())
			return nil, nil, err
		}
		if !acquired {
			_ = tx.Rollback(context.Background())
			return nil, nil, ErrLoginLockBusy
		}
	}

	lockedCtx := context.WithValue(ctx, loginTxKey{}, tx)
	var once sync.Once
	var commitErr error
	return lockedCtx, func() error {
		once.Do(func() {
			commitCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			commitErr = tx.Commit(commitCtx)
		})
		return commitErr
	}, nil
}

func (r *Repository) UpdateLoginSecuritySettings(ctx context.Context, s *models.LoginSecuritySettings, actorID int64) error {
	return r.db.QueryRow(ctx, `
		UPDATE login_security_settings
		SET enabled=$1, attempt_window_minutes=$2, ip_attempt_limit=$3,
		    account_attempt_limit=$4, account_lock_minutes=$5,
		    updated_by=$6, updated_at=NOW()
		WHERE id=1
		RETURNING updated_by, updated_at
	`, s.Enabled, s.AttemptWindowMinutes, s.IPAttemptLimit, s.AccountAttemptLimit, s.AccountLockMinutes, actorID).
		Scan(&s.UpdatedBy, &s.UpdatedAt)
}

func (r *Repository) CountIPLoginFailures(ctx context.Context, ip string, since time.Time) (int, time.Time, error) {
	var count int
	var first time.Time
	err := r.executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(MIN(attempted_at), NOW())
		FROM login_attempts
		WHERE ip_address=$1::inet AND attempted_at >= $2
	`, ip, since).Scan(&count, &first)
	return count, first, err
}

func (r *Repository) CountEmailLoginFailures(ctx context.Context, email string, since time.Time) (int, error) {
	var count int
	err := r.executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM login_attempts
		WHERE email=$1 AND attempted_at >= $2 AND resolved_at IS NULL
	`, email, since).Scan(&count)
	return count, err
}

func (r *Repository) RecordLoginFailure(ctx context.Context, ip string, email *string) error {
	_, err := r.executor(ctx).Exec(ctx, `
		WITH expired AS (
			DELETE FROM login_attempts
			WHERE attempted_at < NOW() - INTERVAL '30 days'
		)
		INSERT INTO login_attempts (ip_address, email) VALUES ($1::inet, $2)
	`, ip, email)
	return err
}

func (r *Repository) ResolveLoginFailures(ctx context.Context, email string) error {
	_, err := r.executor(ctx).Exec(ctx, `
		UPDATE login_attempts SET resolved_at=NOW()
		WHERE email=$1 AND resolved_at IS NULL
	`, email)
	return err
}

func (r *Repository) LockUser(ctx context.Context, id int64, until time.Time) error {
	_, err := r.executor(ctx).Exec(ctx, `UPDATE users SET locked_until=$1 WHERE id=$2 AND deleted_at IS NULL AND is_root=FALSE`, until, id)
	return err
}

func (r *Repository) UnlockUser(ctx context.Context, id int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var email string
	err = tx.QueryRow(ctx, `
		UPDATE users SET locked_until=NULL
		WHERE id=$1 AND deleted_at IS NULL
		RETURNING email
	`, id).Scan(&email)
	if err != nil {
		return fmt.Errorf("user not found")
	}
	if _, err = tx.Exec(ctx, `
		UPDATE login_attempts SET resolved_at=NOW()
		WHERE email=$1 AND resolved_at IS NULL
	`, email); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListLoginAttempts(ctx context.Context, since time.Time) ([]models.LoginAttemptSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT ip_address::text, email, COUNT(*),
		       COUNT(*) FILTER (WHERE resolved_at IS NULL), MAX(attempted_at)
		FROM login_attempts
		WHERE attempted_at >= $1
		GROUP BY ip_address, email
		ORDER BY MAX(attempted_at) DESC
	`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.LoginAttemptSummary, 0)
	for rows.Next() {
		var item models.LoginAttemptSummary
		if err := rows.Scan(&item.IPAddress, &item.Email, &item.AttemptCount, &item.ActiveCount, &item.LastAttempt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (r *Repository) ClearLoginAttempts(ctx context.Context) error {
	_, err := r.db.Exec(ctx, `DELETE FROM login_attempts`)
	return err
}
