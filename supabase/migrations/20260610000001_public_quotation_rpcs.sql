-- Public quotation RPCs (SECURITY DEFINER — run with owner privileges, no service role key needed)
-- These allow the public /quotation/:token page to work without requiring SUPABASE_SERVICE_ROLE_KEY.

-- ─── 1. READ quotation by public token ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_quotation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id        uuid;
  v_lead_id   uuid;
  v_req_id    uuid;
  v_comp_id   uuid;
BEGIN
  SELECT id, lead_id, requirement_id, company_id
    INTO v_id, v_lead_id, v_req_id, v_comp_id
    FROM quotations
   WHERE public_token = p_token
     AND deleted_at IS NULL;

  IF v_id IS NULL THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'quote',
      (SELECT to_jsonb(q) FROM quotations q WHERE q.id = v_id),
    'lead',
      (SELECT jsonb_build_object(
          'id', id, 'full_name', full_name, 'phone', phone
        ) FROM leads WHERE id = v_lead_id),
    'requirement',
      (SELECT jsonb_build_object(
          'id', id, 'event_type', event_type, 'event_date', event_date,
          'start_time', start_time, 'end_time', end_time, 'guest_count', guest_count
        ) FROM requirements WHERE id = v_req_id),
    'company',
      (SELECT jsonb_build_object(
          'id', id, 'name', name, 'logo_url', logo_url, 'wa_number', wa_number,
          'email', email, 'address', address, 'default_room', default_room,
          'payment_method', payment_method, 'full_address', full_address,
          'cancellation_policy', cancellation_policy
        ) FROM companies WHERE id = v_comp_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_quotation(text) TO anon, authenticated;

-- ─── 2. MARK viewed ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_public_quotation_viewed(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q record;
  v_is_first boolean;
BEGIN
  SELECT id, lead_id, version, viewed_at, view_count, created_by
    INTO v_q
    FROM quotations
   WHERE public_token = p_token;

  IF v_q.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  v_is_first := v_q.viewed_at IS NULL;

  UPDATE quotations SET
    viewed_at  = COALESCE(v_q.viewed_at, now()),
    view_count = COALESCE(v_q.view_count, 0) + 1
  WHERE id = v_q.id;

  INSERT INTO activity_logs (lead_id, action, action_type, performed_by, metadata)
  VALUES (
    v_q.lead_id,
    CASE WHEN v_is_first
      THEN 'Quotation v' || v_q.version || ' viewed by client'
      ELSE 'Quotation v' || v_q.version || ' re-opened by client'
    END,
    'system',
    NULL,
    jsonb_build_object('quotation_id', v_q.id, 'view_count', COALESCE(v_q.view_count, 0) + 1)
  );

  IF v_is_first AND v_q.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, lead_id)
    VALUES (
      v_q.created_by,
      'Quotation viewed',
      'Client opened quotation v' || v_q.version,
      'system',
      v_q.lead_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_public_quotation_viewed(text) TO anon, authenticated;

-- ─── 3. APPROVE quotation ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_public_quotation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q record;
BEGIN
  SELECT id, lead_id, version, status, created_by, total
    INTO v_q
    FROM quotations
   WHERE public_token = p_token;

  IF v_q.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF v_q.status = 'agreed' THEN RETURN jsonb_build_object('ok', true, 'already', true); END IF;

  UPDATE quotations SET
    status      = 'agreed',
    agreed_at   = now(),
    approved_at = now()
  WHERE id = v_q.id;

  INSERT INTO activity_logs (lead_id, action, action_type, performed_by, metadata)
  VALUES (
    v_q.lead_id,
    'Client APPROVED quotation v' || v_q.version || ' via public link',
    'status_change',
    NULL,
    jsonb_build_object('quotation_id', v_q.id)
  );

  IF v_q.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, lead_id)
    VALUES (
      v_q.created_by,
      'Quotation approved',
      'Client approved quotation v' || v_q.version || ' — ready to book',
      'system',
      v_q.lead_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_public_quotation(text) TO anon, authenticated;

-- ─── 4. REQUEST CHANGES ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_public_quotation_changes(p_token text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q record;
BEGIN
  SELECT id, lead_id, version, status, created_by
    INTO v_q
    FROM quotations
   WHERE public_token = p_token;

  IF v_q.id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF v_q.status = 'agreed' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_approved'); END IF;

  UPDATE quotations SET status = 'declined' WHERE id = v_q.id;

  INSERT INTO activity_logs (lead_id, action, action_type, performed_by, metadata)
  VALUES (
    v_q.lead_id,
    'Client requested CHANGES on quotation v' || v_q.version,
    'status_change',
    NULL,
    jsonb_build_object('quotation_id', v_q.id, 'note', p_note)
  );

  IF v_q.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type, lead_id)
    VALUES (
      v_q.created_by,
      'Client requested changes',
      'On quotation v' || v_q.version || ': "' || left(p_note, 140) || '"',
      'system',
      v_q.lead_id
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_public_quotation_changes(text, text) TO anon, authenticated;
