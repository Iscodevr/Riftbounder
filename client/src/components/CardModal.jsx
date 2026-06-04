import { useEffect } from "react";

export default function CardModal({ card, onClose, onAdd, onRemove, quantity }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!card) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
      onClick={onClose}>
      {/* Sheet sur mobile, modale centrée sur desktop */}
      <div
        className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-700 rounded-full" />
        </div>

        <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-6">
          {/* Image */}
          <div className="w-full sm:w-44 shrink-0 flex justify-center">
            {card.image_large
              ? <img src={card.image_large} alt={card.name} className="w-40 sm:w-full rounded-xl" />
              : <div className="w-40 aspect-[2.5/3.5] bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 text-sm">Pas d'image</div>
            }
          </div>

          {/* Détails */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">{card.name_fr || card.name}</h2>
                {card.name_fr && <p className="text-sm text-gray-500">{card.name}</p>}
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none p-1 shrink-0">✕</button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {card.card_type && <span className="badge bg-gray-700 text-gray-200">{card.card_type}</span>}
              {card.rarity && <span className="badge bg-purple-900 text-purple-200">{card.rarity}</span>}
              {card.domain && <span className="badge bg-gray-800 text-gold-400">{card.domain}</span>}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              {card.energy_cost && (
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-gray-400 text-xs">Énergie</div>
                  <div className="text-white font-bold text-lg">{card.energy_cost}</div>
                </div>
              )}
              {card.power_cost && (
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-gray-400 text-xs">Pouvoir</div>
                  <div className="text-white font-bold text-lg">{card.power_cost}</div>
                </div>
              )}
              {card.might && (
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-gray-400 text-xs">Puissance</div>
                  <div className="text-white font-bold text-lg">{card.might}</div>
                </div>
              )}
            </div>

            {card.description && (
              <div className="mt-3 text-sm text-gray-300 bg-gray-800 rounded-lg p-3 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: card.description }} />
            )}
            {card.flavor_text && (
              <p className="mt-2 text-xs text-gray-500 italic"
                dangerouslySetInnerHTML={{ __html: card.flavor_text }} />
            )}

            <div className="mt-3 text-xs text-gray-600">{card.set_name} — #{card.number}</div>

            {(onAdd || onRemove) && (
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                {onRemove && quantity > 0 && (
                  <button onClick={() => onRemove(card)} className="btn-ghost text-sm flex-1 sm:flex-none">
                    − Retirer
                  </button>
                )}
                {quantity > 0 && (
                  <span className="text-sm text-gold-400 font-semibold">×{quantity}</span>
                )}
                {onAdd && (
                  <button onClick={() => onAdd(card)} className="btn-primary text-sm flex-1 sm:flex-none sm:ml-auto">
                    + Ajouter à la collection
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
