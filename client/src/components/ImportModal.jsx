import { useState } from "react";
import { useApi } from "../hooks/useApi";

function parseDecklist(text) {
  const entries = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || /^[A-Za-z\s]+:$/.test(line)) continue; // skip headers
    const m = line.match(/^(\d+)\s+(.+)$/);
    if (m) entries.push({ qty: parseInt(m[1]), name: m[2].trim() });
  }
  return entries;
}

export default function ImportModal({ onClose, onImport, mode /* "library" | "deck" */ }) {
  const api = useApi();
  const [text, setText] = useState("");
  const [step, setStep] = useState("input"); // input | preview | done
  const [results, setResults] = useState([]); // [{name, qty, card, ambiguous}]
  const [overrides, setOverrides] = useState({}); // name → chosen card index
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState(null);

  const parse = async () => {
    const entries = parseDecklist(text);
    if (!entries.length) return;

    const names = [...new Set(entries.map((e) => e.name))];
    const raw = await api.post("/cards/import", { names });

    const byName = Object.fromEntries(raw.map((r) => [r.name, r.cards]));
    const rows = entries.map((e) => {
      const cards = byName[e.name] || [];
      return { name: e.name, qty: e.qty, cards, chosen: 0 };
    });
    setResults(rows);
    setOverrides({});
    setStep("preview");
  };

  const chosenCard = (r) => r.cards[overrides[r.name] ?? r.chosen ?? 0] ?? null;

  const doImport = async () => {
    setImporting(true);
    let ok = 0, skip = 0;
    for (const r of results) {
      const card = chosenCard(r);
      if (!card) { skip += r.qty; continue; }
      try {
        await onImport(card, r.qty);
        ok += r.qty;
      } catch { skip += r.qty; }
    }
    setSummary({ ok, skip });
    setStep("done");
    setImporting(false);
  };

  const notFound = results.filter((r) => r.cards.length === 0);
  const ambiguous = results.filter((r) => r.cards.length > 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="font-semibold text-white text-sm">
            {step === "input" && "Importer une liste"}
            {step === "preview" && "Vérifier l'import"}
            {step === "done" && "Import terminé"}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {step === "input" && (
            <>
              <p className="text-xs text-gray-400">
                Colle une liste au format Riftbound (Legend:, Champion:, MainDeck:, Runes:…). Chaque ligne : <code className="text-gold-400">3 Nom de la carte</code>
              </p>
              <textarea
                className="input w-full h-56 resize-none font-mono text-xs"
                placeholder={"MainDeck:\n3 En Garde\n3 Meditation\n\nRunes:\n6 Calm Rune"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            </>
          )}

          {step === "preview" && (
            <div className="space-y-2">
              {notFound.length > 0 && (
                <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-3 text-xs text-red-300 space-y-1">
                  <p className="font-semibold">Cartes introuvables :</p>
                  {notFound.map((r) => <p key={r.name}>• {r.qty}× {r.name}</p>)}
                </div>
              )}

              {ambiguous.length > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-3 text-xs space-y-3">
                  <p className="font-semibold text-yellow-300">Plusieurs correspondances — choisir :</p>
                  {ambiguous.map((r) => (
                    <div key={r.name}>
                      <p className="text-gray-300 mb-1">{r.qty}× {r.name}</p>
                      <div className="space-y-1">
                        {r.cards.map((c, i) => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name={r.name} checked={(overrides[r.name] ?? 0) === i}
                              onChange={() => setOverrides((o) => ({ ...o, [r.name]: i }))} />
                            <span className="text-gray-200">{c.name}</span>
                            <span className="text-gray-500">{c.set_name} · {c.number}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                {results.filter((r) => r.cards.length > 0).map((r) => {
                  const card = chosenCard(r);
                  return (
                    <div key={r.name} className="flex items-center gap-3 text-xs text-gray-300 py-1">
                      {card?.image_small
                        ? <img src={card.image_small} alt={card.name} className="w-6 h-9 object-cover rounded" />
                        : <div className="w-6 h-9 bg-gray-800 rounded" />}
                      <span className="flex-1">{r.qty}× {card?.name || r.name}</span>
                      <span className="text-gray-600">{card?.set_name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === "done" && summary && (
            <div className="text-center space-y-2 py-6">
              <div className="text-4xl">✅</div>
              <p className="text-white font-semibold">{summary.ok} carte(s) importée(s)</p>
              {summary.skip > 0 && <p className="text-red-400 text-sm">{summary.skip} ignorée(s)</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex gap-2">
          {step === "input" && (
            <button onClick={parse} disabled={!text.trim()} className="btn-primary flex-1">
              Analyser →
            </button>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("input")} className="btn-ghost px-4">Retour</button>
              <button onClick={doImport} disabled={importing || results.every((r) => r.cards.length === 0)}
                className="btn-primary flex-1">
                {importing ? "Import…" : `Importer ${results.filter((r) => r.cards.length > 0).length} cartes`}
              </button>
            </>
          )}
          {step === "done" && (
            <button onClick={onClose} className="btn-primary flex-1">Fermer</button>
          )}
        </div>
      </div>
    </div>
  );
}
