# Epic 1 Context: Project Foundation, Design Tokens & Resilient Storage Substrate

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the rock-solid web application scaffold (React 19, TypeScript, Vite 6, Tailwind CSS, Lucide Icons) and implement the resilient client-side storage service (`StorageService`) with schema validation, quota defense, and default campaign bootstrapping, enabling subsequent player and admin workflows.

## Stories

- Story 1.1: Greenfield Project Scaffold & Base App Shell
- Story 1.2: Resilient LocalStorage Service with Schema Validation & Quota Defense
- Story 1.3: Default Campaign Bootstrapping & Industry Mock Presets

## Requirements & Constraints

- Single-page application using client-side `localStorage` exclusively for data persistence (`AD-1`).
- Strictly no persistent external database or user authentication system.
- Zero client-side API secrets (`AD-2`).
- Responsive layout supporting 360px–430px mobile viewports (Facebook in-app browser) up to desktop.
- First Contentful Paint $\le 1.5\text{s}$ on mobile 4G.

## Technical Decisions

- Stack: React 19, TypeScript 5.6+, Vite 6, Tailwind CSS, Lucide React (`ARCH-1`).
- Architecture: Client-centric modular architecture with decoupled Storage Service (`StorageService`) wrapping `localStorage` with distinct keys: `quizvibe_active_campaign`, `quizvibe_leads`, `quizvibe_leaderboard`.
- Storage Reliability (`ARCH-7`): Safe parsing, schema validation, quota error handling, and default fallback on corruption.

## UX & Interaction Patterns

- Electric Indigo (`#4F46E5`), Golden Amber (`#F59E0B`), Emerald (`#10B981`), and Slate (`#0F172A`) palette.
- Typography: `Plus Jakarta Sans` for UI copy, tabular monospace figures for timers.
- Minimum 52px touch targets for answer options and CTAs.
- Top navigation with brand logo and instant role-switching between Player View and Admin Dashboard.

## Cross-Story Dependencies

- Story 1.1 provides the foundational React/Vite/Tailwind shell.
- Story 1.2 implements `StorageService` using schemas defined in Story 1.1.
- Story 1.3 seeds initial mock data using `StorageService`.
- Epics 2 and 3 depend on Epic 1 completion.

