CREATE TABLE public.avtal_register (
  name text PRIMARY KEY,
  folder jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avtal_register TO authenticated;
GRANT ALL ON public.avtal_register TO service_role;
ALTER TABLE public.avtal_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles read" ON public.avtal_register FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "sales insert" ON public.avtal_register FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'saljare'));
CREATE POLICY "sales update" ON public.avtal_register FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'saljare'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'saljare'));
CREATE POLICY "sales delete" ON public.avtal_register FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'saljare'));

INSERT INTO public.avtal_register (name, folder, updated_at, updated_by)
SELECT DISTINCT ON (e.key) e.key, e.value, d.updated_at, d.user_id
FROM public.user_data d, jsonb_each(CASE WHEN jsonb_typeof(d.value)='object' THEN d.value ELSE '{}'::jsonb END) e
WHERE d.key = 'uc-avtal-store'
ORDER BY e.key, d.updated_at DESC
ON CONFLICT (name) DO NOTHING;