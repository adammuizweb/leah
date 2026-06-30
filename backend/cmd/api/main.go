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

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", h.Health)

		// Auth — public
		r.Post("/auth/login", h.Login)

		// Auth — protected
		r.Group(func(r chi.Router) {
			r.Use(leahmw.Auth(cfg.JWTSecret))

			r.Get("/auth/me", h.Me)

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
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("LEAH API running on :%s", port)
	http.ListenAndServe(":"+port, r)
}
