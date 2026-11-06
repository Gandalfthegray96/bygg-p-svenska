CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs select" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own subs insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own subs update" ON public.push_subscriptions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.push_targets(_user_ids uuid[])
RETURNS TABLE(endpoint text, p256dh text, auth text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.endpoint, s.p256dh, s.auth FROM public.push_subscriptions s
  WHERE auth.uid() IS NOT NULL AND s.user_id = ANY(_user_ids) AND s.user_id <> auth.uid();
$$;
REVOKE ALL ON FUNCTION public.push_targets(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.push_targets(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.push_drop(_endpoint text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.push_subscriptions WHERE endpoint = _endpoint AND auth.uid() IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.push_drop(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.push_drop(text) TO authenticated;