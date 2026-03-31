# SolverForge UI Makefile
# Build system with colorized output

# ============== Colors & Symbols ==============
GREEN := \033[92m
CYAN := \033[96m
YELLOW := \033[93m
MAGENTA := \033[95m
RED := \033[91m
GRAY := \033[90m
BOLD := \033[1m
RESET := \033[0m

CHECK := ✓
CROSS := ✗
ARROW := ▸
PROGRESS := →

# ============== Project Metadata ==============
VERSION := $(shell grep -m1 '^version' Cargo.toml | sed 's/version = "\(.*\)"/\1/')
RUST_VERSION := 1.75+
SEMVER_RE := '^[0-9]+\.[0-9]+\.[0-9]+$$'

# ============== Asset Sources ==============
CSS_SRC := $(sort $(wildcard css-src/*.css))
JS_SRC  := $(sort $(wildcard js-src/*.js))
VERSIONED_CSS := static/sf/sf.$(VERSION).css
VERSIONED_JS := static/sf/sf.$(VERSION).js

# ============== Phony Targets ==============
.PHONY: banner help assets build build-release test test-quick test-doc test-unit test-frontend test-browser test-one \
        lint fmt fmt-check clippy ci-local pre-release version package-verify browser-setup \
        bump-version bump-patch bump-minor bump-major bump-dry release-tag demo-serve \
        publish-dry publish clean watch

# ============== Default Target ==============
.DEFAULT_GOAL := help

# ============== Banner ==============
banner:
	@printf "$(CYAN)$(BOLD)  SolverForge UI$(RESET)\n"
	@printf "  $(GRAY)v$(VERSION)$(RESET) $(CYAN)Component Library$(RESET)\n\n"

# ============== Asset Targets ==============

assets: static/sf/sf.css static/sf/sf.js $(VERSIONED_CSS) $(VERSIONED_JS)

static/sf/sf.css $(VERSIONED_CSS): $(CSS_SRC)
	@printf "$(PROGRESS) CSS  sf.css ($(words $(CSS_SRC)) files)\n"
	@cat $(CSS_SRC) > static/sf/sf.css
	@cp static/sf/sf.css $(VERSIONED_CSS)
	@printf "$(GREEN)$(CHECK) CSS bundled$(RESET)\n"

static/sf/sf.js $(VERSIONED_JS): $(JS_SRC)
	@printf "$(PROGRESS) JS   sf.js ($(words $(JS_SRC)) files)\n"
	@cat $(JS_SRC) > static/sf/sf.js
	@cp static/sf/sf.js $(VERSIONED_JS)
	@printf "$(GREEN)$(CHECK) JS bundled$(RESET)\n"

# ============== Build Targets ==============

build: banner assets
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║            Building Crate            ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(ARROW) $(BOLD)Building solverforge-ui...$(RESET)\n"
	@cargo build && \
		printf "$(GREEN)$(CHECK) Build successful$(RESET)\n\n" || \
		(printf "$(RED)$(CROSS) Build failed$(RESET)\n\n" && exit 1)

build-release: banner assets
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║          Release Build               ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(ARROW) $(BOLD)Building release binary...$(RESET)\n"
	@cargo build --release && \
		printf "$(GREEN)$(CHECK) Release build successful$(RESET)\n\n" || \
		(printf "$(RED)$(CROSS) Release build failed$(RESET)\n\n" && exit 1)

# ============== Test Targets ==============

test: banner
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║          Full Test Suite             ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(ARROW) $(BOLD)Running all tests...$(RESET)\n"
	@cargo test && \
		node --test tests/*.test.js && \
		node tests/demo-browser-check.js && \
		printf "\n$(GREEN)$(CHECK) All tests passed$(RESET)\n\n" || \
		(printf "\n$(RED)$(CROSS) Tests failed$(RESET)\n\n" && exit 1)

test-quick: banner
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║          Quick Test Suite            ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(PROGRESS) Running doctests...\n"
	@cargo test --doc --quiet && \
		printf "$(GREEN)$(CHECK) Doctests passed$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Doctests failed$(RESET)\n" && exit 1)
	@printf "$(PROGRESS) Running unit tests...\n"
	@cargo test --lib --quiet && \
		printf "$(GREEN)$(CHECK) Unit tests passed$(RESET)\n\n" || \
		(printf "$(RED)$(CROSS) Unit tests failed$(RESET)\n\n" && exit 1)
	@printf "$(PROGRESS) Running frontend tests...\n"
	@node --test tests/*.test.js && \
		printf "$(GREEN)$(CHECK) Frontend tests passed$(RESET)\n\n" || \
		(printf "$(RED)$(CROSS) Frontend tests failed$(RESET)\n\n" && exit 1)
	@printf "$(PROGRESS) Running browser demo smoke tests...\n"
	@node tests/demo-browser-check.js && \
		printf "$(GREEN)$(CHECK) Browser smoke tests passed$(RESET)\n\n" || \
		(printf "$(RED)$(CROSS) Browser smoke tests failed$(RESET)\n\n" && exit 1)

test-doc:
	@printf "$(PROGRESS) Running doctests...\n"
	@cargo test --doc && \
		printf "$(GREEN)$(CHECK) Doctests passed$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Doctests failed$(RESET)\n" && exit 1)

test-unit:
	@printf "$(PROGRESS) Running unit tests...\n"
	@cargo test --lib && \
		printf "$(GREEN)$(CHECK) Unit tests passed$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Unit tests failed$(RESET)\n" && exit 1)

test-frontend:
	@printf "$(PROGRESS) Running frontend tests...\n"
	@node --test tests/*.test.js && \
		printf "$(GREEN)$(CHECK) Frontend tests passed$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Frontend tests failed$(RESET)\n" && exit 1)

test-browser:
	@printf "$(PROGRESS) Running browser demo smoke tests...\n"
	@node tests/demo-browser-check.js && \
		printf "$(GREEN)$(CHECK) Browser smoke tests passed$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Browser smoke tests failed$(RESET)\n" && exit 1)

browser-setup:
	@printf "$(PROGRESS) Installing browser test dependencies...\n"
	@npm ci && npx playwright install --with-deps chromium && \
		printf "$(GREEN)$(CHECK) Browser test dependencies installed$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Browser test dependency setup failed$(RESET)\n" && exit 1)

test-one:
	@printf "$(PROGRESS) Running test: $(YELLOW)$(TEST)$(RESET)\n"
	@RUST_LOG=info cargo test $(TEST) -- --nocapture

# ============== Lint & Format ==============

lint: banner fmt-check clippy
	@printf "\n$(GREEN)$(BOLD)$(CHECK) All lint checks passed$(RESET)\n\n"

fmt:
	@printf "$(PROGRESS) Formatting code...\n"
	@cargo fmt --all
	@printf "$(GREEN)$(CHECK) Code formatted$(RESET)\n"

fmt-check:
	@printf "$(PROGRESS) Checking formatting...\n"
	@cargo fmt --all -- --check && \
		printf "$(GREEN)$(CHECK) Formatting valid$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Formatting issues found$(RESET)\n" && exit 1)

clippy:
	@printf "$(PROGRESS) Running clippy...\n"
	@cargo clippy --all-targets -- -D warnings && \
		printf "$(GREEN)$(CHECK) Clippy passed$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Clippy warnings found$(RESET)\n" && exit 1)

# ============== CI Simulation ==============

ci-local: banner
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║              Local CI Simulation                         ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(ARROW) $(BOLD)Simulating GitHub Actions CI workflow locally...$(RESET)\n\n"
	@printf "$(PROGRESS) Step 1/8: Asset freshness check...\n"
	@$(MAKE) assets --no-print-directory
	@printf "$(PROGRESS) Step 2/8: Format check...\n"
	@$(MAKE) fmt-check --no-print-directory
	@printf "$(PROGRESS) Step 3/8: Build...\n"
	@cargo build --quiet && printf "$(GREEN)$(CHECK) Build passed$(RESET)\n"
	@printf "$(PROGRESS) Step 4/8: Clippy...\n"
	@$(MAKE) clippy --no-print-directory
	@printf "$(PROGRESS) Step 5/8: Doctests...\n"
	@cargo test --doc --quiet && printf "$(GREEN)$(CHECK) Doctests passed$(RESET)\n"
	@printf "$(PROGRESS) Step 6/8: Unit tests...\n"
	@cargo test --lib --quiet && printf "$(GREEN)$(CHECK) Unit tests passed$(RESET)\n"
	@printf "$(PROGRESS) Step 7/8: Frontend tests...\n"
	@node --test tests/*.test.js && printf "$(GREEN)$(CHECK) Frontend tests passed$(RESET)\n"
	@printf "$(PROGRESS) Step 8/8: Browser smoke tests...\n"
	@node tests/demo-browser-check.js && printf "$(GREEN)$(CHECK) Browser smoke tests passed$(RESET)\n"
	@printf "\n$(GREEN)$(BOLD)╔══════════════════════════════════════════════════════════╗$(RESET)\n"
	@printf "$(GREEN)$(BOLD)║              $(CHECK) CI SIMULATION PASSED                      ║$(RESET)\n"
	@printf "$(GREEN)$(BOLD)╚══════════════════════════════════════════════════════════╝$(RESET)\n\n"

# ============== Version Management ==============
# Maintainer note: version bump targets require Node.js + npx because they use
# commit-and-tag-version. The library runtime path itself remains npm-free.

version:
	@printf "$(CYAN)Current version:$(RESET) $(YELLOW)$(BOLD)$(VERSION)$(RESET)\n"

bump-version: banner
	@CURRENT_VERSION=$$(grep -m1 '^version' Cargo.toml | sed 's/version = "\(.*\)"/\1/'); \
	if [ -z "$(VERSION)" ]; then \
		printf "$(RED)$(CROSS) VERSION=x.y.z is required$(RESET)\n"; \
		exit 1; \
	fi; \
	if ! printf '%s\n' "$(VERSION)" | grep -Eq $(SEMVER_RE); then \
		printf "$(RED)$(CROSS) VERSION must use semver x.y.z$(RESET)\n"; \
		exit 1; \
	fi; \
	if [ "$$CURRENT_VERSION" = "$(VERSION)" ]; then \
		printf "$(YELLOW)Version already set to v$(VERSION)$(RESET)\n"; \
		exit 0; \
	fi; \
	printf "$(ARROW) Syncing version surfaces: v$$CURRENT_VERSION -> v$(VERSION)\n"; \
	python3 scripts/sync-version.py "$$CURRENT_VERSION" "$(VERSION)"; \
	rm -f "static/sf/sf.$$CURRENT_VERSION.css" "static/sf/sf.$$CURRENT_VERSION.js"; \
	$(MAKE) assets --no-print-directory; \
	printf "$(GREEN)$(CHECK) Version updated to v$(VERSION)$(RESET)\n"; \
	printf "$(GRAY)Changelog unchanged. Run 'make release-tag' separately when ready.$(RESET)\n"

bump-patch: banner
	@printf "$(ARROW) Bumping patch version...\n"
	@NEXT_VERSION=$$(python3 -c "major, minor, patch = map(int, '$(VERSION)'.split('.')); print(f'{major}.{minor}.{patch + 1}')"); \
	$(MAKE) bump-version VERSION=$$NEXT_VERSION --no-print-directory

bump-minor: banner
	@printf "$(ARROW) Bumping minor version...\n"
	@NEXT_VERSION=$$(python3 -c "major, minor, patch = map(int, '$(VERSION)'.split('.')); print(f'{major}.{minor + 1}.0')"); \
	$(MAKE) bump-version VERSION=$$NEXT_VERSION --no-print-directory

bump-major: banner
	@printf "$(ARROW) Bumping major version...\n"
	@NEXT_VERSION=$$(python3 -c "major, minor, patch = map(int, '$(VERSION)'.split('.')); print(f'{major + 1}.0.0')"); \
	$(MAKE) bump-version VERSION=$$NEXT_VERSION --no-print-directory

bump-dry:
	@python3 -c "major, minor, patch = map(int, '$(VERSION)'.split('.')); print('patch -> ' + f'{major}.{minor}.{patch + 1}'); print('minor -> ' + f'{major}.{minor + 1}.0'); print('major -> ' + f'{major + 1}.0.0')"

release-tag: banner
	@printf "$(ARROW) Generating changelog + release commit/tag for v$(VERSION)...\n"
	@npx commit-and-tag-version --skip.bump --no-verify
	@printf "$(GREEN)$(CHECK) Release changelog, commit, and tag created$(RESET)\n"

# ============== Pre-Release Validation ==============

pre-release: banner
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║            Pre-Release Validation v$(VERSION)                  ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════════════════════════╝$(RESET)\n\n"
	@$(MAKE) assets --no-print-directory
	@$(MAKE) fmt-check --no-print-directory
	@$(MAKE) clippy --no-print-directory
	@printf "$(PROGRESS) Running full test suite...\n"
	@cargo test --quiet && node --test tests/*.test.js && node tests/demo-browser-check.js && printf "$(GREEN)$(CHECK) All tests passed$(RESET)\n"
	@printf "$(PROGRESS) Dry-run publish...\n"
	@cargo publish --dry-run 2>&1 | tail -1
	@printf "$(PROGRESS) Verifying packaged contents...\n"
	@./scripts/verify-package.sh
	@printf "$(GREEN)$(CHECK) Package valid$(RESET)\n"
	@printf "\n$(GREEN)$(BOLD)$(CHECK) Ready for release v$(VERSION)$(RESET)\n\n"

package-verify:
	@printf "$(PROGRESS) Verifying packaged crate contents...\n"
	@./scripts/verify-package.sh
	@printf "$(GREEN)$(CHECK) Package contents verified$(RESET)\n"

# ============== Publishing ==============

publish-dry: test banner
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║              Pre-Publish Verification                    ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(GREEN)$(CHECK) All tests passed$(RESET)\n"
	@cargo publish --dry-run && \
		./scripts/verify-package.sh && \
		printf "$(GREEN)$(CHECK) Package valid$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Package validation failed$(RESET)\n" && exit 1)
	@printf "\n$(GRAY)Use 'make publish' to publish v$(VERSION) to crates.io$(RESET)\n\n"

publish: banner
	@printf "$(CYAN)$(BOLD)╔══════════════════════════════════════════════════════════╗$(RESET)\n"
	@printf "$(CYAN)$(BOLD)║              Publishing to crates.io                     ║$(RESET)\n"
	@printf "$(CYAN)$(BOLD)╚══════════════════════════════════════════════════════════╝$(RESET)\n\n"
	@printf "$(RED)$(BOLD)WARNING: This will publish version $(VERSION) to crates.io$(RESET)\n"
	@printf "$(YELLOW)Press Ctrl+C to abort, or Enter to continue...$(RESET)\n"
	@read dummy
	@printf "\n$(ARROW) Publishing solverforge-ui v$(VERSION)...\n"
	@cargo publish && \
		printf "$(GREEN)$(CHECK) Published$(RESET)\n" || \
		(printf "$(RED)$(CROSS) Publish failed$(RESET)\n" && exit 1)
	@printf "\n$(GREEN)$(BOLD)╔══════════════════════════════════════════════════════════╗$(RESET)\n"
	@printf "$(GREEN)$(BOLD)║          $(CHECK) Published successfully!                       ║$(RESET)\n"
	@printf "$(GREEN)$(BOLD)╚══════════════════════════════════════════════════════════╝$(RESET)\n\n"

# ============== Clean ==============

clean:
	@printf "$(ARROW) Cleaning build artifacts...\n"
	@cargo clean
	@rm -f static/sf/sf.css static/sf/sf.js static/sf/sf.*.css static/sf/sf.*.js
	@printf "$(GREEN)$(CHECK) Clean complete$(RESET)\n"

# ============== Development ==============

watch:
	@printf "$(ARROW) Watching for changes...\n"
	@cargo watch -x build

demo-serve: assets
	@printf "$(ARROW) Serving demos at http://localhost:8000/demos/\n"
	@python3 scripts/demo_server.py

# ============== Help ==============

help: banner
	@/bin/echo -e "$(CYAN)$(BOLD)Asset Commands:$(RESET)"
	@/bin/echo -e "  $(GREEN)make assets$(RESET)         - Bundle CSS/JS from sources"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)Demo Commands:$(RESET)"
	@/bin/echo -e "  $(GREEN)make demo-serve$(RESET)     - Serve the runnable demo fixtures locally"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)Build Commands:$(RESET)"
	@/bin/echo -e "  $(GREEN)make build$(RESET)          - Bundle assets + build crate"
	@/bin/echo -e "  $(GREEN)make build-release$(RESET)  - Bundle assets + release build"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)Test Commands:$(RESET)"
	@/bin/echo -e "  $(GREEN)make test$(RESET)           - Run all tests"
	@/bin/echo -e "  $(GREEN)make test-quick$(RESET)     - Run doctests + unit tests (fast)"
	@/bin/echo -e "  $(GREEN)make test-doc$(RESET)       - Run doctests only"
	@/bin/echo -e "  $(GREEN)make test-unit$(RESET)      - Run unit tests only"
	@/bin/echo -e "  $(GREEN)make test-frontend$(RESET)  - Run frontend Node tests"
	@/bin/echo -e "  $(GREEN)make test-one TEST=name$(RESET) - Run specific test with output"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)Lint & Format:$(RESET)"
	@/bin/echo -e "  $(GREEN)make lint$(RESET)           - Run fmt-check + clippy"
	@/bin/echo -e "  $(GREEN)make fmt$(RESET)            - Format code"
	@/bin/echo -e "  $(GREEN)make fmt-check$(RESET)      - Check formatting"
	@/bin/echo -e "  $(GREEN)make clippy$(RESET)         - Run clippy lints"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)CI & Quality:$(RESET)"
	@/bin/echo -e "  $(GREEN)make ci-local$(RESET)       - $(YELLOW)$(BOLD)Simulate GitHub Actions CI locally$(RESET)"
	@/bin/echo -e "  $(GREEN)make pre-release$(RESET)    - Run all validation checks"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)Version Management:$(RESET)"
	@/bin/echo -e "  $(GREEN)make version$(RESET)        - Show current version"
	@/bin/echo -e "  $(GREEN)make bump-version VERSION=x.y.z$(RESET) - Sync version surfaces only"
	@/bin/echo -e "  $(GREEN)make bump-patch$(RESET)     - Bump patch version (0.1.$(YELLOW)x$(RESET))"
	@/bin/echo -e "  $(GREEN)make bump-minor$(RESET)     - Bump minor version (0.$(YELLOW)x$(RESET).0)"
	@/bin/echo -e "  $(GREEN)make bump-major$(RESET)     - Bump major version ($(YELLOW)x$(RESET).0.0)"
	@/bin/echo -e "  $(GREEN)make bump-dry$(RESET)       - Preview next patch/minor/major versions"
	@/bin/echo -e "  $(GREEN)make release-tag$(RESET)    - Generate changelog + release commit/tag with commit-and-tag-version"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)Publishing:$(RESET)"
	@/bin/echo -e "  $(GREEN)make publish-dry$(RESET)    - Dry-run publish to crates.io"
	@/bin/echo -e "  $(GREEN)make publish$(RESET)        - $(RED)$(BOLD)Publish to crates.io$(RESET)"
	@/bin/echo -e ""
	@/bin/echo -e "$(CYAN)$(BOLD)Other:$(RESET)"
	@/bin/echo -e "  $(GREEN)make clean$(RESET)          - Clean build artifacts + bundled assets"
	@/bin/echo -e "  $(GREEN)make watch$(RESET)          - Watch and rebuild on changes"
	@/bin/echo -e "  $(GREEN)make help$(RESET)           - Show this help message"
	@/bin/echo -e ""
	@/bin/echo -e "$(GRAY)Rust version required: $(RUST_VERSION)$(RESET)"
	@/bin/echo -e "$(GRAY)Current version: v$(VERSION)$(RESET)"
	@/bin/echo -e ""
