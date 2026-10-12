DO $$ BEGIN CREATE DOMAIN "text/calendar" AS text; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.kalender(token text)
RETURNS "text/calendar"
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid; evs jsonb; e jsonb; out text; st timestamptz; en timestamptz;
  f text := 'YYYYMMDD"T"HH24MISS"Z"';
BEGIN
  IF token IS NULL OR token !~* '^[0-9a-f-]{36}(\.ics)?$' THEN RAISE EXCEPTION 'not found'; END IF;
  token := regexp_replace(token, '\.ics$', '', 'i');
  SELECT user_id INTO uid FROM user_data WHERE key = 'uc-kalender-feed' AND value->>'token' = token LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT value INTO evs FROM user_data WHERE user_id = uid AND key = 'uc-kalender';
  out := E'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//UK Portservice//Avtal//SV\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\nX-WR-CALNAME:UKPS Servicebesök\r\nREFRESH-INTERVAL;VALUE=DURATION:PT1H\r\n';
  IF jsonb_typeof(evs) = 'array' THEN
    FOR e IN SELECT * FROM jsonb_array_elements(evs) LOOP
      CONTINUE WHEN e->>'source' IS DISTINCT FROM 'app' OR coalesce(e->>'start','') = '';
      BEGIN st := (e->>'start')::timestamptz; EXCEPTION WHEN others THEN CONTINUE; END;
      BEGIN en := coalesce((e->>'end')::timestamptz, st + interval '1 hour'); EXCEPTION WHEN others THEN en := st + interval '1 hour'; END;
      out := out || E'BEGIN:VEVENT\r\nUID:' || (e->>'id') || '@ukportservice' ||
        E'\r\nDTSTAMP:' || to_char(now() AT TIME ZONE 'UTC', f) ||
        E'\r\nDTSTART:' || to_char(st AT TIME ZONE 'UTC', f) ||
        E'\r\nDTEND:' || to_char(en AT TIME ZONE 'UTC', f) ||
        E'\r\nSUMMARY:' || regexp_replace(regexp_replace(coalesce(nullif(e->>'title',''),'Besök'), '([,;\\])', '\\\1', 'g'), E'\r?\n', '\\n', 'g') ||
        CASE WHEN coalesce(e->>'place','') <> '' THEN E'\r\nLOCATION:' || regexp_replace(regexp_replace(e->>'place', '([,;\\])', '\\\1', 'g'), E'\r?\n', '\\n', 'g') ELSE '' END ||
        CASE WHEN coalesce(e->>'note','') <> '' THEN E'\r\nDESCRIPTION:' || regexp_replace(regexp_replace(e->>'note', '([,;\\])', '\\\1', 'g'), E'\r?\n', '\\n', 'g') ELSE '' END ||
        E'\r\nBEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Påminnelse\r\nEND:VALARM\r\nEND:VEVENT\r\n';
    END LOOP;
  END IF;
  RETURN out || E'END:VCALENDAR\r\n';
END $$;

REVOKE ALL ON FUNCTION public.kalender(text) FROM public;
GRANT EXECUTE ON FUNCTION public.kalender(text) TO anon, authenticated;