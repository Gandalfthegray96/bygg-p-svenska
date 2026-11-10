import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiMsg = { role: "user" | "assistant"; content: string };

const SYSTEM = `Du är "UK-assistenten", en kunnig kollega på UK Portservice som säljer förebyggande underhållsavtal för portar och grindar.
Svara alltid på svenska, kort, konkret och professionellt. Använd markdown sparsamt (listor, fetstil).
Affärsregler: timpris 975 kr/h, framkörning 745 kr per påbörjad 8 h arbete per besök, ett avtal = en adress, avtalstid 5 år.
Rabatt gäller bara arbetskostnaden, aldrig framkörningen. Utjämning läggs på varje besök. Besök k omfattar objekt med minst k besök/år.
Självkostnad: 508 kr/h arbete och 350 kr per framkörning (50 km × 7 kr). Täckningsbidrag = intäkt − självkostnad.
Interna noteringar på objekt får ALDRIG nämnas i kundtexter. Hitta aldrig på siffror – använd bara data i kontexten och säg när något saknas.`;

export const askAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: AiMsg[]; context: string }) => {
    if (!Array.isArray(d.messages) || !d.messages.length) throw new Error("Inga meddelanden");
    return { messages: d.messages.slice(-30).map((m) => ({ role: m.role === "assistant" ? "assistant" as const : "user" as const, content: String(m.content).slice(0, 8000) })), context: String(d.context ?? "").slice(0, 60000) };
  })
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { text: "", error: "AI är inte konfigurerad (LOVABLE_API_KEY saknas på servern)." };
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText } = await import("ai");
    let runId: string | undefined;
    const openai = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: async (input, init) => {
        const h = new Headers(init?.headers);
        if (runId) h.set("X-Lovable-AIG-Run-ID", runId);
        const r = await fetch(input, { ...init, headers: h });
        runId ??= r.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
        return r;
      },
    });
    let err: string | null = null;
    try {
      const result = streamText({
        model: openai.responses("openai/gpt-6-astra"),
        system: `${SYSTEM}\n\n### Kontext från appen\n${data.context || "(ingen)"}`,
        messages: data.messages,
        maxRetries: 0,
        providerOptions: { openai: { forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
        onError: ({ error }) => { err = error instanceof Error ? error.message : String(error); },
      });
      const text = await result.text;
      if (!text && err) throw new Error(err);
      return { text, error: null as string | null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("askAi", msg);
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 429) return { text: "", error: "AI:n är tillfälligt överbelastad, försök igen om en stund." };
      if (status === 402 || status === 403) return { text: "", error: "AI-krediterna är slut eller AI är spärrad för arbetsytan." };
      return { text: "", error: "AI:n kunde inte svara just nu." };
    }
  });
