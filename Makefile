# Doc Reader — convenience commands

.PHONY: help install start dev test lint migrate scan shots clean

help: ## Show this help
	@echo "Doc Reader — available commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	npm install

setup: install migrate ## Install + migrate (first-time setup)
	@echo "✅ Setup complete. Run 'make start' to launch."

start: ## Start the server (foreground)
	npm run start

dev: ## Start with auto-reload
	npm run dev

test: ## Run unit + integration tests
	npm test

test-unit: ## Run unit tests only
	npm run test:unit

test-integration: ## Run integration tests only
	npm run test:integration

coverage: ## Run tests with coverage
	npm run test:coverage

migrate: ## Run database migrations
	npm run migrate

scan: ## CLI scan (alternative to UI Rescan button)
	npm run scan

shots: ## Capture 20 Playwright screenshots
	npm run shots

verify-responsive: ## Run 7-viewport responsive audit
	node scripts/verify-responsive.mjs

check: test verify-responsive ## Run all checks
	@echo "✅ All checks passed."

clean: ## Remove node_modules and data (DANGEROUS)
	rm -rf node_modules data/*.db data/*.db-journal data/*.db-wal data/*.db-shm
	@echo "🧹 Cleaned. Run 'make install' to reinstall."

backup: ## Backup the SQLite database
	@mkdir -p backups
	@cp data/doc-reader.db backups/doc-reader-$$(date +%Y%m%d-%H%M%S).db
	@echo "💾 Backup saved to backups/"
