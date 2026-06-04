import { useState } from "react";

export default function Filters({ filters, values, onChange }) {
  const [open, setOpen] = useState(false);
  const activeCount = [values.set, values.type, values.domain, values.rarity].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {/* Barre de recherche + bouton filtres */}
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Rechercher une carte…"
          value={values.q || ""}
          onChange={(e) => onChange({ ...values, q: e.target.value, page: 1 })}
        />
        <button
          onClick={() => setOpen((o) => !o)}
          className={`shrink-0 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
            activeCount > 0 || open
              ? "bg-gold-500/20 border-gold-500 text-gold-400"
              : "border-gray-700 text-gray-400"
          }`}
        >
          ⚙️ {activeCount > 0 ? `${activeCount}` : "Filtres"}
        </button>
      </div>

      {/* Filtres dépliables */}
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-gray-900 border border-gray-800 rounded-xl">
          {filters?.sets && (
            <select className="input text-sm" value={values.set || ""} onChange={(e) => onChange({ ...values, set: e.target.value, page: 1 })}>
              <option value="">Tous les sets</option>
              {filters.sets.map((s) => <option key={s.set_id} value={s.set_id}>{s.set_name}</option>)}
            </select>
          )}
          {filters?.types && (
            <select className="input text-sm" value={values.type || ""} onChange={(e) => onChange({ ...values, type: e.target.value, page: 1 })}>
              <option value="">Tous types</option>
              {filters.types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {filters?.domains && (
            <select className="input text-sm" value={values.domain || ""} onChange={(e) => onChange({ ...values, domain: e.target.value, page: 1 })}>
              <option value="">Tous domaines</option>
              {filters.domains.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {filters?.rarities && (
            <select className="input text-sm" value={values.rarity || ""} onChange={(e) => onChange({ ...values, rarity: e.target.value, page: 1 })}>
              <option value="">Toutes raretés</option>
              {filters.rarities.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {activeCount > 0 && (
            <button
              className="col-span-2 sm:col-span-4 text-xs text-gray-500 hover:text-white transition-colors text-center py-1"
              onClick={() => onChange({ q: values.q, page: 1 })}
            >
              Effacer les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}
