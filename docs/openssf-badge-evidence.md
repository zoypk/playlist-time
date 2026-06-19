# OpenSSF Best Practices Passing Badge Evidence

This file maps the Passing badge criteria to repository evidence for the badge form. Use the public GitHub URLs for these files when filling fields that require a URL.

Project URLs:

- Website: `https://playlist-time.pages.dev`
- Repository: `https://github.com/zoypk/playlist-time`
- License: `AGPL-3.0-only`
- Languages: `TypeScript, JavaScript, Astro`

## Basics

| Criterion | Suggested status | Evidence |
| --- | --- | --- |
| `description_good` | Met | README describes the playlist watch-time problem and the live app demonstrates it. |
| `interact` | Met | README links setup, live app, API docs, security policy, and contribution/reporting docs. |
| `contribution` | Met | `CONTRIBUTING.md` documents the pull request process. |
| `contribution_requirements` | Met | `CONTRIBUTING.md` documents tests, style, secret handling, validation, and docs requirements. |
| `floss_license` | Met | `LICENSE` and `package.json` use `AGPL-3.0-only`. |
| `floss_license_osi` | Met | AGPL-3.0-only is an OSI-approved FLOSS license. |
| `license_location` | Met | `LICENSE` is in the repository root. |
| `documentation_basics` | Met | README covers purpose, local setup, environment, checks, API, deployment, and limits. |
| `documentation_interface` | Met | README documents `/api/playlist` and `/api/playlists` inputs and outputs. |
| `sites_https` | Met | Website, repository, and release/download surfaces use HTTPS. |
| `discussion` | Met | GitHub issues and pull requests are searchable, URL-addressable, and browser-based. |
| `english` | Met | Documentation, issues, and contribution flow are in English. |
| `maintained` | Met | Current branch, issue templates, security policy, CI, release workflow, and badge evidence define active maintenance paths. |

## Change Control

| Criterion | Suggested status | Evidence |
| --- | --- | --- |
| `repo_public` | Met | Public GitHub repository: `https://github.com/zoypk/playlist-time`. |
| `repo_track` | Met | Git records authors, timestamps, and diffs. |
| `repo_interim` | Met | Pull requests and branch commits provide interim review versions. |
| `repo_distributed` | Met | Repository uses Git. |
| `version_unique` | Met | `package.json` version and semantic Git tags such as `v1.0.0`. |
| `version_semver` | Met | Release workflow uses tags matching `v*.*.*`. |
| `version_tags` | Met | Releases are identified by Git tags. |
| `release_notes` | Met | `CHANGELOG.md` and the README release section define human-readable release notes. GitHub Releases may mirror these notes for new tags. |
| `release_notes_vulns` | N/A | No publicly known runtime vulnerabilities have been fixed in a release. Future fixes must be identified in release notes. |

## Reporting

| Criterion | Suggested status | Evidence |
| --- | --- | --- |
| `report_process` | Met | README and `CONTRIBUTING.md` point users to GitHub issues. |
| `report_tracker` | Met | GitHub issues track individual bug and enhancement reports. |
| `report_responses` | Met | Maintainer policy is to acknowledge bug reports; no known unacknowledged reports in the 2-12 month window. |
| `enhancement_responses` | Met | Maintainer policy is to respond to enhancement requests; no known unacknowledged requests in the 2-12 month window. |
| `report_archive` | Met | GitHub issues and pull requests are public searchable archives. |
| `vulnerability_report_process` | Met | `SECURITY.md` documents security reporting. |
| `vulnerability_report_private` | N/A | Private reports are only supported if GitHub private vulnerability reporting is enabled for the repository; otherwise `SECURITY.md` tells reporters not to include secrets in public issues. |
| `vulnerability_report_response` | Met | `SECURITY.md` commits to an initial response within 14 days. If there is no vulnerability-report history, the badge form can also mark this N/A. |

## Quality

