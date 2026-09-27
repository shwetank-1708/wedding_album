BEGIN;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_event_public_setting()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE owner_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT NEW.is_public THEN RETURN NEW; END IF;
    owner_id := NEW.created_by;
  ELSE
    IF NEW.is_public IS NOT DISTINCT FROM OLD.is_public THEN RETURN NEW; END IF;
    owner_id := OLD.created_by;
  END IF;
  IF auth.uid() IS NULL OR NOT (COALESCE(owner_id = auth.uid()::text, false) OR COALESCE(owner_id = auth.jwt()->>'email', false)) THEN
    RAISE EXCEPTION 'Only the event creator can change public viewing' USING ERRCODE = '42501';
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    RAISE EXCEPTION 'Sub-galleries inherit public viewing from their parent event';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_event_public_setting ON public.events;
CREATE TRIGGER guard_event_public_setting BEFORE INSERT OR UPDATE OF is_public ON public.events
FOR EACH ROW EXECUTE FUNCTION public.guard_event_public_setting();

CREATE OR REPLACE FUNCTION public.set_event_public_viewing(event_id text, public_viewing boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE event_row public.events%ROWTYPE;
BEGIN
  SELECT * INTO event_row FROM public.events WHERE id = event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF auth.uid() IS NULL OR NOT (COALESCE(event_row.created_by = auth.uid()::text, false) OR COALESCE(event_row.created_by = auth.jwt()->>'email', false)) THEN
    RAISE EXCEPTION 'Only the event creator can change public viewing' USING ERRCODE = '42501';
  END IF;
  IF event_row.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Change visibility on the parent event'; END IF;
  IF public_viewing IS NULL THEN RAISE EXCEPTION 'Visibility is required'; END IF;
  UPDATE public.events SET is_public = public_viewing WHERE id = event_id;
  RETURN public_viewing;
END $$;
REVOKE ALL ON FUNCTION public.set_event_public_viewing(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_public_viewing(text, boolean) TO authenticated;
COMMIT;
