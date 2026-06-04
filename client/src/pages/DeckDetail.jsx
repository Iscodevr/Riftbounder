import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";
import CardTile from "../components/CardTile";
import CardModal from "../components/CardModal";
import Filters from "../components/Filters";

export default function DeckDetail() {
  const { id } = useParams();
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [deck, setDeck] = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [allTotal, setAllTotal] = useState(0);
  const [allPages, setAllPages] = useState(1);
  const [filters, setFilters] = useState(null);
  const [params, setParams] = useState({ page: 1, limit: 48 });
  const [tab, setTab] = useState("deck");
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState("");
  const [editing, setEditing] = useState(false);
  const [deckName, setDeckName] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadDeck();
    api.get("/cards/filters").then(setFilters).catch(console.error);
    api.get("/cards/sets").then((sets) => setFilters((f) => f ? { ...f, sets } : { sets })).catch(console.error);
  }, [user, id]);

  useEffect(() => {
    if (tab !== "add") return;
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
    api.get("/cards", clean).then((data) => {
      setAllCards(data.cards);
      setAllTotal(data.total);
      setAllPages(data.pages);
    }).catch(console.error);
  }, [tab, params]);

  const loadDeck = () => {
    api.get(`/decks/${id}`).then((d) => { setDeck(d); setDeckName(d.name); }).catch(() => navigate("/decks"));
  };

  const addCard = async (card) => {
    const existing = deck.cards.find((c) => c.id === card.id);
    const qty = (existing?.quantity || 0) + 1;
    try {
      await api.post(`/decks/${id}/cards`, { card_id: card.id, quantity: qty });
      loadDeck();
      showToast(`✅ ${card.name} ajoutée`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  const removeCard = async (card) => {
    const existing = deck.cards.find((c) => c.id === card.id);
    if (!existing) return;
    try {
      if (existing.quantity <= 1) {
        await api.del(`/decks/${id}/cards/${card.id}`);
      } else {
        await api.post(`/decks/${id}/cards`, { card_id: card.id, quantity: existing.quantity - 1 });
      }
      loadDeck();
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  const saveName = async () => {
    try {
      await api.put(`/decks/${id}`, { name: deckName });
      setDeck((d) => ({ ...d, name: deckName }));
      setEditing(false);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  if (!deck) return <div className="text-center py-20 text-gray-500">Chargement…</div>;

  const deckMap = {};
  deck.cards.forEach((c) => { deckMap[c.id] = c.quantity; });
  const totalCards = deck.cards.reduce((s, c) => s + c.quantity, 0);

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate("/decks")} className="text-gray-500 hover:text-white transition-colors">←</button>
        {editing ? (
          <div className="flex gap-2 flex-1">
            <input className="input text-xl font-bold" value={deckName} onChange={(e) => setDeckName(e.target.value)} autoFocus />
            <button className="btn-primary text-sm" onClick={saveName}>Sauvegarder</button>
            <button className="btn-ghost text-sm" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        ) : (
          <h1 className="text-2xl font-bold text-white flex-1 cursor-pointer hover:text-gold-400 transition-colors" onClick={() => setEditing(true)}>
            {deck.name} <span className="text-sm text-gray-500 font-normal ml-2">{totalCards} cartes</span>
          </h1>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("deck")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "deck" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>
          Mon deck ({deck.cards.length})
        </button>
        <button onClick={() => setTab("add")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "add" ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>
          + Ajouter des cartes
        </button>
      </div>

      {tab === "deck" ? (
        deck.cards.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            Deck vide. <button className="text-gold-400 hover:underline" onClick={() => setTab("add")}>Ajouter des cartes</button>
          </div>
        ) : (
          <div className="card-grid">
            {deck.cards.map((card) => (
              <CardTile key={card.id} card={card} quantity={card.quantity} onAdd={addCard} onRemove={removeCard} onClick={setSelected} />
            ))}
          </div>
        )
      ) : (
        <>
          <Filters filters={filters} values={params} onChange={setParams} />
          <p className="text-sm text-gray-500 mt-2 mb-4">{allTotal} cartes</p>
          <div className="card-grid">
            {allCards.map((card) => (
              <CardTile key={card.id} card={card} quantity={deckMap[card.id] || 0} onAdd={addCard} onRemove={deckMap[card.id] ? removeCard : null} onClick={setSelected} />
            ))}
          </div>
          {allPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button className="btn-ghost text-sm" disabled={params.page <= 1} onClick={() => setParams((p) => ({ ...p, page: p.page - 1 }))}>← Précédent</button>
              <span className="text-sm text-gray-400 self-center">Page {params.page} / {allPages}</span>
              <button className="btn-ghost text-sm" disabled={params.page >= allPages} onClick={() => setParams((p) => ({ ...p, page: p.page + 1 }))}>Suivant →</button>
            </div>
          )}
        </>
      )}

      <CardModal
        card={selected}
        quantity={selected ? (deckMap[selected.id] || 0) : 0}
        onClose={() => setSelected(null)}
        onAdd={addCard}
        onRemove={selected && deckMap[selected?.id] ? removeCard : null}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
