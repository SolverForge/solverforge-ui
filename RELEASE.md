# Release Checklist

Use this checklist for every public release of `solverforge-ui`.

## Before Tagging

- Confirm `main` is green in CI.
- Run `make assets` and verify no generated file drift remains.
- Run `make pre-release`.
- Review `CHANGELOG.md` and make sure `commit-and-tag-version` will generate the intended next release notes.
- Confirm README and wireframe docs still match the shipped surface.
- Verify the crate version in `Cargo.toml` matches the intended release.
- Use `make bump-version VERSION=x.y.z` or `make bump-patch|bump-minor|bump-major` to sync repo version surfaces before the release step.

## Tagging

- This repository uses `commit-and-tag-version` for changelog generation plus the release commit/tag step.
- Version bumping is separate and happens through the Makefile bump targets.
- Run `make release-tag` only after the version bump is already in place and validated.
- If using the bump targets locally, ensure Node.js with `npx` is available.
- Push the release commit and tag to GitHub.

## After Tagging

- Confirm the GitHub release job succeeds.
- Confirm the crates.io publish job succeeds.
- Inspect the published package contents with the package verification workflow.
- Sanity-check the release notes body against the new `CHANGELOG.md` entry.

## Changelog Rules

- Keep `Unreleased` up to date as work lands.
- Group entries under short headings like `Added`, `Changed`, `Fixed`, and `Docs` when helpful.
- Write entries for user-visible changes, not internal churn.
- Before cutting a release, promote the relevant `Unreleased` items into a dated version heading.
