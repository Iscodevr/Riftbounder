import { useLanguage, cardName } from "../hooks/useLanguage";

const RARITY_COLORS = {
  Common: "bg-gray-600 text-gray-200",
  Uncommon: "bg-green-800 text-green-200",
  Rare: "bg-blue-800 text-blue-200",
  Epic: "bg-purple-800 text-purple-200",
};

const DOMAIN_COLORS = {
  Fury: "text-red-400",
  Calm: "text-emerald-400",
  Mind: "text-blue-400",
  Body: "text-orange-400",
  Order: "text-yellow-400",
  Chaos: "text-purple-400",
};

function isLandscapeImage(url) {
  const m = url?.match(/-(\d+)x(\d+)\.\w+/);
  return !!m && Number(m[1]) > Number(m[2]);
}

export default function CardTile({ card, quantity, onAdd, onRemove, onClick }) {
  const { lang } = useLanguage();
  const rarityClass = RARITY_COLORS[card.rarity] || "bg-gray-700 text-gray-300";
  const domainClass = DOMAIN_COLORS[card.domain?.split(";")[0]] || "text-gray-400";
  const landscape = isLandscapeImage(card.image_small);
  const name = cardName(card, lang);

  return (
    <div
      className="relative group bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-gray-600 transition-all cursor-pointer"
      onClick={() => onClick?.(card)}
    >
      {/* Image */}
      <div className={`${landscape ? "aspect-[3.5/2.5]" : "aspect-[2.5/3.5]"} bg-gray-800 overflow-hidden`}>
        {card.image_small ? (
          <img
            src={card.image_small}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs text-center p-2">
            {name}
          </div>
        )}
      </div>

      {/* Quantity badge */}
      {quantity > 0 && (
        <div className="absolute top-2 right-2 bg-gold-500 text-gray-950 text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
          {quantity}
        </div>
      )}

      {/* Info */}
      <div className="p-2">
        <p className="text-xs font-semibold text-white truncate">{name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-xs ${domainClass}`}>{card.domain || card.card_type}</span>
          {card.rarity && (
            <span className={`badge ${rarityClass}`}>{card.rarity[0]}</span>
          )}
        </div>
        {card.might && (
          <p className="text-xs text-gray-500 mt-0.5">⚔️ {card.might}</p>
        )}
      </div>

      {/* Add/Remove overlay */}
      {(onAdd || onRemove) && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {onRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(card); }}
              className="w-8 h-8 bg-red-600 hover:bg-red-500 rounded-full text-white font-bold text-lg transition-colors"
            >
              −
            </button>
          )}
          {onAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(card); }}
              className="w-8 h-8 bg-gold-500 hover:bg-gold-400 rounded-full text-gray-950 font-bold text-lg transition-colors"
            >
              +
            </button>
          )}
        </div>
      )}
    </div>
  );
}
