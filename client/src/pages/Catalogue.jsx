import { useState, useEffect, useCallback } from "react";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import CardTile from "../components/CardTile";
import CardModal from "../components/CardModal";
import Filters from "../components/Filters";

export default function Catalogue() {
  const api = useApi();
  const { user } = useAuth();
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState(null);
  const [params, setParams] = useState({ page: 1, limit: 48 });
  const [selected, setSelected] = useState(null);
  const [library, setLibrary] = useState({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  useEffect(() => {
    api.get("/cards/filters").then(setFilters).catch(console.error);
    api.get("/cards/sets").then((sets) => {
      setFilters((f) => f ? { ...f, sets } : { sets });
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) return;
    api.get("/library", { limit: 9999 })
      .then((data) => {
        const map = {};
        data.cards.forEach((c) => { map[c.id] = c.quantity; });
        setLibrary(map);
      })
      .catch(console.error);
  }, [user]);

  const loadCards = useCallback(() => {
    setLoading(true);
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
    api.get("/cards", clean)
      .then((data) => { setCards(data.cards); setTotal(data.total); setPages(data.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const addToLibrary = async (card) => {
    if (!user) return showToast("Connectez-vous pour gérer votre collection");
    try {
      await api.post("/library", { card_id: card.id, quantity: 1 });
      setLibrary((l) => ({ ...l, [card.id]: (l[card.id] || 0) + 1 }));
      showToast(`✅ ${card.name} ajoutée`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  const removeFromLibrary = async (card) => {
    if (!user) return;
    const current = library[card.id] || 0;
    try {
      if (current <= 1) {
        await api.del(`/library/${card.id}`);
        setLibrary((l) => { const n = { ...l }; delete n[card.id]; return n; });
      } else {
        await api.put(`/library/${card.id}`, { quantity: current - 1 });
        setLibrary((l) => ({ ...l, [card.id]: current - 1 }));
      }
      showToast(`Retirée de la collection`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Catalogue</h1>
        <span className="text-sm text-gray-500">{total} cartes</span>
      </div>

      <Filters filters={filters} values={params} onChange={setParams} />

      {loading ? (
        <div className="text-center text-gray-500 py-20">Chargement…</div>
      ) : (
        <>
          <div className="card-grid mt-6">
            {cards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                quantity={library[card.id] || 0}
                onAdd={user ? addToLibrary : null}
                onRemove={user && library[card.id] ? removeFromLibrary : null}
                onClick={setSelected}
              />
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                className="btn-ghost text-sm"
                disabled={params.page <= 1}
                onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}
              >
                ← Précédent
              </button>
              <span className="text-sm text-gray-400 self-center">
                Page {params.page} / {pages}
              </span>
              <button
                className="btn-ghost text-sm"
                disabled={params.page >= pages}
                onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}
              >
                Suivant →
              </button>
            </div>
          )}
        </>
      )}

      <CardModal
        card={selected}
        quantity={selected ? library[selected.id] || 0 : 0}
        onClose={() => setSelected(null)}
        onAdd={user ? addToLibrary : null}
        onRemove={user && selected && library[selected?.id] ? removeFromLibrary : null}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
