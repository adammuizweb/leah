package repository

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func testSecurityRepository(t *testing.T) (*Repository, *pgxpool.Pool) {
	t.Helper()
	url := os.Getenv("LEAH_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("LEAH_TEST_DATABASE_URL is not set")
	}
	pool, err := pgxpool.New(context.Background(), url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return New(pool), pool
}

func TestLoginSecurityRepository(t *testing.T) {
	repo, pool := testSecurityRepository(t)
	ctx := context.Background()
	if err := repo.ClearLoginAttempts(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.ClearLoginAttempts(ctx) })

	firstCtx, firstUnlock, err := repo.AcquireLoginLock(ctx, "192.0.2.60", "lock-test@example.test")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = firstUnlock() })
	if _, _, err := repo.CountIPLoginFailures(firstCtx, "192.0.2.60", time.Now().Add(-time.Minute)); err != nil {
		t.Fatal(err)
	}
	if _, err := repo.GetUserByEmail(firstCtx, "superuser@leah.lan"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := repo.AcquireLoginLock(context.Background(), "192.0.2.60", "lock-test@example.test"); !errors.Is(err, ErrLoginLockBusy) {
		t.Fatalf("second advisory lock error = %v, want ErrLoginLockBusy", err)
	}
	if err := firstUnlock(); err != nil {
		t.Fatal(err)
	}
	_, secondUnlock, err := repo.AcquireLoginLock(context.Background(), "192.0.2.60", "lock-test@example.test")
	if err != nil {
		t.Fatal(err)
	}
	if err := secondUnlock(); err != nil {
		t.Fatal(err)
	}

	settings, err := repo.GetLoginSecuritySettings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	original := *settings

	var actorID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM users ORDER BY id LIMIT 1`).Scan(&actorID); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = repo.UpdateLoginSecuritySettings(ctx, &original, actorID) })

	settings.IPAttemptLimit = 3
	if err := repo.UpdateLoginSecuritySettings(ctx, settings, actorID); err != nil {
		t.Fatal(err)
	}
	got, err := repo.GetLoginSecuritySettings(ctx)
	if err != nil || got.IPAttemptLimit != 3 {
		t.Fatalf("updated settings = %#v, err = %v", got, err)
	}

	email := "repository-test@example.test"
	for i := 0; i < 3; i++ {
		if err := repo.RecordLoginFailure(ctx, "192.0.2.50", &email); err != nil {
			t.Fatal(err)
		}
	}
	since := time.Now().Add(-time.Minute)
	ipCount, _, err := repo.CountIPLoginFailures(ctx, "192.0.2.50", since)
	if err != nil || ipCount != 3 {
		t.Fatalf("IP count = %d, err = %v", ipCount, err)
	}
	emailCount, err := repo.CountEmailLoginFailures(ctx, email, since)
	if err != nil || emailCount != 3 {
		t.Fatalf("email count = %d, err = %v", emailCount, err)
	}
	if err := repo.ResolveLoginFailures(ctx, email); err != nil {
		t.Fatal(err)
	}
	ipCount, _, err = repo.CountIPLoginFailures(ctx, "192.0.2.50", since)
	if err != nil || ipCount != 3 {
		t.Fatalf("IP count after account resolution = %d, err = %v", ipCount, err)
	}
	emailCount, err = repo.CountEmailLoginFailures(ctx, email, since)
	if err != nil || emailCount != 0 {
		t.Fatalf("resolved email count = %d, err = %v", emailCount, err)
	}

	items, err := repo.ListLoginAttempts(ctx, since)
	if err != nil || len(items) == 0 {
		t.Fatalf("login attempt history = %#v, err = %v", items, err)
	}
	if err := repo.ClearLoginAttempts(ctx); err != nil {
		t.Fatal(err)
	}
	items, err = repo.ListLoginAttempts(ctx, since)
	if err != nil || len(items) != 0 {
		t.Fatalf("cleared login attempt history = %#v, err = %v", items, err)
	}

	var userID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM users WHERE is_root=FALSE AND deleted_at IS NULL ORDER BY id LIMIT 1`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	lockedUntil := time.Now().Add(time.Hour)
	if err := repo.LockUser(ctx, userID, lockedUntil); err != nil {
		t.Fatal(err)
	}
	if err := repo.UnlockUser(ctx, userID); err != nil {
		t.Fatal(err)
	}
	var unlocked bool
	if err := pool.QueryRow(ctx, `SELECT locked_until IS NULL FROM users WHERE id=$1`, userID).Scan(&unlocked); err != nil || !unlocked {
		t.Fatalf("user unlocked = %v, err = %v", unlocked, err)
	}

	var rootID int64
	if err := pool.QueryRow(ctx, `SELECT id FROM users WHERE is_root=TRUE`).Scan(&rootID); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET deleted_at=NOW() WHERE id=$1`, rootID); err == nil {
		t.Fatal("runtime role soft-deleted the root account")
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET locked_until=NOW() + INTERVAL '1 hour' WHERE id=$1`, rootID); err == nil {
		t.Fatal("runtime role locked the root account")
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET name='Renamed Root' WHERE id=$1`, rootID); err == nil {
		t.Fatal("runtime role renamed the root account")
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET is_root=TRUE WHERE id=$1`, userID); err == nil {
		t.Fatal("runtime role promoted another account to Root")
	}
	if err := repo.PermanentlyDelete(ctx, "user", rootID); err == nil {
		t.Fatal("PermanentlyDelete removed the root account")
	}
}