| Criterion | Suggested status | Evidence |
| --- | --- | --- |
| `build` | Met | `bun run build` rebuilds the app from source. |
| `build_common_tools` | Met | Bun, Astro, React, TypeScript, and Cloudflare Pages are common tools for this stack. |
| `build_floss_tools` | Met | Build tools and dependencies are FLOSS. |
| `test` | Met | `bun run test` and Playwright smoke tests are public and documented. |
| `test_invocation` | Met | Standard package scripts expose `bun run test` and `bun run smoke:demo`. |
| `test_most` | Met | Tests cover parsing, range math, API key parsing, cache keys, bounded concurrency, error handling, rate limiting, and demo rendering. |
| `test_continuous_integration` | Met | `.github/workflows/ci.yml` runs audit, checks, tests, and build on pushes and pull requests. |
| `test_policy` | Met | `CONTRIBUTING.md` requires tests for major new functionality and regression tests for reproducible bug fixes. |
| `tests_are_added` | Met | Existing unit and API tests cover the most recent functional areas. |
| `tests_documented_added` | Met | `CONTRIBUTING.md` documents the test policy for change proposals. |
| `warnings` | Met | `bun run check`, TypeScript, Astro check, and CodeQL run automated quality/security checks. |
| `warnings_fixed` | Met | CI is expected to pass with warnings and findings addressed before merge. |
| `warnings_strict` | Met | TypeScript strict checks are enabled through `tsconfig.json`, and CI runs checks before merge. |

## Security

| Criterion | Suggested status | Evidence |
| --- | --- | --- |
| `know_secure_design` | Met | Maintainer policy and docs cover server-side secret handling, input validation, dependency audit, and vulnerability response. |
| `know_common_errors` | Met | `CONTRIBUTING.md` and `SECURITY.md` call out exposed secrets, browser secret leakage, input limits, cache behavior, rate limiting, and dependency vulnerabilities. |
| `crypto_published` | Met | The project relies on public HTTPS/TLS mechanisms provided by GitHub, Cloudflare, and the YouTube API. |
| `crypto_call` | Met | The app does not implement cryptography; it relies on platform TLS and standard runtimes. |
| `crypto_floss` | Met | Project code and build tools are FLOSS; platform TLS is externally provided. |
| `crypto_keylength` | N/A | The project does not configure cryptographic key lengths. |
| `crypto_working` | Met | The app does not use broken custom cryptography. |
| `crypto_weaknesses` | Met | The app does not depend on weak custom cryptographic algorithms or modes. |
| `crypto_pfs` | N/A | The project does not implement key-agreement protocols. |
| `crypto_password_storage` | N/A | The project does not create user accounts or store passwords. |
| `crypto_random` | N/A | The project does not generate cryptographic keys or nonces. |
| `delivery_mitm` | Met | Delivery uses HTTPS through GitHub, Cloudflare Pages, and npm/Bun package registries. |
| `delivery_unsigned` | Met | The project does not retrieve hashes over HTTP and trust them without signatures. |
| `vulnerabilities_fixed_60_days` | Met | `SECURITY.md` commits to fixing public medium-or-higher vulnerabilities within 60 days. |
| `vulnerabilities_critical_fixed` | Met | `SECURITY.md` commits to prioritizing critical vulnerabilities rapidly. |
| `no_leaked_credentials` | Met | `.dev.vars` is ignored, `.dev.vars.example` uses placeholders, and prior secret-history checks found no valid committed credentials. |

## Analysis

| Criterion | Suggested status | Evidence |
| --- | --- | --- |
| `static_analysis` | Met | `.github/workflows/codeql.yml` runs CodeQL for JavaScript/TypeScript before major production releases and on pull requests. |
| `static_analysis_common_vulnerabilities` | Met | CodeQL includes JavaScript/TypeScript security queries for common vulnerability patterns. |
| `static_analysis_fixed` | Met | `SECURITY.md` and CI policy require confirmed medium-or-higher exploitable findings to be fixed. |
| `static_analysis_often` | Met | CodeQL runs on pull requests, pushes, release tags, and a weekly schedule. |
| `dynamic_analysis` | Met | `.github/workflows/dynamic-analysis.yml` runs OWASP ZAP Baseline against the public demo route; README release guidance says to run it before major production releases. |
| `dynamic_analysis_unsafe` | N/A | The project is TypeScript/JavaScript/Astro and does not include C/C++ or another memory-unsafe implementation language. |
| `dynamic_analysis_enable_assertions` | Met | Bun and Playwright tests use runtime assertions in test mode before release. |
| `dynamic_analysis_fixed` | Met | `SECURITY.md` requires confirmed medium-or-higher dynamic-analysis vulnerabilities to be fixed. |
