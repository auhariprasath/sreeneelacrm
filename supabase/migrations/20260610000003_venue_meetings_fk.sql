-- Add missing foreign key constraints on venue_meetings so PostgREST
-- can resolve the leads!inner join used in the venue-meetings page.
ALTER TABLE public.venue_meetings
  ADD CONSTRAINT venue_meetings_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

ALTER TABLE public.venue_meetings
  ADD CONSTRAINT venue_meetings_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
