# Ballot Clarity Production Readiness Roadmap

This roadmap is specific to the current Nuxt + Express + admin-bridge monorepo. It is not a generic launch checklist.

## Current state

The repo already has:

- a public civic-information surface with candidate, measure, election, search, and source pages
- a protected admin bridge where browser requests to `/api/admin/*` terminate at Nuxt
- persisted admin/editor accounts and operational state in the backend store

The repo does not yet have:

- live civic data ingestion
- a full structured editorial CMS for the read-side public content model
- managed production infrastructure for multi-editor use
- operational monitoring and import incident handling

## Phase 1: Production foundation inside the repo

Goal: stop treating public content as code-only data.

Work:

- persist public-facing summaries and publish state in the admin store
- make the admin content console update public candidate, measure, and election text without a deploy
- make public APIs respect publish state
- document launch architecture, env boundaries, and follow-on production work

Exit criteria:

- editors can update public summaries from `/admin/content`
- unpublished content is no longer automatically exposed by public APIs
- the production roadmap and deployment responsibilities are documented in-repo

## Phase 2: Real content model and data storage

Goal: move the read-side model out of seeded TypeScript objects.

Work:

- introduce a real content repository layer for elections, contests, candidates, measures, and sources
- move seeded data from `back-end/src/coverage-data.ts` into importable seed files or database seed scripts
- add stable identifiers and crosswalk tables for contests, people, measures, and sources
- store source metadata separately from mirrored source-file artifacts

Recommended storage target:

- managed Postgres for operational and public content data
- object storage for mirrored source documents and static evidence artifacts

Exit criteria:

- one election can be loaded from the database without changing application code
- source records, publish state, and content text are versionable outside deploy artifacts

## Phase 3: Live civic data ingestion

Goal: replace seeded coverage with source-fed coverage.

Work:

- build connectors for address normalization and district lookup
- build official election-office importers for deadlines, notices, ballot text, and logistics
- add candidate filing and finance pipelines
- add source freshness tracking by upstream system, not just by page
- normalize imported data into the existing public API contracts

Exit criteria:

- at least one real jurisdiction is refreshed through import jobs
- upstream failures surface as operational incidents instead of silently serving stale assumptions

## Phase 4: Editorial workflow hardening

Goal: make the admin system safe for real editorial use.

Work:

- add content history, diff views, and rollback
- add structured editing for more than summary fields
- add assignment, review notes, publish approvals, and correction-to-content linkage
- add password reset, account disablement, login throttling, and MFA for admins
- add immutable audit logs for publish and user-management actions

Exit criteria:

- editorial changes are attributable, reversible, and reviewable
- account lifecycle is no longer dependent on bootstrap credentials alone

## Phase 5: Production infrastructure and operations

Goal: make the service durable and supportable.

Work:

- provision separate dev, staging, and production environments
- keep Nuxt public ingress separate from the private backend admin API
- move the admin store off SQLite before multi-instance or multi-editor production
- add structured logs, error reporting, uptime checks, and freshness alerts
- add backup, restore, and rollback procedures

Exit criteria:

- staging mirrors production topology
- deploy, rollback, and restore are documented and tested
- operator alerts exist for failed imports, stale sources, and admin auth issues

## Phase 6: Launch readiness

Goal: ship a trustworthy first public jurisdiction.

Work:

- finalize the real operator identity across About, Terms, Privacy, Contact, and Neutrality pages
- complete accessibility, print, and mobile QA
- run legal review on disclaimers, privacy practices, and source mirroring
- run content QA on one live election and jurisdiction
- define correction response SLAs and source-review cadence

Exit criteria:

- one jurisdiction is fully launchable with known freshness and support ownership
- the public site reads like an operated civic service, not a prototype

## What this repo can implement now

These changes can be shipped directly from code:

- persisted public content editing
- publish gating in the public API
- stronger admin workflow
- database abstractions that prepare for Postgres
- logging hooks, health checks, and test coverage

## What requires server-side provisioning after merge

These items need infrastructure or external service decisions:

- managed database and migration pipeline
- durable file/object storage for mirrored source artifacts
- production secrets management
- monitoring and alerting stack
- real civic data provider credentials and scheduled import jobs
- backup, restore, and incident-response procedures

## Recommended next implementation sequence

1. Finish Phase 1 completely, including public-content editing and publish gating.
2. Introduce a database-backed read model behind the existing API contracts.
3. Add one live jurisdiction ingestion pipeline.
4. Replace SQLite with managed Postgres for admin and content storage.
5. Add observability, auth hardening, and editorial version history.
