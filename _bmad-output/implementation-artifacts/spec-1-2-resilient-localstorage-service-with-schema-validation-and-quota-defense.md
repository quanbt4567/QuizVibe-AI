---
title: "Story 1.2: Resilient LocalStorage Service with Schema Validation & Quota Defense"
type: "feature"
created: "2026-11-02"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Direct or unmanaged access to `localStorage` risks runtime application crashes due to malformed JSON, quota exceptions (`QuotaExceededError`), unavailable storage environments (private browsing/iframes), and schema mismatch between versions, in addition to corrupting leaderboard integrity with unverified leads.

**Approach:** Build a resilient, strongly-typed `StorageService` acting as the single gateway for all browser persistence (`quizvibe_active_campaign`, `quizvibe_leads`, `quizvibe_leaderboard`, `quizvibe_schema_version`). Implement runtime type guards, schema versioning and safe migrations, memory fallback for quota/availability exceptions, gated lead submission enforcing Vietnamese phone regex `/^(03|05|07|08|09)\d{8}$/` (AD-4), and comprehensive unit testing.

</frozen-after-approval>

## Implementation Notes

- Designed data schemas for Campaign, Question, Voucher, Lead, and LeaderboardEntry.
- Implemented runtime validators ensuring strict shape and type checks.
- Implemented StorageService with storage availability detection, QuotaExceededError recovery, and in-memory cache fallback.
- Enforced AD-4 gated leaderboard write pipeline.
- Added comprehensive unit test suite covering normal read/write, corrupt JSON fallback, schema validation failure, quota overflow, and storage unavailability.

