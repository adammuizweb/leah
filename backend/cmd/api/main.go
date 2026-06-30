package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/adammuiz/leah/internal/config"
	"github.com/adammuiz/leah/internal/database"
	"github.com/adammuiz/leah/internal/handlers"
	leahmw "github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/repository"
	"github.com/adammuiz/leah/internal/services"
)

func main() {
	godotenv.Load()

	cfg := config.Load()
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	repo := repository.New(db)
	svc := services.New(repo)
	h := handlers.New(svc, cfg.JWTSecret)

	r := chi.NewRouter()
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	origins := os.Getenv("CORS_ORIGINS")
	if origins == "" {
		origins = "http://localhost:5173"
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{origins},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	auth := leahmw.Auth(cfg.JWTSecret)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health)

		// Public
		r.Post("/auth/login", h.Login)

		// Protected
		r.Group(func(r chi.Router) {
			r.Use(auth)

			r.Get("/auth/me", h.Me)
			r.Put("/auth/password", h.ChangeMyPassword)

			r.Route("/tickets", func(r chi.Router) {
				r.With(leahmw.RequirePermission("tickets.read")).Get("/", h.ListTickets)
				r.With(leahmw.RequirePermission("tickets.create")).Post("/", h.CreateTicket)
				r.With(leahmw.RequirePermission("tickets.read")).Get("/{id}", h.GetTicket)
				r.With(leahmw.RequirePermission("tickets.update")).Put("/{id}", h.UpdateTicket)
				r.With(leahmw.RequirePermission("tickets.delete")).Delete("/{id}", h.DeleteTicket)
			})

			r.Route("/assets", func(r chi.Router) {
				r.With(leahmw.RequirePermission("assets.read")).Get("/", h.ListAssets)
				r.With(leahmw.RequirePermission("assets.create")).Post("/", h.CreateAsset)
				r.With(leahmw.RequirePermission("assets.read")).Get("/{id}", h.GetAsset)
				r.With(leahmw.RequirePermission("assets.update")).Put("/{id}", h.UpdateAsset)
				r.With(leahmw.RequirePermission("assets.delete")).Delete("/{id}", h.DeleteAsset)
			})

			// Admin: Users
			r.Route("/users", func(r chi.Router) {
				r.With(leahmw.RequirePermission("users.read")).Get("/", h.ListUsers)
				r.With(leahmw.RequirePermission("users.create")).Post("/", h.CreateUser)
				r.With(leahmw.RequirePermission("users.read")).Get("/{id}", h.GetUser)
				r.With(leahmw.RequirePermission("users.update")).Put("/{id}", h.UpdateUser)
				r.With(leahmw.RequirePermission("users.update")).Put("/{id}/password", h.UpdateUserPassword)
				r.With(leahmw.RequirePermission("users.delete")).Delete("/{id}", h.SoftDeleteUser)
			})

			// Admin: Roles & Permissions
			r.Route("/roles", func(r chi.Router) {
				r.With(leahmw.RequirePermission("settings.read")).Get("/", h.ListRoles)
				r.With(leahmw.RequirePermission("settings.update")).Post("/", h.CreateRole)
				r.With(leahmw.RequirePermission("settings.update")).Put("/{id}", h.UpdateRole)
				r.With(leahmw.RequirePermission("settings.update")).Delete("/{id}", h.DeleteRole)
				r.With(leahmw.RequirePermission("settings.read")).Get("/{id}/permissions", h.GetRolePermissions)
				r.With(leahmw.RequirePermission("settings.update")).Put("/{id}/permissions", h.SetRolePermissions)
			})

			r.With(leahmw.RequirePermission("settings.read")).Get("/permissions", h.ListAllPermissions)

			// Asset Types & Categories
			r.Route("/asset-types", func(r chi.Router) {
				r.With(leahmw.RequirePermission("settings.read")).Get("/", h.ListAssetTypes)
				r.With(leahmw.RequirePermission("settings.update")).Post("/", h.CreateAssetType)
				r.With(leahmw.RequirePermission("settings.update")).Delete("/{id}", h.DeleteAssetType)
			})
			r.Route("/asset-categories", func(r chi.Router) {
				r.With(leahmw.RequirePermission("settings.read")).Get("/", h.ListAssetCategories)
				r.With(leahmw.RequirePermission("settings.update")).Post("/", h.CreateAssetCategory)
				r.With(leahmw.RequirePermission("settings.update")).Put("/{id}", h.UpdateAssetCategory)
				r.With(leahmw.RequirePermission("settings.update")).Delete("/{id}", h.DeleteAssetCategory)
			})

			// Admin: Bin
			r.Route("/bin", func(r chi.Router) {
				r.With(leahmw.RequirePermission("settings.read")).Get("/", h.ListBin)
				r.With(leahmw.RequirePermission("settings.update")).Post("/{type}/{id}/restore", h.RestoreItem)
				r.With(leahmw.RequirePermission("settings.update")).Delete("/{type}/{id}", h.PermanentlyDelete)
			})
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("LEAH API running on :%s", port)
	http.ListenAndServe(":"+port, r)
}
