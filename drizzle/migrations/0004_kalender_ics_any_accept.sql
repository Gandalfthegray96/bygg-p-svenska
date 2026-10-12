DO $$ BEGIN CREATE DOMAIN "*/*" AS bytea; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.kalender_ics(token text)
RETURNS "*/*"
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM set_config('response.headers', '[{"Content-Type":"text/calendar; charset=utf-8"},{"Cache-Control":"no-store"}]', true);
  RETURN convert_to(public.kalender(token)::text, 'UTF8');
END $$;

REVOKE ALL ON FUNCTION public.kalender_ics(text) FROM public;
GRANT EXECUTE ON FUNCTION public.kalender_ics(text) TO anon, authenticated;