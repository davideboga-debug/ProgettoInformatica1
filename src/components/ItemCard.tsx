import { Link } from "react-router-dom";
import type { Item } from "../lib/types";
import { conditionLabels, euro } from "../lib/format";
import { HeartIcon } from "./icons";

export function ItemCard({
  item,
  onToggleFavorite,
  busy,
}: {
  item: Item;
  onToggleFavorite?: (item: Item) => void;
  busy?: boolean;
}) {
  return (
    <article className="item-card">
      <Link to={`/annuncio/${item.id}`} className="item-media" aria-label={item.title}>
        {item.coverUrl ? (
          <img src={item.coverUrl} alt={item.title} loading="lazy" />
        ) : (
          <div className="item-placeholder" aria-hidden="true">
            <span>{item.category?.name.slice(0, 1) ?? "R"}</span>
          </div>
        )}
        {item.status === "sold" && <span className="sold-ribbon">Venduto</span>}
        {onToggleFavorite && (
          <button
            type="button"
            className={`favorite-button${item.isFavorite ? " active" : ""}`}
            aria-label={item.isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
            aria-pressed={item.isFavorite}
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleFavorite(item);
            }}
          >
            <HeartIcon
              width={19}
              height={19}
              fill={item.isFavorite ? "currentColor" : "none"}
            />
          </button>
        )}
      </Link>
      <div className="item-body">
        <Link to={`/annuncio/${item.id}`} className="item-title">
          {item.title}
        </Link>
        <div className="item-meta">
          <span className="price">{euro(item.priceCents)}</span>
          {item.size && <span className="size-chip">{item.size}</span>}
        </div>
        <div className="item-sub">
          <span>{item.seller.name}</span>
          <span className="dot" />
          <span>{conditionLabels[item.condition] ?? item.condition}</span>
        </div>
      </div>
    </article>
  );
}
