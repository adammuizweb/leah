package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/adammuiz/leah/internal/config"
	"github.com/adammuiz/leah/internal/database"
	"github.com/adammuiz/leah/internal/handlers"
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
	h := handlers.New(svc)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
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

		r.Route("/tickets", func(r chi.Router) {
			r.Get("/", h.ListTickets)
			r.Post("/", h.CreateTicket)
			r.Get("/{id}", h.GetTicket)
			r.Put("/{id}", h.UpdateTicket)
			r.Delete("/{id}", h.DeleteTicket)
		})

		r.Route("/assets", func(r chi.Router) {
			r.Get("/", h.ListAssets)
			r.Post("/", h.CreateAsset)
			r.Get("/{id}", h.GetAsset)
			r.Put("/{id}", h.UpdateAsset)
			r.Delete("/{id}", h.DeleteAsset)
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("LEAH API running on :%s", port)
	http.ListenAndServe(":"+port, r)
}
