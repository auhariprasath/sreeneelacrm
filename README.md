# Neela Events CRM

A production-grade, multi-tenant CRM built for Indian wedding and event venues. Covers the complete customer lifecycle from lead capture through event execution, payments, and vendor coordination.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Database Schema](#database-schema)
- [Authentication & Authorization](#authentication--authorization)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Scripts](#available-scripts)
- [Public (Unauthenticated) Pages](#public-unauthenticated-pages)
- [Integrations](#integrations)

---

## Overview

Neela Events CRM is a full-stack web application for managing event bookings at banquet halls, gardens, party venues, and mandapams. It supports multiple companies (venues) under a single super admin, with granular role-based access for each company's staff.

**Core business flow:**

```
Lead captured → Requirements collected → Slot checked → Quotation sent
    → Booking confirmed → Payments tracked → Tasks assigned → Event executed
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 19 + TypeScript |
| Router | TanStack Router (file-based) |
| UI Components | Radix UI + Shadcn/ui + Tailwind CSS 4 |
| State / Server State | React Context + TanStack Query 5 |
| Build Tool | Vite 7 (via `@lovable.dev/vite-tanstack-config`) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| PDF Generation | jsPDF |
| QR Codes | qrcode |
| Date Utilities | date-fns |
| Icons | Lucide React |
| Backend / Database | Supabase (PostgreSQL + Auth + Realtime) |
| Edge Functions | Nitro 3 |
| Payment Gateway | Razorpay |
| Notifications | Sonner toast |
| Package Manager | Bun / npm |

---

## Project Structure

```
sreeneelacrm/
├── src/
│   ├── routes/                  # File-based routing (TanStack Router)
│   │   ├── __root.tsx           # App shell — providers (Query, Theme, Auth)
│   │   ├── _app.tsx             # Authenticated layout (sidebar, nav, company selector)
│   │   ├── index.tsx            # Auth gate → /login or /dashboard
│   │   ├── login.tsx            # Email/password + phone OTP login
│   │   └── _app/                # All authenticated pages
│   │       ├── dashboard.tsx
│   │       ├── leads/           # Lead list + detail
│   │       ├── bookings.tsx
│   │       ├── quotations.tsx
│   │       ├── tasks.tsx
│   │       ├── calendar.tsx
│   │       ├── settings.tsx
│   │       └── ...
│   ├── components/              # Feature-grouped React components
│   │   ├── bookings/
│   │   ├── leads/
│   │   ├── quotations/
│   │   ├── tasks/
│   │   ├── dashboard/
│   │   ├── settings/
│   │   └── ui/                  # Shadcn/ui primitives
│   ├── hooks/                   # Custom React hooks
│   ├── lib/
│   │   ├── auth.tsx             # Auth context + useAuth() hook
│   │   ├── api/                 # Supabase query/mutation functions
│   │   ├── utils.ts             # Shared helpers
│   │   ├── pdf.ts               # Invoice + quotation PDF generation
│   │   └── whatsapp.ts          # WhatsApp message templates
│   └── integrations/
│       └── supabase/            # Generated Supabase client + types
├── supabase/
│   ├── migrations/              # PostgreSQL migration files
│   └── functions/               # Edge functions
│       ├── razorpay-create-link/
│       └── razorpay-webhook/
├── public/                      # Static assets, manifest, icons
├── .env                         # Environment variables (not committed)
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

---

## Features

### 1. Dashboard
Real-time overview: new leads today, active leads, confirmed bookings, follow-ups due, upcoming events, task completion %, vendor confirmations, and revenue charts.

### 2. Lead Management
- Lead capture from multiple sources: inbound call, walk-in, referral, portal, manual entry
- Lead scoring: **hot / warm / cold**
- Lead status pipeline: `new → in_progress → positive → negative → closed / unresponsive`
- Blacklist management with reasons
- Activity log: calls, WhatsApp, notes, status changes, re-assignments
- Inter-company transfer requests with approval workflow

### 3. Requirements
- Structured event data: date, time, duration, event type, guest count, budget range
- Muhurtham conflict detection
- Slot reservation: soft-hold → confirmed
- Add-ons and custom service selections
- Requirement sheets for standardised data collection

### 4. Quotations
- Multi-version quotations with services and add-ons
- Configurable discount limits by staff vs. admin level
- GST calculation (configurable per company)
- Peak-season pricing logic
- PDF export, WhatsApp/email sharing
- Status flow: `draft → sent → agreed / revised / declined`

### 5. Bookings
- Status: `confirmed → cheque_pending / rescheduled / completed / cancelled / disputed`
- Payment tracking: full, advance 50%, instalments, cash, cheque, B2B credit
- Cheque clearance workflow
- Tiered refund management based on days from event date

### 6. Payments & Invoices
- Multiple payment methods and statuses
- Configurable payment reminders
- Invoice generation with company GST and bank details
- Public payment proof submission via token-based URLs

### 7. Task Board
- Kanban board: `pending → in_progress → done / overdue`
- Auto-generated tasks from configurable templates on booking creation
- Staff assignment, priority levels (low / medium / high), due dates
- Task replies and notes

### 8. Vendors & Event Day
- Vendor master list (caterers, decorators, DJs, photographers, etc.)
- Booking-vendor assignments with amount, confirmation status, no-show logging
- Vendor ratings and reviews
- Event day log: amendments, complaints, vendor no-shows, force majeure incidents

### 9. Calendar
Month-view of all bookings and events, slot availability checking, rescheduling support.

### 10. Follow-ups
- Scheduled follow-ups with reminder automation
- Multi-attempt tracking
- Today/1-hour auto and custom time scheduling

### 11. Campaigns
- Bulk WhatsApp / SMS campaigns to filtered lead segments
- Segment filters: status, source, score
- Delivery tracking per lead

### 12. Settings
- Company profiles (multiple per super admin, with GST, UPI, bank details)
- Staff and role management
- WhatsApp template management
- Task templates (auto-assigned on booking)
- Vendor list
- Razorpay payment credentials
- Peak season date ranges
- Discount policies and reminder timing

### 13. Reports
Lead conversion metrics, booking statistics, payment receivables.

---

## Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `companies` | Venue profiles — name, type, GST, UPI, bank details, settings |
| `profiles` | User accounts linked to a company and role |
| `user_roles` | Role assignments: `super_admin`, `admin`, `staff` |
| `leads` | Potential customers with source, score, status, blacklist flag |
| `requirements` | Event specifications captured from a lead |
| `quotations` | Pricing proposals with services array, GST, discounts, total |
| `bookings` | Confirmed events with payment and cheque tracking |
| `payments` | Individual payment records |
| `payment_reminders` | Auto-scheduled payment reminder notifications |
| `slots` | Venue time slots with soft-hold / confirmed status |
| `add_ons_selected` | Add-on selections per requirement |
| `activity_logs` | Full audit trail for leads |
| `transfer_requests` | Inter-company lead transfer workflow |
| `notifications` | In-app notifications per user |
| `follow_ups` | Lead follow-up scheduling |
| `tasks` | Pre-event task board entries |
| `vendors` | Vendor master list |
| `booking_vendors` | Booking-to-vendor assignments |
| `event_day_logs` | Issues logged on event day |
| `campaigns` | Bulk messaging campaigns |
| `campaign_leads` | Per-lead delivery tracking for campaigns |

### Key Enums

| Enum | Values |
|---|---|
| `lead_status` | new, in_progress, positive, negative, closed, unresponsive, locked, neutral |
| `lead_score` | hot, warm, cold |
| `booking_status` | confirmed, cheque_pending, rescheduled, completed, cancelled, disputed |
| `quotation_status` | draft, sent, agreed, revised, declined |
| `task_status` | pending, in_progress, done, overdue |
| `payment_type` | full, advance_50, instalment, cash, cheque, b2b_credit |
| `company_type` | garden, banquet, party, mandapam |

Row-Level Security (RLS) is enabled on all tables. Access is filtered by `company_id` and enforced by role.

---

## Authentication & Authorization

- **Provider:** Supabase Auth (email/password + phone OTP)
- **Session:** JWT with refresh tokens, persisted to localStorage
- **Roles:**
  - `super_admin` — manages all companies and their data
  - `admin` — manages one company (staff, settings, full module access)
  - `staff` — limited access within their assigned company
- **Company isolation:** All queries include a `company_id` filter; RLS policies enforce this at the database level.
- **Company switching:** Super admins can switch the active company from the sidebar.

---

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A Supabase project with the migrations applied

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd sreeneelacrm

# Install dependencies
npm install
# or
bun install
```

### Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:8080` (or the port Vite selects).

---

## Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
```

For edge functions, set secrets via the Supabase dashboard:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Production build |
| `npm run build:dev` | Development-mode build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier formatter |

---

## Public (Unauthenticated) Pages

These routes use token-based access and require no login:

| Route | Purpose |
|---|---|
| `/invoice/:token` | View and download invoice PDF |
| `/payment/:token` | Submit payment proof |
| `/quotation/:token` | View quotation |
| `/vendor-status/:token` | Vendor confirmation / status update |
| `/event-status/:token` | Event status tracking |
| `/feedback/:token` | Post-event feedback submission |

---

## Integrations

| Integration | Usage |
|---|---|
| **Supabase Realtime** | Live updates for leads, bookings, notifications |
| **Razorpay** | Payment link creation and webhook handling (edge functions) |
| **WhatsApp** | Message templates for payments, booking confirmations, reschedules, thank-you notes |
| **jsPDF** | Client-side PDF generation for invoices and quotations |
| **qrcode** | QR code generation for payment links |

---

## Responsive Design

- **Desktop:** Full sidebar navigation
- **Tablet:** Hamburger menu
- **Mobile:** Bottom tab navigation bar, sidebar hidden

An offline banner component and PWA manifest are included for progressive web app support.
