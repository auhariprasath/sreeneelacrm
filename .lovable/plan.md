## Goal

Split today's single "Confirm booking" step into four explicit steps: **Generate invoice → Send invoice → Mark payment received (with method picker) → Send confirmation message**. The existing advanced dialog (instalments, 50% advance, cheque) is kept as an "Advanced" option for cases that need it.

## Data model

Reuse `quotations` as the invoice (no new table). Add columns:
- `invoice_generated_at timestamptz`
- `invoice_number text` (auto, e.g. `INV-2026-0001` per company)
- `invoice_sent_at timestamptz`
- `selected_payment_method text` ('cash' | 'cheque' | 'bank_transfer' | 'upi' | 'razorpay')

Add enum values to `payment_type`: `bank_transfer`, `upi`, `razorpay` (kept as label only — no real Razorpay link generation in this turn).

No schema change to bookings/payments — booking is still created on "Payment received", with `status='confirmed'`, `amount_paid = total`, single payment row of selected method.

## Public invoice page

New route `src/routes/invoice.$token.tsx` (token is the existing `quotations.public_token`, only resolves when `invoice_generated_at IS NOT NULL`). Mirrors `quotation.$token.tsx` look but read-only with a Download PDF button. New public server fn `getInvoiceByToken` in `src/lib/api/quotations-public.functions.ts`.

## UI changes on lead profile (`src/routes/_app/leads.$leadId.tsx`)

For an approved quotation (status `agreed`) the action area on the quotation card becomes:

```text
[ before invoice generated ]   → primary: "Generate invoice"   secondary: "Advanced…" (opens existing BookingConfirmDialog)
[ invoice generated, not sent ] → primary: "Send invoice"      shows "Invoice INV-… ready"
[ invoice sent, no booking ]    → payment-status sub-card (see below)
[ booking exists ]              → existing booking card
```

The new **payment-status sub-card** under a sent invoice shows:
- Status row: `Payment not yet received` (amber dot)
- Selected method chip + "Change method" button (Cash | Cheque | Bank transfer | UPI | Razorpay link)
- Primary button: **Payment received**

"Payment received" opens `PaymentReceivedDialog` → method picker (pre-selected to selected_payment_method) + optional transaction ref / cheque fields → on submit:
1. create `bookings` row (status `confirmed`, amount_paid = total, balance_due = 0)
2. create `payments` row (status `received`)
3. confirm slot, lock lead, generate tasks (reuse logic from `BookingConfirmDialog`)
4. open `ConfirmationMessageDialog` automatically

`ConfirmationMessageDialog` shows an editable textarea pre-filled with booking ref, event details, amount, and the public invoice URL. Send button opens `buildWaMeLink(...)` in a new tab and stamps `confirmation_sent_at`.

## New files
- `src/components/quotations/generate-invoice-button.tsx` — handles "Generate invoice" + "Send invoice" actions, owns invoice number assignment & wa.me send.
- `src/components/bookings/payment-received-dialog.tsx` — method picker, creates booking + payment + tasks.
- `src/components/bookings/confirmation-message-dialog.tsx` — editable preview, wa.me send.
- `src/components/bookings/invoice-payment-card.tsx` — the post-send "payment-status" sub-card (status, change-method, Payment received button).
- `src/routes/invoice.$token.tsx` — public invoice viewer.

## Edited files
- `src/lib/api/quotations-public.functions.ts` — add `getInvoiceByToken`.
- `src/routes/_app/leads.$leadId.tsx` — swap action buttons, render `InvoicePaymentCard` between quotation and booking cards, wire new dialogs. Keep `BookingConfirmDialog` reachable via "Advanced…" menu.
- `src/integrations/supabase/types.ts` — regenerated after migration.

## Migrations
1. `ALTER TYPE payment_type ADD VALUE 'bank_transfer'`, `'upi'`, `'razorpay'`.
2. `ALTER TABLE quotations ADD COLUMN invoice_generated_at timestamptz, invoice_number text, invoice_sent_at timestamptz, selected_payment_method text;`

No RLS changes (existing quotations policies cover the new columns; public read continues via `public_token` server fn).

## Out of scope
- Real Razorpay link creation (just a method label, per your answer).
- A separate `invoices` table.
- Replacing the existing `BookingConfirmDialog` — it stays as the "Advanced" path for instalments / partial advance / cheque-clearing.
