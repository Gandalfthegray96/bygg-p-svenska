<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Avtalsflödet: beräkning i src/lib/kalkyl.ts, dokumentet i src/components/avtal/Preview.tsx (PDF via webbläsarens utskrift), Excel via xlsx i src/lib/excel.ts, versioner i localStorage (src/lib/avtal-store.ts) — enkelt offline tills molnet aktiveras.
- Kalkylmodell: calculate() räknar pris per servicebesök — besök k omfattar objekt med ≥ k besök/år (besök/år per objekt, 1–12); framkörning per påbörjad 8 h per besök (ett avtal = en adress), rabatt bara på arbete, utjämning på varje besök. UI, PDF, mejl och Excel använder samma calculate().
- The cover is rendered by the shared CoverPreview component in both its editor tab and the printable agreement so both views always match.

- All app UI uses semantic tokens and shared Button variants with the ds-* visual vocabulary in src/styles.css; keep original document/Excel styles isolated to prevent brand changes altering customer originals.
