# Settings restructure plan

This is a large rebuild touching the sidebar, the Companies experience, and several new per-company fields (coordinators, service tabs, per-company discount rules). I'll ship it in three stages so each one is reviewable. Say "next" between stages.

---

## Stage 1 — Sidebar + Companies entry (ship first)

Trim the left sidebar in `src/routes/_app/settings.tsx` to exactly:

1. Companies
2. Staff and roles
3. WhatsApp templates
4. Peak season dates
5. Vendor list
6. Task templates
7. Payment gateway
8. Discount rules

Remove all other top-level items (Company details, Location & Meeting, Venue photos, Routing rules, Event types, Sessions, Services, Add-ons, Reminders, Cancellation, Drop reasons, Confirmation message). Their content moves *inside* each company.

Companies section becomes a card grid. Each card shows logo, name, type, capacity, archived badge, and opens a new full-page view at `/settings/company/$companyId` (new route).

That page has a sticky jump-link bar at the top:
`Company details · Venue and media · Services and pricing · Event types · Sessions · Confirmation message · Discount rules`

Each section is an anchor (`#company-details`, `#venue-media`, etc.) and renders existing pieces wired to the chosen company:
- Company details → reuses existing `CompanyDetailsDialog` content as an inline section
- Venue and media → `PhotoGallerySection` + new portfolio/video/meeting-contact fields
- Services and pricing → existing services UI (to be tab-ified in Stage 2)
- Event types / Sessions / Confirmation message → existing components, scoped to this company
- Discount rules → moved here per-company (Stage 3 expands it)

## Stage 2 — New fields and tabbed services

- **Company details additions**: phone vs WhatsApp split, "Not GST registered" toggle, bank name, account holder name, Google review URL with Test button, Google Maps Test button, white-logo auto-generate, event coordinators repeater (name + phone + WhatsApp).
- **Venue and media additions**: portfolio link (+ Test), video tour link (+ Test), meeting contact name+phone, "Include photos in requirements message" toggle, "Include portfolio in day-5 follow-up" toggle.
- **Services and pricing**: convert to tabbed UI. Default tabs: Hall rental, Extra rooms, Decoration and setup, Food and catering, Utility and operational. "+ Add service tab" and per-tab delete. Inside each tab: name, base price, complimentary rooms, duration, timing window, additional charges textarea. Collapsible subsections for extra rooms / decoration / food / utility.

DB columns / JSON shape to add on `companies`: `company_phone_separate`, `not_gst_registered`, `bank_name`, `account_holder_name`, `google_review_url`, `event_coordinators` jsonb, `portfolio_url`, `video_tour_url`, `meeting_contact_name`, `meeting_contact_phone`, `include_photos_in_requirements`, `include_portfolio_in_day5`, `services_v2` jsonb (tabbed structure).

## Stage 3 — Per-company Discount rules + global Discount rules sidebar item

Per-company section (inside each company page):
- Staff max % (default 5), Admin max % (default 15), Super admin unlimited (locked), Require reason toggle (default ON).
- Quotation-send permission list: every staff in this company with ON/OFF toggle. Summary: "X staff can send quotations directly."

Global Discount rules sidebar item (when no company selected) shows the same matrix across companies for quick auditing — read-only summary with deep-links into each company's section.

---

## Technical notes
- New route: `src/routes/_app/settings.company.$companyId.tsx` (TanStack flat-dot routing).
- Sidebar `SECTIONS` array slimmed to the 8 items; remove `companyTab` switcher.
- Stage 2 & 3 require a migration (new columns + jsonb) — I'll surface the SQL when we get there.
- All existing components stay; they just get re-parented under the per-company page.

Reply **"go"** to start Stage 1, or tell me to merge/reorder stages.