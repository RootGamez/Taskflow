SHELL := /bin/sh

COMPOSE := docker compose
BACKEND := backend
WORKER := celery_worker

.PHONY: help up up-build down down-v restart ps logs logs-backend logs-worker \
	bash shell migrate makemigrations makemigrations-app createsuperuser \
	collectstatic check test pytest show-users

help:
	@echo "Comandos disponibles:"
	@echo "  make up                # Levanta servicios en segundo plano"
	@echo "  make up-build          # Rebuild y levanta servicios"
	@echo "  make down              # Apaga servicios"
	@echo "  make down-v            # Apaga y elimina volumenes"
	@echo "  make restart           # Reinicia backend"
	@echo "  make ps                # Lista contenedores"
	@echo "  make logs              # Logs de todos los servicios"
	@echo "  make logs-backend      # Logs del backend"
	@echo "  make logs-worker       # Logs de celery worker"
	@echo "  make bash              # Bash dentro del contenedor backend"
	@echo "  make shell             # Django shell dentro del backend"
	@echo "  make migrate           # Ejecuta migraciones"
	@echo "  make makemigrations    # Genera migraciones"
	@echo "  make makemigrations-app APP=users   # Migrar una app especifica"
	@echo "  make createsuperuser   # Crea superusuario"
	@echo "  make collectstatic     # Recolecta estaticos"
	@echo "  make check             # django check"
	@echo "  make test              # manage.py test"
	@echo "  make pytest            # pytest"
	@echo "  make show-users        # Lista usuarios y flags admin"

up:
	$(COMPOSE) up -d

up-build:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

down-v:
	$(COMPOSE) down -v

restart:
	$(COMPOSE) restart $(BACKEND)

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=200

logs-backend:
	$(COMPOSE) logs -f --tail=200 $(BACKEND)

logs-worker:
	$(COMPOSE) logs -f --tail=200 $(WORKER)

bash:
	$(COMPOSE) exec $(BACKEND) bash

shell:
	$(COMPOSE) exec $(BACKEND) python manage.py shell

migrate:
	$(COMPOSE) exec $(BACKEND) python manage.py migrate

makemigrations:
	$(COMPOSE) exec $(BACKEND) python manage.py makemigrations

makemigrations-app:
	@if [ -z "$(APP)" ]; then echo "Uso: make makemigrations-app APP=nombre_app"; exit 1; fi
	$(COMPOSE) exec $(BACKEND) python manage.py makemigrations $(APP)

createsuperuser:
	$(COMPOSE) exec $(BACKEND) python manage.py createsuperuser

collectstatic:
	$(COMPOSE) exec $(BACKEND) python manage.py collectstatic --noinput

check:
	$(COMPOSE) exec $(BACKEND) python manage.py check

test:
	$(COMPOSE) exec $(BACKEND) python manage.py test

pytest:
	$(COMPOSE) exec $(BACKEND) pytest

show-users:
	$(COMPOSE) exec $(BACKEND) python manage.py shell -c "from django.contrib.auth import get_user_model;U=get_user_model();print([(u.email,u.is_staff,u.is_superuser,u.is_active) for u in U.objects.all()])"
