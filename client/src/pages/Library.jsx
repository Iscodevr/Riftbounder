import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import CardTile from "../components/CardTile";
import CardModal from "../components/CardModal";
import Filters from "../components/Filters";

export default function Library() {
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState(null);
  const [params, setParams] = useState({ page: 1, limit: 48 });
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    api.get("/cards/filters").then((f) => setFilters(f)).catch(console.error);
    api.get("/cards/sets").then((sets) => setFilters((f) => f ? { ...f, sets } : { sets })).catch(console.error);
  }, [user]);

  const loadLibrary = useCallback(() => {
    if (!user) return;
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
    api.get("/library", clean)
      .then((data) => { setCards(data.cards); setTotal(data.total); setPages(data.pages); })
      .catch(console.error);
  }, [params, user]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  const remove = async (card) => {
    const current = card.quantity;
    try {
      if (current <= 1) {
        await api.del(`/library/${card.id}`);
      } else {
        await api.put(`/library/${card.id}`, { quantity: current - 1 });
      }
      loadLibrary();
      showToast("Carte retirée");
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  const add = async (card) => {
    try {
      await api.post("/library", { card_id: card.id, quantity: 1 });
      loadLibrary();
      showToast(`✅ ${card.name} ajoutée`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-white">Ma collection</h1>
      </div>

      <Filters filters={filters} values={params} onChange={setParams} total={total} />

      {cards.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">Votre collection est vide</p>
          <p className="text-sm">Ajoutez des cartes depuis le <a href="/" className="text-gold-400 hover:underline">catalogue</a> ou en <a href="/scan" className="text-gold-400 hover:underline">scannant</a>.</p>
        </div>
      ) : (
        <>
          <div className="card-grid mt-6">
            {cards.map((card) => (
              <CardTile
                key={card.id}
                card={card}
                quantity={card.quantity}
                onAdd={add}
                onRemove={remove}
                onClick={setSelected}
              />
            ))}
          </div>
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button className="btn-ghost text-sm" disabled={params.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>← Précédent</button>
              <span className="text-sm text-gray-400 self-center">Page {params.page} / {pages}</span>
              <button className="btn-ghost text-sm" disabled={params.page >= pages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>Suivant →</button>
            </div>
          )}
        </>
      )}

      <CardModal
        card={selected}
        quantity={selected?.quantity || 0}
        onClose={() => setSelected(null)}
        onAdd={add}
        onRemove={remove}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
