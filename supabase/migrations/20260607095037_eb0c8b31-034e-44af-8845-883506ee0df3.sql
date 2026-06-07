-- Add new payment method enum values
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'bank_transfer';
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'upi';
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'razorpay';

-- Add invoice tracking columns on quotations
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS invoice_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS selected_payment_method text;