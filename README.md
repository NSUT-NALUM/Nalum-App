# PROJECT.md

# NALUM v2

## Vision

NALUM v2 is a complete rewrite of the original NALUM platform.

The objective is not simply to recreate existing functionality but to build a modern, scalable, maintainable, and production-ready alumni platform that follows enterprise engineering practices.

Every design decision should prioritize:

* Maintainability
* Scalability
* Simplicity
* Readability
* Type safety
* Security
* Performance
* Developer experience

Short-term convenience must never compromise long-term maintainability.

---

# Core Principles

1. Code is written for humans first, computers second.
2. Readability is more important than cleverness.
3. Prefer explicit code over implicit behavior.
4. Every module should have a single responsibility.
5. Every feature should be independently understandable.
6. Architecture consistency is more important than personal preference.
7. Favor composition over duplication.
8. Fail fast when configuration or input is invalid.
9. Optimize only after measuring.
10. Simplicity always wins.

---

# Technology Stack

## Frontend

* Expo
* React Native
* Expo Router
* TypeScript
* NativeWind

## Backend

* Fastify
* TypeScript
* PostgreSQL
* Redis
* BullMQ

## Infrastructure

* Docker
* Nginx
* GitHub Actions

## Local development

Run `bun run dev:stack` to start PostgreSQL, Redis, MinIO, MinIO Console,
pgAdmin, RedisInsight, the backend, chatserver, and email worker. The local
processes use Bun hot reload; containers remain running when you stop the
command with Ctrl-C.

Set the backend and chatserver `DATABASE_URL` values to the localhost URL in
their `.env.example` files when running these processes on your machine.

The command waits for infrastructure health and applies pending Prisma
migrations without resetting local data. The development dashboards are
available at MinIO Console (`http://localhost:9001`), pgAdmin
(`http://localhost:5050`), and RedisInsight (`http://localhost:5540`).

Use `bun run docker:compose -- <command>` for profile-aware Docker Compose
commands, `bun run generate:module <name>` for a backend module, and
`bun run generate:middleware <name>` for a backend middleware.

---

# Architecture

NALUM follows a Modular Monolith architecture.

Microservices are intentionally avoided during initial development.

Each feature is isolated into its own module with clear boundaries.

The architecture should allow future extraction into independent services without major refactoring.

---

# Backend Request Flow

Every request follows the same pipeline.

Request

↓

Route

↓

Validation

↓

Controller

↓

Service

↓

Repository

↓

Database

No layer may skip another layer.

---

# Module Organization

The project follows feature-first organization.

Every feature owns everything related to itself.

Example:

modules/

```
auth/

users/

profile/

posts/

comments/

events/

chat/

notifications/

reports/
```

Shared utilities belong only inside shared libraries.

Business logic must never be placed in shared folders.

---

# Layer Responsibilities

Routes

* Register endpoints
* Attach middleware
* Nothing else

Controllers

* Parse request
* Call services
* Return response

Controllers never contain business logic.

Services

* Business rules
* Authorization
* Application workflows

Services never know about HTTP.

Repositories

* Database access only

Repositories never contain business rules.

---

# Validation

Every incoming request must be validated before reaching the controller.

Invalid requests should never reach business logic.

Validation schemas live beside their respective modules.

---

# Error Handling

Errors are thrown, never returned.

A centralized global error handler is responsible for converting errors into HTTP responses.

Business logic must never manually construct HTTP error responses.

---

# Logging

Use structured logging.

Every log should include:

* timestamp
* request id
* log level
* message

Sensitive information must never be logged.

---

# Authentication

Authentication must be centralized.

Authorization decisions belong inside services.

Never trust client-provided identifiers.

---

# Database

PostgreSQL is the source of truth.

Relationships should be enforced by the database whenever possible.

Foreign keys, constraints, indexes, and transactions should be preferred over application-level workarounds.

---

# Background Jobs

Long-running tasks must execute asynchronously.

Examples include:

* Email
* Notifications
* Scheduled jobs
* Image processing

HTTP requests should remain fast.

---

# API Design

The API must be:

* Predictable
* Versioned
* RESTful
* Consistent

Every endpoint should return a consistent response format.

---

# Code Quality Rules

* Single Responsibility Principle
* Don't Repeat Yourself
* Keep It Simple
* Prefer composition over inheritance
* No magic numbers
* No hardcoded configuration
* No circular dependencies
* No dead code
* No commented-out code
* Small focused functions
* Descriptive names
* Strict TypeScript
* Async by default

---

# Performance Philosophy

Correctness comes before optimization.

Readability comes before micro-optimizations.

Measure before optimizing.

Optimize bottlenecks, not assumptions.

---

# Security

Security is mandatory.

Never:

* Trust client input
* Store plaintext passwords
* Expose secrets
* Disable validation

Always validate, sanitize, and authenticate.

---

# Documentation

Architecture decisions should be documented.

Every public API should be documented.

Complex business logic should include concise explanations where necessary.

---

# Testing Philosophy

Critical business logic should be testable.

Architecture should naturally support unit and integration testing.

Code should be written to be testable rather than retrofitted later.

---

# Definition of Done

A feature is considered complete only if:

* Architecture rules are followed
* Code is readable
* Validation exists
* Errors are handled correctly
* Logging is present where appropriate
* No duplicated logic exists
* Documentation is updated when necessary

Shipping quickly is never an excuse for poor architecture.

---

# Final Principle

Every contributor, whether human or AI, must preserve the consistency of the codebase.

When multiple valid implementations exist, choose the one that is easiest to understand, easiest to maintain, and most consistent with the existing architecture.
