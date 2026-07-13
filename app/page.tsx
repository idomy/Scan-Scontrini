"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { CATEGORIES, type Category, type ExtractedReceipt, type ReceiptRow } from "@/lib/types";

const CATEGORY_LABEL: Record<Category, string> = {
  alimentari: "🛒 Alimentari",
  ristorante: "🍝 Ristorante",
  trasporti: "🚗 Trasporti",
  salute: "💊 Salute",
  casa: "🏠 Casa",
  abbigliamento: "👕 Abbigliamento",
  svago: "🎉 Svago",
  altro: "📎 Altro",
};

const eur = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

/** Ridimensiona l'immagine client-side (max 1600px) per contenere il payload. */
async function toResizedBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg" };
}

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [draft, setDraft] = useState<ExtractedReceipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadReceipts = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("receipts")
      .select("*")
      .order("receipt_date", { ascending: false, nullsFirst: false })
      .limit(100);
    if (!error && data) setReceipts(data as ReceiptRow[]);
  }, []);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  async function handleFile(file: File) {
    setError(null);
    setDraft(null);
    setPreview(URL.createObjectURL(file));
    setExtracting(true);
    try {
      const { base64, mimeType } = await toResizedBase64(file);
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Errore di estrazione");
      setDraft(json as ExtractedReceipt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExtracting(false);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const { error } = await getSupabase().from("receipts").insert({
      merchant: draft.esercente,
      receipt_date: draft.data,
      total: draft.totale,
      currency: draft.valuta ?? "EUR",
      payment_method: draft.metodo_pagamento,
      category: draft.categoria,
      items: draft.voci,
      raw_text: draft.testo_completo,
    });
    setSaving(false);
    if (error) {
      setError("Salvataggio fallito: " + error.message);
      return;
    }
    setDraft(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
    loadReceipts();
  }

  async function deleteReceipt(id: string) {
    await getSupabase().from("receipts").delete().eq("id", id);
    loadReceipts();
  }

  const total = receipts.reduce((s, r) => s + (r.total ?? 0), 0);
  const byCategory = receipts.reduce<Record<string, number>>((acc, r) => {
    const c = r.category ?? "altro";
    acc[c] = (acc[c] ?? 0) + (r.total ?? 0);
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">🧾 Scan Scontrini</h1>
        <p className="mt-1 text-sm text-stone-500">
          Fotografa uno scontrino: l&apos;AI estrae i dati, tu confermi, la spesa è tracciata.
        </p>
      </header>

      {/* Upload */}
      <section
        className="rounded-2xl border-2 border-dashed border-stone-300 bg-white p-8 text-center transition hover:border-stone-400"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f?.type.startsWith("image/")) handleFile(f);
        }}
      >
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Anteprima scontrino" className="mx-auto max-h-64 rounded-lg shadow" />
        ) : (
          <p className="text-stone-400">Trascina qui la foto di uno scontrino</p>
        )}
        <button
          onClick={() => fileInput.current?.click()}
          disabled={extracting}
          className="mt-4 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50"
        >
          {extracting ? "Estrazione in corso…" : preview ? "Scegli un'altra foto" : "📷 Carica o scatta"}
        </button>
      </section>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {/* Revisione dati estratti */}
      {draft && (
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Verifica i dati estratti
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <label className="col-span-2 text-sm">
              <span className="mb-1 block text-stone-500">Esercente</span>
              <input
                className="w-full rounded-lg border border-stone-300 px-3 py-2"
                value={draft.esercente ?? ""}
                onChange={(e) => setDraft({ ...draft, esercente: e.target.value || null })}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">Data</span>
              <input
                type="date"
                className="w-full rounded-lg border border-stone-300 px-3 py-2"
                value={draft.data ?? ""}
                onChange={(e) => setDraft({ ...draft, data: e.target.value || null })}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">Totale (€)</span>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-lg border border-stone-300 px-3 py-2"
                value={draft.totale ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, totale: e.target.value === "" ? null : parseFloat(e.target.value) })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">Categoria</span>
              <select
                className="w-full rounded-lg border border-stone-300 px-3 py-2"
                value={draft.categoria}
                onChange={(e) => setDraft({ ...draft, categoria: e.target.value as Category })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-stone-500">Pagamento</span>
              <input
                className="w-full rounded-lg border border-stone-300 px-3 py-2"
                value={draft.metodo_pagamento ?? ""}
                onChange={(e) => setDraft({ ...draft, metodo_pagamento: e.target.value || null })}
              />
            </label>
          </div>

          {draft.voci.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-stone-500">
                {draft.voci.length} voci rilevate
              </summary>
              <ul className="mt-2 divide-y divide-stone-100">
                {draft.voci.map((v, i) => (
                  <li key={i} className="flex justify-between py-1.5">
                    <span>{v.descrizione}</span>
                    <span className="tabular-nums text-stone-500">{eur(v.prezzo)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={saveDraft}
              disabled={saving}
              className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {saving ? "Salvataggio…" : "✓ Salva spesa"}
            </button>
            <button
              onClick={() => {
                setDraft(null);
                setPreview(null);
              }}
              className="rounded-full px-4 py-2.5 text-sm text-stone-500 hover:text-stone-800"
            >
              Annulla
            </button>
          </div>
        </section>
      )}

      {/* Dashboard */}
      {receipts.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Le tue spese
            </h2>
            <span className="text-lg font-bold tabular-nums">{eur(total)}</span>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, sum]) => (
                <span
                  key={cat}
                  className="rounded-full bg-stone-200/70 px-3 py-1 text-xs font-medium text-stone-700"
                >
                  {CATEGORY_LABEL[cat as Category] ?? cat} · {eur(sum)}
                </span>
              ))}
          </div>

          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white">
            {receipts.map((r) => (
              <li key={r.id} className="group flex items-center gap-3 px-4 py-3">
                <span className="text-lg">
                  {(CATEGORY_LABEL[r.category as Category] ?? "📎").split(" ")[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.merchant ?? "Sconosciuto"}</p>
                  <p className="text-xs text-stone-400">
                    {r.receipt_date
                      ? new Date(r.receipt_date + "T00:00:00").toLocaleDateString("it-IT")
                      : "data n/d"}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{eur(r.total)}</span>
                <button
                  onClick={() => deleteReceipt(r.id)}
                  aria-label="Elimina"
                  className="ml-1 text-stone-300 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-12 text-center text-xs text-stone-400">
        MVP demo — Next.js · Supabase · Claude vision
      </footer>
    </main>
  );
}
