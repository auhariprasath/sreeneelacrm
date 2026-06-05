# Super Admin Dashboard Redesign

A full rebuild of `src/routes/_app/dashboard.tsx` for super admin only. Existing dashboard stays as the fallback for admin/staff. Shipped in 4 stages so each piece lands working and reviewable.

## Scope guard

- Super admin only. Admin/staff continue to see the current dashboard untouched.
- Pure presentation + data fetching. No schema changes except a small `companies.brand_color` column (used as the "company colour" everywhere).
- All sections live in one route: `/dashboard` (conditional render when `role === "super_admin"`).

## Stage 1 — Foundation + Calendar + Stats + Alerts

**1. Migration**
- Add `companies.brand_color text default '#6366f1'`.
- Settings → company details: color picker writes to this field.

**2. New route layout** (`src/routes/_app/dashboard.tsx`)
Conditional: if super_admin → render `<SuperAdminDashboard />`, else existing dashboard.

**3. Section 1 — Combined calendar** (`src/components/dashboard/combined-calendar.tsx`)
- Month grid (custom, not shadcn calendar — need dot stacks per day).
- Loads `bookings` (confirmed, current month ± buffer) joined with `companies(brand_color, name)` and `leads(full_name)`.
- Each day cell: up to 4 stacked dots in company colours, "+N" if more.
- Hover (desktop) / tap (mobile) on a dot → popover with client, event type, time, company.
- Tap a date → drawer with that day's bookings grouped by time slot.
- Realtime: subscribe to `bookings` changes → refetch month.

**4. Section 2 — Stats row** (4 clickable cards)
- Revenue this month: sum `payments.amount` where `created_at` in month, status paid.
- New enquiries: count `leads` created this month.
- Bookings: count `bookings` confirmed this month.
- Conversion rate: won / (won + lost) from `win_loss_log` this month.
- Each card is a `<Link>` to filtered list route.

**5. Section 3 — Emergency alerts**
- Query: bookings where `status='confirmed'`, `confirmed_at < now()-24h`, `coordinator_user_id is null` (use existing assigned-to field on bookings).
- Red cards, non-dismissable, tap → `/leads/$leadId`.

## Stage 2 — Per-company panels

**Section 4** — `<CompanyPanel companyId />` rendered once per company.

- Tabs: Overview | Pending works.
- **Overview tab**: small bar chart for leads-this-month (recharts), plus 4 stat tiles (meetings, bookings, revenue, task completion %). Each tile/bar links to filtered list.
- **Pending works tab**: 4 horizontally scrollable columns:
  - Leads needing action (uncontacted, overdue follow-up, no reply tags)
  - Quotations pending (sent + no reply, expired, revision requested)
  - Confirmed bookings with task progress bars
  - Upcoming events next 14 days (date, client, coordinator status, stage)
- Each row → tap opens lead/booking.
- Realtime: per-company channel on leads/bookings/tasks/quotations.

## Stage 3 — Post-event + Right panel

**Section 5** — Post-event panel
- Feedback pending count (completed events with no feedback row).
- Feedback received count.
- Rating distribution bar chart (group `feedback.rating`).
- List below: pending feedback rows with WhatsApp send button (`wa.me/<phone>?text=<prefilled>`).

**Section 6** — Right panel desktop / bottom tabs mobile (`useIsMobile`)
- Call backs due (overdue red first, then today).
- Upcoming tasks (due within 48h).
- Pending quotations (sent awaiting response, days since sent).
- Overdue (calls + tasks combined).
- All items tappable, action buttons (dial: `tel:`, follow up, etc.).

## Stage 4 — Realtime polish

- Single shared `useDashboardRealtime(companyIds)` hook wires postgres_changes for: leads, bookings, tasks, slots, quotations, payments, feedback, follow_ups, venue_meetings.
- Uses React Query `invalidateQueries` per affected key so all sections refresh in lockstep with no full reloads.
- Smoke test on preview: change a booking status in DB, confirm calendar dot + stats + company panel all update.

## Technical notes

- Charts: `recharts` (already supported via `src/components/ui/chart.tsx`).
- Data fetching: React Query with one query per section, keyed by `[section, companyId, monthKey]`.
- Mobile: stack everything vertically; right panel becomes a sticky bottom tab bar.
- No new tables, only `companies.brand_color` column. Everything else is reads against existing schema.

---

Reply **"go"** to start Stage 1 (migration + calendar + stats + alerts). I'll stop after each stage for review before continuing.
