export const CATEGORIES = [
  "alimentari",
  "ristorante",
  "trasporti",
  "salute",
  "casa",
  "abbigliamento",
  "svago",
  "altro",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ReceiptItem {
  descrizione: string;
  quantita: number | null;
  prezzo: number | null;
}

/** Output strutturato dell'estrazione OCR (contratto con l'API route). */
export interface ExtractedReceipt {
  esercente: string | null;
  data: string | null; // YYYY-MM-DD
  totale: number | null;
  valuta: string | null;
  metodo_pagamento: string | null;
  categoria: Category;
  voci: ReceiptItem[];
  testo_completo: string | null;
}

/** Riga della tabella receipts su Supabase. */
export interface ReceiptRow {
  id: string;
  created_at: string;
  merchant: string | null;
  receipt_date: string | null;
  total: number | null;
  currency: string | null;
  payment_method: string | null;
  category: string | null;
  items: ReceiptItem[];
  raw_text: string | null;
}
