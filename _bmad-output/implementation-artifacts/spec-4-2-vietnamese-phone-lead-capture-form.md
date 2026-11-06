---
title: "Story 4.2: Vietnamese Phone Lead Capture Form"
type: "feature"
created: "2026-11-04"
status: "done"
route: "oneshot"
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Minigames on Fanpages require high conversion from trivia completion to genuine lead capture. Players must be able to input their Full Name and Vietnamese mobile number easily on mobile viewports, with transparent privacy notices and instant validation that rejects invalid numbers or duplicate clicks.

**Approach:**
1. Implement `LeadCaptureForm.tsx` within `src/components/player/` with:
   - Full Name validation: Required, trimmed, minimum 2 characters.
   - Vietnamese Mobile Phone validation: Exactly 10 digits matching `/^(03|05|07|08|09)\d{8}$/` (FR-302, TC-03).
   - Clear Vietnamese error feedback placed directly beneath the respective inputs.
2. Persist leads exclusively through the sanctioned entry point: `StorageService.submitLead()`.
   - Attaches `score`, `timeTakenSeconds`, `campaignId`, `voucherCode`, `fullName`, and `phoneNumber`.
   - Prevents duplicate clicks using synchronous ref locking (`isSubmittingRef`) and disabled states.
   - Preserves user input upon validation or storage errors so users never have to retype data.
3. Provide transparent privacy communication:
   - Notice: *"Thông tin số điện thoại được sử dụng để Fanpage/Cửa hàng liên hệ gửi mã ưu đãi và đối soát quà tặng cho bạn. Cam kết bảo mật, không spam."*
   - Avoid false claims regarding OTP or identity verification.
4. Render within `ResultScreen.tsx` per `EXPERIENCE.md` Section S3, offering both immediate lead capture and secondary "Bỏ qua (Chỉ xem điểm, không lưu)" option.
5. Strictly isolate scope: no voucher codes displayed or unlocked yet (reserved for Story 4.3).

</frozen-after-approval>

## Implementation Notes

- Created `src/components/player/LeadCaptureForm.tsx` exporting `LeadCaptureForm`, `validateFullName`, and `validateVietnamesePhone`.
- Exported `LeadCaptureForm` in `src/components/player/index.ts`.
- Integrated `LeadCaptureForm` seamlessly into `src/components/player/ResultScreen.tsx`.
- Updated `src/App.tsx` handling `onLeadSubmitted`.
- Added unit tests in `src/components/player/LeadCaptureForm.test.ts` covering 16 scenarios across name validation, phone validation, persistence integration, duplicate submission locks, and error recovery.
- Evaluated form libraries (`react-hook-form`, `formik`, `cleave.js`) and selected pure React controlled inputs (**REJECT** external dependencies) to minimize bundle weight and maximize mobile In-App Browser compatibility.
- All 180 unit tests passing across 13 suites; TypeScript compilation and Vite production build verified with 0 errors.

