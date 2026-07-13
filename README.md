# 🧾 Scan Scontrini

MVP costruito per la candidatura Mamazen. Fotografi uno scontrino, l'AI (Claude vision) estrae i dati strutturati in JSON, tu verifichi e confermi, la spesa finisce su Supabase con una mini dashboard per categoria.

**Demo live:** _[inserire link Vercel]_
**Tempo impiegato:** _[inserire, es. ~3 ore con Claude Code]_

## Come funziona

1. Upload o foto dello scontrino → ridimensionata client-side (max 1600px) per contenere il payload.
2. `POST /api/scan` (route handler Next.js, server-side): chiama l'API Anthropic (claude-sonnet-4-5, vision) con un prompt a schema JSON rigido — categorie enum, `null` se illeggibile, mai valori inventati.
3. Il parsing ha fallback progressivi (strip code fence → regex sul blocco JSON) e una normalizzazione dei tipi (numeri, date, categoria validata contro l'enum).
4. L'utente rivede e corregge i campi estratti prima del salvataggio: l'AI propone, l'umano conferma.
5. Salvataggio su Supabase (Postgres) e dashboard con totale e ripartizione per categoria.

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS 4 · Supabase (Postgres + RLS) · Anthropic API (vision OCR) · Vercel.

## Setup

1. **Supabase**: crea un progetto, esegui `supabase/schema.sql` nel SQL Editor.
2. **Env**: copia `.env.example` in `.env.local` e compila (URL + anon key Supabase, chiave Anthropic).
3. **Run**: `npm install && npm run dev`
4. **Deploy**: importa il repo su Vercel e imposta le stesse 3 env var. La chiave Anthropic resta solo server-side.

## Scelte e limiti (scope MVP)

- **Niente auth**: demo single-user; RLS è abilitata con policy permissive documentate nello schema. In produzione: Supabase Auth + policy per `user_id`.
- **Niente storage delle immagini**: si salva solo il dato estratto + la trascrizione integrale (`raw_text`) per verifica umana a posteriori.
- **Un solo modello**: per scontrini la pipeline a singolo passaggio vision→JSON regge; con documenti più complessi separerei estrazione e classificazione.
