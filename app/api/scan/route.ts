import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES, type ExtractedReceipt } from "@/lib/types";

const VALID_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BASE64_LENGTH = 6_000_000; // ~4.5MB, limite payload Vercel

const PROMPT = `Sei un sistema OCR specializzato in scontrini e ricevute italiane. Analizza l'immagine ed estrai i dati strutturati.

ISTRUZIONI:
1. Estrai tutte le informazioni con la massima accuratezza.
2. Se un campo non è presente o non è leggibile usa null. NON inventare valori.
3. Date in formato YYYY-MM-DD. Importi come numeri (punto decimale), senza simbolo valuta.
4. "categoria" DEVE essere una tra: ${CATEGORIES.join(", ")}.
5. Includi in "voci" ogni riga di prodotto/servizio leggibile.

Rispondi ESCLUSIVAMENTE con JSON valido, senza testo prima o dopo:
{
  "esercente": "nome del negozio/esercente o null",
  "data": "YYYY-MM-DD o null",
  "totale": 0.00,
  "valuta": "EUR",
  "metodo_pagamento": "contanti|carta|bancomat|altro o null",
  "categoria": "una delle categorie indicate",
  "voci": [{ "descrizione": "...", "quantita": 1, "prezzo": 0.00 }],
  "testo_completo": "trascrizione integrale del testo leggibile"
}`;

/** Estrae il primo blocco JSON da una risposta LLM, con fallback progressivi. */
function parseModelJson(raw: string): ExtractedReceipt | null {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Normalizza l'output del modello: tipi coerenti, categoria valida. */
function normalize(data: ExtractedReceipt): ExtractedReceipt {
  const num = (v: unknown): number | null => {
    const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    esercente: data.esercente ?? null,
    data: /^\d{4}-\d{2}-\d{2}$/.test(data.data ?? "") ? data.data : null,
    totale: num(data.totale),
    valuta: data.valuta ?? "EUR",
    metodo_pagamento: data.metodo_pagamento ?? null,
    categoria: CATEGORIES.includes(data.categoria) ? data.categoria : "altro",
    voci: Array.isArray(data.voci)
      ? data.voci.map((v) => ({
          descrizione: String(v.descrizione ?? ""),
          quantita: num(v.quantita),
          prezzo: num(v.prezzo),
        }))
      : [],
    testo_completo: data.testo_completo ?? null,
  };
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY non configurata" }, { status: 500 });
  }

  let body: { image?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body non valido" }, { status: 400 });
  }

  const { image, mimeType } = body;
  if (!image || !mimeType) {
    return NextResponse.json({ error: "Immagine mancante" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(mimeType)) {
    return NextResponse.json({ error: "Formato non supportato (usa JPEG, PNG o WEBP)" }, { status: 400 });
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Immagine troppo grande (max ~4MB)" }, { status: 413 });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mimeType, data: image } },
              { type: "text", text: PROMPT },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Anthropic API error", res.status, detail);
      const msg =
        res.status === 429
          ? "Troppe richieste, riprova tra qualche secondo"
          : "Errore del servizio di estrazione";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const json = await res.json();
    const raw: string = json.content?.[0]?.text ?? "";
    const parsed = parseModelJson(raw);

    if (!parsed) {
      return NextResponse.json(
        { error: "Impossibile estrarre dati dall'immagine. Prova con una foto più nitida." },
        { status: 422 }
      );
    }

    return NextResponse.json(normalize(parsed));
  } catch (e) {
    console.error("scan error", e);
    return NextResponse.json({ error: "Errore interno" }, { status: 500 });
  }
}
