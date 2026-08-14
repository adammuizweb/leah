package main

import (
	"log"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/adammuiz/leah/internal/config"
	"github.com/adammuiz/leah/internal/database"
	"github.com/adammuiz/leah/internal/handlers"
	leahmw "github.com/adammuiz/leah/internal/middleware"
	"github.com/adammuiz/leah/internal/repository"
	"github.com/adammuiz/leah/internal/services"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
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

	auth := leahmw.Auth(cfg.JWTSecret, repo.LoadAuthorizationState)

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health)

		// Public
		r.Post("/auth/login", h.Login)

		// Uploads (public)
		r.HandleFunc("/uploads/*", func(w http.ResponseWriter, r *http.Request) {
			http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))).ServeHTTP(w, r)
		})

		// Protected
		r.Group(func(r chi.Router) {
			r.Use(auth)

			r.Get("/auth/me", h.Me)
			r.Put("/auth/password", h.ChangeMyPassword)
			r.Put("/auth/profile", h.UpdateProfile)
			r.Post("/auth/avatar", h.UploadAvatar)
			r.Get("/auth/organizations", h.MyOrganizations)

			r.Route("/tickets", func(r chi.Router) {
				r.With(leahmw.RequirePermission("tickets.read")).Get("/", h.ListTickets)
				r.With(leahmw.RequirePermission("tickets.read.own")).Get("/mine", h.ListMyTickets)
				r.With(leahmw.RequirePermission("tickets.create")).Post("/", h.CreateTicket)
				r.With(leahmw.RequireAnyPermission("tickets.read", "tickets.read.own")).Get("/{id}", h.GetTicket)
				r.With(leahmw.RequirePermission("tickets.update")).Put("/{id}", h.UpdateTicket)
				r.With(leahmw.RequirePermission("tickets.update")).Put("/{id}/status", h.UpdateTicketStatus)
				r.With(leahmw.RequirePermission("requests.approve")).Put("/{id}/approval", h.UpdateRequestApproval)
				r.With(leahmw.RequirePermission("tickets.delete")).Delete("/{id}", h.DeleteTicket)
				r.With(leahmw.RequireAnyPermission("tickets.read", "tickets.read.own")).Get("/{id}/history", h.GetTicketHistory)
				r.With(leahmw.RequireAnyPermission("tickets.read", "tickets.read.own")).Get("/{id}/comments", h.ListTicketComments)
				r.With(leahmw.RequirePermission("tickets.comment")).Post("/{id}/comments", h.CreateTicketComment)
				r.With(leahmw.RequirePermission("tickets.delete")).Delete("/{id}/comments/{cid}", h.DeleteTicketComment)
			})

			r.Route("/assets", func(r chi.Router) {
				r.With(leahmw.RequirePermission("assets.read")).Get("/", h.ListAssets)
				r.With(leahmw.RequirePermission("assets.read.own")).Get("/mine", h.ListMyAssets)
				r.With(leahmw.RequirePermission("assets.create")).Post("/", h.CreateAsset)
				r.With(leahmw.RequirePermission("assets.create")).Post("/bulk", h.BulkCreateAssets)
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
				r.With(leahmw.RequireRoot).Post("/{id}/unlock", h.UnlockUser)
				r.With(leahmw.RequirePermission("users.delete")).Delete("/{id}", h.SoftDeleteUser)
			})

			r.Route("/security", func(r chi.Router) {
				r.With(leahmw.RequireRoot).Get("/login", h.GetLoginSecuritySettings)
				r.With(leahmw.RequireRoot).Put("/login", h.UpdateLoginSecuritySettings)
				r.With(leahmw.RequireRoot).Get("/login-attempts", h.ListLoginAttempts)
				r.With(leahmw.RequireRoot).Delete("/login-attempts", h.ClearLoginAttempts)
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

			// Holdings & Organizations
			r.Route("/holdings", func(r chi.Router) {
				r.Get("/", h.ListHoldings)
				r.With(leahmw.RequirePermission("settings.update")).Post("/", h.CreateHolding)
			})
			r.Route("/organizations", func(r chi.Router) {
				r.Get("/", h.ListOrganizations)
				r.With(leahmw.RequirePermission("settings.update")).Post("/", h.CreateOrganization)
			})

			// Asset Types & Categories
			r.Route("/asset-types", func(r chi.Router) {
				r.With(leahmw.RequirePermission("types.read")).Get("/", h.ListAssetTypes)
				r.With(leahmw.RequirePermission("types.create")).Post("/", h.CreateAssetType)
				r.With(leahmw.RequirePermission("types.update")).Put("/{id}", h.UpdateAssetType)
				r.With(leahmw.RequirePermission("types.delete")).Delete("/{id}", h.DeleteAssetType)
			})
			r.Route("/asset-categories", func(r chi.Router) {
				r.With(leahmw.RequirePermission("categories.read")).Get("/", h.ListAssetCategories)
				r.With(leahmw.RequirePermission("categories.create")).Post("/", h.CreateAssetCategory)
				r.With(leahmw.RequirePermission("categories.update")).Put("/{id}", h.UpdateAssetCategory)
				r.With(leahmw.RequirePermission("categories.delete")).Delete("/{id}", h.DeleteAssetCategory)
			})

			// Ticket Types
			r.Route("/ticket-types", func(r chi.Router) {
				r.With(leahmw.RequirePermission("ticket_types.read")).Get("/", h.ListTicketTypes)
				r.With(leahmw.RequirePermission("ticket_types.create")).Post("/", h.CreateTicketType)
				r.With(leahmw.RequirePermission("ticket_types.update")).Put("/{id}", h.UpdateTicketType)
				r.With(leahmw.RequirePermission("ticket_types.delete")).Delete("/{id}", h.DeleteTicketType)
			})

			// SLA Policies
			r.Route("/sla-policies", func(r chi.Router) {
				r.With(leahmw.RequirePermission("sla_policies.read")).Get("/", h.ListSLAPolicies)
				r.With(leahmw.RequirePermission("sla_policies.create")).Post("/", h.CreateSLAPolicy)
				r.With(leahmw.RequirePermission("sla_policies.update")).Put("/{id}", h.UpdateSLAPolicy)
				r.With(leahmw.RequirePermission("sla_policies.delete")).Delete("/{id}", h.DeleteSLAPolicy)
			})

			// Asset Models
			r.Route("/asset-models", func(r chi.Router) {
				r.With(leahmw.RequirePermission("models.read")).Get("/", h.ListAssetModels)
				r.With(leahmw.RequirePermission("models.create")).Post("/", h.CreateAssetModel)
				r.With(leahmw.RequirePermission("models.update")).Put("/{id}", h.UpdateAssetModel)
				r.With(leahmw.RequirePermission("models.delete")).Delete("/{id}", h.DeleteAssetModel)
			})

			// Admin: Bin
			r.Route("/bin", func(r chi.Router) {
				r.With(leahmw.RequireRoot).Get("/", h.ListBin)
				r.With(leahmw.RequireRoot).Post("/{type}/{id}/restore", h.RestoreItem)
				r.With(leahmw.RequireRoot).Delete("/{type}/{id}", h.PermanentlyDelete)
			})
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	host := os.Getenv("HOST")
	if host == "" {
		host = "127.0.0.1"
	}
	address := net.JoinHostPort(host, port)
	log.Printf("LEAH API running on %s", address)
	server := &http.Server{
		Addr:              address,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
