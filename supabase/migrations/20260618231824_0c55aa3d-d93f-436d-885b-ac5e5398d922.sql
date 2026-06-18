CREATE OR REPLACE FUNCTION public.get_my_queue_status()
RETURNS TABLE (
  entry_id UUID,
  facility_id UUID,
  facility_name TEXT,
  service TEXT,
  status queue_status,
  is_emergency BOOLEAN,
  checked_in_at TIMESTAMPTZ,
  booked_for TIMESTAMPTZ,
  queue_position INT,
  people_ahead INT,
  total_waiting INT,
  est_wait_minutes INT,
  norm_wait_minutes INT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e RECORD;
  ahead INT;
  total INT;
  f RECORD;
BEGIN
  SELECT * INTO e FROM public.queue_entries q
  WHERE q.patient_id = auth.uid()
    AND q.status IN ('waiting','in_service')
    AND q.checked_in_at IS NOT NULL
  ORDER BY q.checked_in_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO f FROM public.facilities WHERE id = e.facility_id;

  SELECT count(*) INTO ahead FROM public.queue_entries q
  WHERE q.facility_id = e.facility_id AND q.status = 'waiting' AND q.checked_in_at IS NOT NULL
    AND (
      (q.is_emergency AND NOT e.is_emergency)
      OR (q.is_emergency = e.is_emergency AND q.checked_in_at < e.checked_in_at)
    );

  SELECT count(*) INTO total FROM public.queue_entries q
  WHERE q.facility_id = e.facility_id AND q.status = 'waiting' AND q.checked_in_at IS NOT NULL;

  RETURN QUERY SELECT
    e.id, e.facility_id, f.name, e.service, e.status, e.is_emergency,
    e.checked_in_at, e.booked_for,
    (ahead + 1)::INT, ahead::INT, total::INT,
    (ahead * f.avg_service_minutes)::INT, f.norm_wait_minutes;
END;
$$;