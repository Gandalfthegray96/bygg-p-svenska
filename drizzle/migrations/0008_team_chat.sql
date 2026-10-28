CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  avtal_id text,
  avtal_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_created_idx ON public.chat_messages (created_at);
GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat read" ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid())
    AND (recipient_id IS NULL OR sender_id = auth.uid() OR recipient_id = auth.uid()));
CREATE POLICY "chat insert" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid()));
CREATE POLICY "chat delete own" ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE OR REPLACE FUNCTION public.chat_cleanup() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.chat_messages WHERE created_at < now() - interval '12 months';
  RETURN NEW;
END $$;
CREATE TRIGGER chat_cleanup_trg AFTER INSERT ON public.chat_messages
  FOR EACH STATEMENT EXECUTE FUNCTION public.chat_cleanup();

CREATE OR REPLACE FUNCTION public.chat_users()
RETURNS TABLE(id uuid, name text, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.email FROM public.profiles p
  WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id)
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid())
  ORDER BY p.name
$$;
REVOKE EXECUTE ON FUNCTION public.chat_users() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.chat_users() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;