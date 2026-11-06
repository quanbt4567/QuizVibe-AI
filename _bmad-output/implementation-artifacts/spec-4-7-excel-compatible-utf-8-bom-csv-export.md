# Implementation Specification — Story 4.7: Excel-Compatible UTF-8 BOM CSV Export

## 1. Executive Summary & Business Objective
Fanpage merchants collecting leads via QuizVibe AI interactive marketing campaigns need to export customer contact information into Microsoft Excel on Windows without corrupted Vietnamese characters (mojibake). This data will be imported into external tele-sales and SMS marketing tools.

Story 4.7 concludes Epic 4 and completes all 18/18 implementation stories of the QuizVibe AI project under the BMAD Method.

---

## 2. Technical Architecture & Invariant Compliance

### AD-6 / ARCH-6 Compliance (UTF-8 BOM Prepending)
- **Problem Solved:** Microsoft Excel on Windows historically defaults to local ANSI/Windows-1258 code pages when opening `.csv` files, rendering Vietnamese diacritics as unreadable mojibake.
- **Solution:** `downloadCsvFile()` prepends the 3-byte UTF-8 Byte Order Mark (`\uFEFF` -> `0xEF, 0xBB, 0xBF`) to the generated string before instantiating the `Blob`:
  ```typescript
  new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  ```
- **Verification:** Verified at byte-level using `Uint8Array` in unit tests (`csvExport.test.ts`).

### CSV Formula Injection Defense (OWASP Guidelines)
- Untrusted user input fields (`fullName`, `voucherCode`, `phoneNumber`) could be crafted with spreadsheet formula triggers: `=`, `+`, `-`, `@`, `\t`, `\r`.
- `sanitizeCsvField()` detects if the string (or trimmed string) begins with any trigger character and prepends a single quote (`'`), which instructs Excel to evaluate the cell strictly as literal text without executing commands.

### RFC 4180 Escaping Standards
- Any field containing commas, double quotes, newlines (`\n`), carriage returns (`\r`), leading/trailing spaces, or formula-sanitized quotes is enclosed in double quotes (`"`).
- Double quotes inside values are doubled (`""`).

### Privacy-Preserving Phone Representation
- In accordance with the security requirement, the default export uses `maskPhoneNumber(lead.phoneNumber)` (`098***4321`) to prevent accidental mass exposure of customer data.
- An optional configuration `{ unmasked: true }` is supported in `generateLeadsCsv` for authorized tele-sales workflows.

### Filter Continuity & Immutability
- The dashboard exports `filteredLeads`, respecting active text searches, score filters, and campaign dropdown selections without introducing redundant filtering logic.
- The export is read-only and causes zero mutations to stored leads or leaderboard entries.

---

## 3. Files Created & Modified
- `src/services/csvExport.ts`: Pure service module for formula injection defense, RFC 4180 escaping, filename generation, and UTF-8 BOM blob downloads.
- `src/services/storageService.ts`: Added `exportLeadsToCsv()` and `downloadLeadsCsv()` methods to the unified `StorageService` facade.
- `src/services/index.ts`: Re-exported all CSV export utilities.
- `src/components/admin/LeadDashboard.tsx`: Added "Xuất file Excel (CSV)" toolbar action button with responsive styling, toast feedback, and error handling.
- `src/services/csvExport.test.ts`: 21 comprehensive automated tests covering headers, BOM bytes, escaping, injection defense, empty datasets, and download lifecycles.
- `src/components/admin/LeadDashboard.test.ts`: Added 3 integration tests verifying dashboard export actions, filtered subset exports, and error handling.
- `_bmad-output/implementation-artifacts/sprint-status.yaml`: Marked `4-7-excel-compatible-utf-8-bom-csv-export: done` and `epic-4: done`.
- `_bmad-output/sprint-status.yaml`: Synced sprint status mirror to `done`.

---

## 4. Verification & Quality Gates
- **Unit & Integration Tests:** 309/309 passing across 18 test suites (`npm test`).
- **TypeScript Compiler:** 0 errors (`npx --no-install tsc --noEmit`).
- **Production Build:** Succeeded in 4.77s (`npm run build`).

