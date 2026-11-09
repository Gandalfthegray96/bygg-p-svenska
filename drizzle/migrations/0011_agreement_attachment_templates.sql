CREATE TABLE public.agreement_attachment_templates (
  slot text PRIMARY KEY CHECK (slot IN ('cost', 'price')),
  file jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreement_attachment_templates TO authenticated;
GRANT ALL ON public.agreement_attachment_templates TO service_role;
ALTER TABLE public.agreement_attachment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles read attachment templates" ON public.agreement_attachment_templates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "admin insert attachment templates" ON public.agreement_attachment_templates FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update attachment templates" ON public.agreement_attachment_templates FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete attachment templates" ON public.agreement_attachment_templates FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles read attachment PDFs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avtal-bilagor' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "admin upload attachment PDFs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avtal-bilagor' AND public.has_role(auth.uid(), 'admin'));