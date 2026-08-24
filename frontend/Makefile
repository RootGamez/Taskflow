SHELL := /bin/sh

COMPOSE := docker compose -f docker-compose.prod.yml
SERVICE := frontend

.PHONY: help up build rebuild deploy down restart ps logs shell clean

help:
	@echo "Comandos disponibles:"
	@echo "  make up        # Levanta el frontend de produccion"
	@echo "  make build     # Construye la imagen de produccion"
	@echo "  make rebuild   # Recompila y recrea el contenedor"
	@echo "  make deploy    # Alias de rebuild para actualizar produccion"
	@echo "  make down      # Apaga el servicio"
	@echo "  make restart   # Reinicia el servicio"
	@echo "  make ps        # Lista el estado del servicio"
	@echo "  make logs      # Logs del frontend"
	@echo "  make shell     # Shell dentro del contenedor"
	@echo "  make clean     # Baja el servicio y elimina orphans"

up:
	$(COMPOSE) up -d

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) up -d --build --remove-orphans

deploy: rebuild

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart $(SERVICE)

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=200 $(SERVICE)

shell:
	$(COMPOSE) exec $(SERVICE) sh

clean:
	$(COMPOSE) down --remove-orphans