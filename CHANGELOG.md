# Changelog

This project uses this changelog as the release-note source of record. GitHub Releases may mirror these notes when semantic version tags are pushed.

## Release Process

- Releases use semantic version tags such as `v1.0.0` and `v1.1.0`.
- The release workflow runs install, dependency audit, static checks, tests, and build before creating a GitHub Release for new tags.
- Release notes summarize user-visible changes and are not just raw `git log` output.
- If a release fixes a publicly known runtime vulnerability with a CVE or similar public identifier, the release notes must identify it.

## 1.0.0 - 2026-06-01

### Added

- Public launch of the playlist watch-time calculator.
- Astro/React calculator UI, Cloudflare Pages Functions API, YouTube playlist duration calculation, batch comparison, demo mode, and CSV/text export.

### Security

- No publicly known runtime vulnerabilities with a CVE or similar assignment were fixed in this release.
