
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  total_events integer NOT NULL DEFAULT 1,
  first_event_date date,
  last_event_date date,
  lifetime_value numeric NOT NULL DEFAULT 0,
  avg_rating numeric,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, phone)
);

CREATE INDEX idx_customers_company ON public.customers(company_id);
CREATE INDEX idx_customers_lead ON public.customers(lead_id);
CREATE INDEX idx_customers_phone ON public.customers(phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company view customers" ON public.customers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR company_id = public.current_company_id());
CREATE POLICY "company insert customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin') OR company_id = public.current_company_id());
CREATE POLICY "company update customers" ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR company_id = public.current_company_id());
CREATE POLICY "company delete customers" ON public.customers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin') OR company_id = public.current_company_id());

CREATE TRIGGER touch_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER TABLE public.customers REPLICA IDENTITY FULL;

-- Trigger: on booking marked completed, upsert customer
CREATE OR REPLACE FUNCTION public.sync_customer_on_booking_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_existing RECORD;
  v_total integer;
  v_ltv numeric;
  v_first date;
  v_last date;
  v_avg numeric;
  v_tags text[];
BEGIN
  IF NEW.status <> 'completed' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN RETURN NEW; END IF;

  SELECT full_name, phone INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
  IF v_lead.phone IS NULL THEN RETURN NEW; END IF;

  -- Aggregate over ALL completed bookings for this lead
  SELECT COUNT(*)::int,
         COALESCE(SUM(total_amount),0),
         MIN(event_date),
         MAX(event_date)
    INTO v_total, v_ltv, v_first, v_last
    FROM public.bookings
   WHERE lead_id = NEW.lead_id AND status = 'completed' AND deleted_at IS NULL;

  -- Avg rating across feedback for this lead's bookings
  SELECT AVG(f.rating)
    INTO v_avg
    FROM public.feedback f
    JOIN public.bookings b ON b.id = f.booking_id
   WHERE b.lead_id = NEW.lead_id;

  v_tags := ARRAY[]::text[];
  IF v_total >= 2 THEN v_tags := array_append(v_tags, 'returning'); END IF;
  IF v_total >= 3 THEN v_tags := array_append(v_tags, 'vip'); END IF;
  IF v_avg IS NOT NULL AND v_avg >= 4 THEN v_tags := array_append(v_tags, 'promoter'); END IF;

  SELECT * INTO v_existing FROM public.customers
    WHERE company_id = NEW.company_id AND phone = v_lead.phone;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.customers(lead_id, company_id, full_name, phone, total_events, first_event_date, last_event_date, lifetime_value, avg_rating, tags)
    VALUES (NEW.lead_id, NEW.company_id, v_lead.full_name, v_lead.phone, v_total, v_first, v_last, v_ltv, v_avg, v_tags);
  ELSE
    UPDATE public.customers
       SET full_name = v_lead.full_name,
           lead_id = NEW.lead_id,
           total_events = v_total,
           first_event_date = v_first,
           last_event_date = v_last,
           lifetime_value = v_ltv,
           avg_rating = v_avg,
           tags = v_tags
     WHERE id = v_existing.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_customer_on_booking_complete
AFTER INSERT OR UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.sync_customer_on_booking_complete();
