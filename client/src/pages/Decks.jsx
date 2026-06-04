import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useApi } from "../hooks/useApi";
import { useAuth } from "../hooks/useAuth";

export default function Decks() {
  const api = useApi();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    api.get("/decks").then(setDecks).catch(console.error);
  }, [user]);

  const createDeck = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const deck = await api.post("/decks", { name: name.trim() });
      setDecks((d) => [deck, ...d]);
      setName("");
      setCreating(false);
      navigate(`/decks/${deck.id}`);
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  const deleteDeck = async (id) => {
    if (!confirm("Supprimer ce deck ?")) return;
    try {
      await api.del(`/decks/${id}`);
      setDecks((d) => d.filter((deck) => deck.id !== id));
    } catch (e) {
      showToast(`❌ ${e.message}`);
    }
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Mes decks</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ Nouveau deck</button>
      </div>

      {creating && (
        <form onSubmit={createDeck} className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6 flex gap-3">
          <input
            className="input flex-1"
            placeholder="Nom du deck"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <button className="btn-primary" type="submit">Créer</button>
          <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>Annuler</button>
        </form>
      )}

      {decks.length === 0 ? (
        <div className="text-center py-20 text-gray-500">Aucun deck. Créez-en un !</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {decks.map((deck) => (
            <div key={deck.id} className="bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white text-lg">{deck.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{deck.card_count} carte{deck.card_count !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => deleteDeck(deck.id)} className="text-gray-600 hover:text-red-400 transition-colors text-sm">✕</button>
              </div>
              <Link to={`/decks/${deck.id}`} className="btn-primary inline-block mt-4 text-sm">
                Ouvrir →
              </Link>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 border border-gray-700 text-white text-sm px-5 py-3 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
