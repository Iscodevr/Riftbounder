export const DOMAIN_COLORS = {
  Fury: "#ef4444",
  Calm: "#10b981",
  Mind: "#3b82f6",
  Body: "#f97316",
  Order: "#eab308",
  Chaos: "#a855f7",
};

export default function Filters({ filters, values, onChange, total }) {
  const activeCount = [values.set, values.type, values.domain, values.rarity].filter(Boolean).length;

  const clearAll = () => onChange({ q: values.q, page: 1 });

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-3">
      {/* Recherche */}
      <input
        className="input"
        placeholder="Rechercher une carte…"
        value={values.q || ""}
        onChange={(e) => onChange({ ...values, q: e.target.value, page: 1 })}
      />

      {/* Domaines + dropdowns */}
      <div className="flex flex-wrap items-center gap-2">
        {filters?.domains && (
          <div className="flex gap-1.5">
            {filters.domains.map((d) => {
              const active = values.domain === d;
              return (
                <button
                  key={d}
                  title={d}
                  onClick={() => onChange({ ...values, domain: active ? "" : d, page: 1 })}
                  className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all"
                  style={{
                    borderColor: DOMAIN_COLORS[d] || "#4b5563",
                    backgroundColor: active ? (DOMAIN_COLORS[d] || "#4b5563") : "transparent",
                  }}
                >
                  <span
                    className="block w-3 h-3 rounded-full"
                    style={{ backgroundColor: active ? "#0b0f1a" : (DOMAIN_COLORS[d] || "#4b5563") }}
                  />
                </button>
              );
            })}
          </div>
        )}

        <div className="hidden sm:block w-px h-6 bg-gray-800" />

        <div className="flex flex-wrap gap-2 flex-1">
          {filters?.sets && (
            <select className="input text-sm w-auto" value={values.set || ""} onChange={(e) => onChange({ ...values, set: e.target.value, page: 1 })}>
              <option value="">Set : Tous</option>
              {filters.sets.map((s) => <option key={s.set_id} value={s.set_id}>{s.set_name}</option>)}
            </select>
          )}
          {filters?.types && (
            <select className="input text-sm w-auto" value={values.type || ""} onChange={(e) => onChange({ ...values, type: e.target.value, page: 1 })}>
              <option value="">Type : Tous</option>
              {filters.types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {filters?.rarities && (
            <select className="input text-sm w-auto" value={values.rarity || ""} onChange={(e) => onChange({ ...values, rarity: e.target.value, page: 1 })}>
              <option value="">Rareté : Toutes</option>
              {filters.rarities.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Pied : actifs + total */}
      <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-800">
        <div>
          {activeCount > 0 ? (
            <button onClick={clearAll} className="text-gold-400 hover:text-gold-300 transition-colors">
              Actifs : {[values.set, values.type, values.domain, values.rarity].filter(Boolean).join(", ")} · effacer
            </button>
          ) : (
            <span>Actifs : Aucun</span>
          )}
        </div>
        {total != null && <span className="font-semibold text-gray-400">{total} cartes</span>}
      </div>
    </div>
  );
}
