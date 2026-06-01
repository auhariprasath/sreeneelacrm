# Phase 2 — Neela Events CRM Build Plan

Phase 2 is large (~50 features). I'll deliver it in **6 sequential chunks**, each independently reviewable in the preview. After each chunk you can test and give feedback before I continue. This avoids a 2000-line single drop that's hard to verify.

---

## Chunk 1 — Database foundation + global app shell
**Goal:** Schema, RLS, indexes, soft delete, mobile shell ready for features.

- Migrations:
  - `leads`, `activity_logs`, `transfer_requests`, `notifications`, `follow_ups` tables
  - Enums: lead_source, lead_score, lead_status, action_type, transfer_status, notification_type
  - Add `fcm_token`, `phone_masked`, `last_active_at` to `profiles`
  - Unique constraint: `(phone, company_id)` on leads
  - Indexes on all columns listed in spec
  - `deleted_at` soft-delete columns
  - Full RLS: staff/admin scoped by `company_id`, super_admin bypass
  - Enable realtime on `leads` and `notifications`
- App shell:
  - Mobile bottom nav (Dashboard | Leads | Tasks | Notifications | More) ≤768px
  - Desktop sidebar preserved >768px
  - Offline banner, session timeout (30min), toast system (sonner)
  - Skeleton loader primitives

## Chunk 2 — Lead inbox + manual creation + lead profile shell
- `/leads` inbox: list, filter bar, search (debounced), sort, infinite scroll (20/page)
- Recently viewed (top 5, localStorage)
- Realtime subscription — new leads appear live
- "+ Add lead" form with duplicate check across all companies
- Lead profile route `/leads/$id`: header, action bar (buttons only, handlers in chunk 3), activity timeline
- Tel: / wa.me one-tap with activity logging
- Quick note popup
- Phone masking respected per user
- Filter + scroll state preservation
- Empty states with illustrations
- Form auto-save to localStorage + unsaved-changes guard (reusable hook)

## Chunk 3 — Call flow, follow-ups, blacklist, referral
- Post-call popup (5 outcomes)
- Follow-up scheduler (4 options) + `follow_ups` records
- Follow-up counter logic → unresponsive tag at max attempts
- Action-required banner with 3 options
- Referral linking (lead-to-lead) + activity entry on referrer
- Blacklist flag + warning banner + 3-dot menu
- "Not interested" drop reason flow
- Returning client badge

## Chunk 4 — Transfer system
- 3-step transfer flow (warning checklist → 20-char summary → details)
- Lead lock state while pending
- SA approval queue page + dashboard panel
- Approve/reject with activity logs
- Per-user `auto_approve_transfers` honored
- Push/in-app notifications for all transfer events

## Chunk 5 — Notifications + staff management
- In-app notification centre (slide-in panel, bell badge, mark read, grouped by date)
- Realtime `notifications` subscription
- Staff management in Settings: add, deactivate (force sign-out via admin API), phone-masking toggle, auto-approve toggle, reassignment prompt on deactivation
- Global search in top nav (cross-company for SA)

## Chunk 6 — PWA + push + onboarding polish
- `manifest.json`, app icons (192/512 purple "N"), service worker (kill-switch-safe, registration guarded against iframes/preview hosts per platform rules)
- Web Push subscription + storing token
- Edge function to send pushes on the 7 trigger events
- "Add to Home Screen" prompt on second visit
- First-login 5-step guided tour (dismissable, replay from settings)
- (?) tooltips on non-obvious fields
- Final QA pass: 44px tap targets, dropdown upward-detection, Indian currency/date formatters, plain-language errors

---

## Technical notes

- **Stack:** TanStack Start server functions for all writes/reads requiring auth (not edge functions, per platform rules). One edge function only for push delivery in chunk 6.
- **Reusables built in chunk 1–2 and reused everywhere:** `useAutoSaveDraft`, `useUnsavedGuard`, `formatINR`, `formatDateIN`, `formatPhoneIN`, `<SkeletonList>`, `<EmptyState>`, `<SmartDropdown>` (upward detection + search + pinned selection).
- **PWA caveat:** Service workers don't work in the Lovable preview iframe — PWA install + push will only function on the published URL. I'll note this when we get to chunk 6.
- **What I'm NOT building** (out of scope per your Phase 2 spec): intake form (Phase 3), quotation builder (Phase 4), site visit scheduler beyond a stub, reports (Phase 6).

---

## Proposal

Approve this plan and I'll start with **Chunk 1** (DB + shell) in the next message. After each chunk I'll pause for you to review in preview before continuing. Sound good?
