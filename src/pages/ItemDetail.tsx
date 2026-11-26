import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { conditionLabels, euro, timeAgo } from "../lib/format";
import { useToast } from "../lib/toast";
import type { ItemDetail as ItemDetailType } from "../lib/types";
import { Avatar, Badge, EmptyState, Modal, Spinner, Stars } from "../components/ui";
import {
  ArrowLeftIcon,
  CheckIcon,
  HeartIcon,
  PackageIcon,
  TagIcon,
  TruckIcon,
} from "../components/icons";

export function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, getToken } = useAuth();
  const { showToast } = useToast();

  const [item, setItem] = useState<ItemDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [shipping, setShipping] = useState({
    shippingName: "",
    shippingAddress: "",
    shippingCity: "",
    shippingPostalCode: "",
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const token = await getToken();
        const result = await api.item(id, token);
        if (!cancelled) {
          setItem(result);
          setAmount(String(Math.round(result.priceCents * 0.85) / 100));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Annuncio non trovato");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, getToken]);

  function requireLogin(): boolean {
    if (user) return true;
    navigate(`/auth?next=${encodeURIComponent(`/annuncio/${id}`)}`);
    return false;
  }

  async function toggleFavorite() {
    if (!item || !requireLogin()) return;
    setFavoriteBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta, accedi di nuovo.");
      const result = await api.toggleFavorite(item.id, token);
      setItem({
        ...item,
        isFavorite: result.favorited,
        favoriteCount: item.favoriteCount + (result.favorited ? 1 : -1),
      });
      showToast(result.favorited ? "Aggiunto ai preferiti" : "Rimosso dai preferiti", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function submitOffer(event: React.FormEvent) {
    event.preventDefault();
    if (!item || !requireLogin()) return;
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      showToast("Inserisci un'offerta di almeno 1,00 €", "error");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta, accedi di nuovo.");
      await api.createOffer(item.id, { amountCents: cents, message: message.trim() || undefined }, token);
      setOfferOpen(false);
      setMessage("");
      showToast("Offerta inviata al venditore", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Offerta non inviata", "error");
    } finally {
      setBusy(false);
    }
  }

  async function submitBuy(event: React.FormEvent) {
    event.preventDefault();
    if (!item || !requireLogin()) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta, accedi di nuovo.");
      const result = await api.buy(item.id, shipping, token);
      setBuyOpen(false);
      showToast("Acquisto demo completato!", "success");
      navigate(`/ordini?evidenzia=${result.orderId}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Acquisto non riuscito", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Carico l'annuncio…" />;
  if (error || !item) {
    return (
      <EmptyState
        title="Annuncio non disponibile"
        description={error ?? undefined}
        action={
          <Link to="/" className="button button-primary">
            Torna al feed
          </Link>
        }
      />
    );
  }

  const ownItem = user?.id === item.seller.id;
  const photos = item.photos.length > 0 ? item.photos : item.coverUrl ? [item.coverUrl] : [];

  return (
    <div className="detail-page">
      <button type="button" className="back-link" onClick={() => navigate(-1)}>
        <ArrowLeftIcon width={18} height={18} /> Indietro
      </button>

      <div className="detail-grid">
        <section className="gallery">
          <div className="gallery-main">
            {photos.length > 0 ? (
              <img src={photos[photoIndex]} alt={item.title} />
            ) : (
              <div className="item-placeholder large">R</div>
            )}
            {item.status === "sold" && <span className="sold-ribbon large">Venduto</span>}
          </div>
          {photos.length > 1 && (
            <div className="gallery-thumbs">
              {photos.map((photo, index) => (
                <button
                  key={photo}
                  type="button"
                  className={index === photoIndex ? "thumb active" : "thumb"}
                  onClick={() => setPhotoIndex(index)}
                  aria-label={`Foto ${index + 1}`}
                >
                  <img src={photo} alt="" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="detail-info">
          <div className="detail-badges">
            {item.category && <Badge tone="accent">{item.category.name}</Badge>}
            {item.size && <Badge>{item.size}</Badge>}
            <Badge tone={item.status === "active" ? "success" : "warning"}>
              {item.status === "active" ? "Disponibile" : item.status === "sold" ? "Venduto" : item.status}
            </Badge>
          </div>

          <h1>{item.title}</h1>
          <div className="detail-price-row">
            <span className="detail-price">{euro(item.priceCents)}</span>
            <span className="detail-meta">
              {conditionLabels[item.condition] ?? item.condition} · {timeAgo(item.createdAt)}
            </span>
          </div>

          <p className="detail-description">{item.description}</p>

          <div className="detail-facts">
            <div>
              <span>Condizione</span>
              <strong>{conditionLabels[item.condition] ?? item.condition}</strong>
            </div>
            <div>
              <span>Taglia</span>
              <strong>{item.size ?? "—"}</strong>
            </div>
            <div>
              <span>Località</span>
              <strong>{item.city ?? "—"}</strong>
            </div>
            <div>
              <span>Preferiti</span>
              <strong>{item.favoriteCount}</strong>
            </div>
          </div>

          {ownItem ? (
            <div className="own-item-note">
              <CheckIcon /> Questo è il tuo annuncio. Gestisci offerte e ordini dalla tua area.
            </div>
          ) : (
            <div className="detail-actions">
              <button
                type="button"
                className="button button-primary button-large"
                onClick={() => requireLogin() && setBuyOpen(true)}
                disabled={item.status !== "active"}
              >
                <PackageIcon width={19} height={19} /> Acquista ora
              </button>
              <button
                type="button"
                className="button button-ghost button-large"
                onClick={() => requireLogin() && setOfferOpen(true)}
                disabled={item.status !== "active"}
              >
                <TagIcon width={19} height={19} /> Fai un'offerta
              </button>
              <button
                type="button"
                className={`icon-button favorite-large${item.isFavorite ? " active" : ""}`}
                onClick={toggleFavorite}
                disabled={favoriteBusy}
                aria-label={item.isFavorite ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti"}
              >
                <HeartIcon fill={item.isFavorite ? "currentColor" : "none"} />
              </button>
            </div>
          )}

          <div className="seller-card">
            <Avatar name={item.seller.name} src={item.seller.avatarUrl} size={52} />
            <div className="seller-main">
              <Link to={`/utente/${item.seller.id}`} className="seller-name">
                {item.seller.name}
              </Link>
              <div className="seller-rating">
                <Stars rating={item.seller.rating ?? 0} count={item.seller.reviewCount ?? 0} />
                <span>· {item.seller.soldCount ?? 0} venduti</span>
              </div>
              {item.seller.bio && <p>{item.seller.bio}</p>}
            </div>
            <Link to={`/utente/${item.seller.id}`} className="button button-ghost small">
              Profilo
            </Link>
          </div>

          <div className="delivery-note">
            <TruckIcon />
            <div>
              <strong>Spedizione demo</strong>
              <span>Pagamento e spedizione simulati: nessun addebito reale.</span>
            </div>
          </div>
        </section>
      </div>

      <section className="reviews-section">
        <h2>Recensioni del venditore</h2>
        {item.sellerReviews.length === 0 ? (
          <p className="muted">Ancora nessuna recensione.</p>
        ) : (
          <div className="review-list">
            {item.sellerReviews.map((review) => (
              <article key={review.id} className="review-card">
                <Avatar name={review.author.name} src={review.author.avatarUrl} size={38} />
                <div>
                  <div className="review-head">
                    <strong>{review.author.name}</strong>
                    <Stars rating={review.rating} />
                    <span className="muted">{timeAgo(review.createdAt)}</span>
                  </div>
                  {review.comment && <p>{review.comment}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        title="Fai un'offerta"
        footer={
          <>
            <button type="button" className="button button-ghost" onClick={() => setOfferOpen(false)}>
              Annulla
            </button>
            <button type="submit" form="offer-form" className="button button-primary" disabled={busy}>
              {busy ? "Invio…" : "Invia offerta"}
            </button>
          </>
        }
      >
        <form id="offer-form" onSubmit={submitOffer} className="form">
          <p className="muted">
            Prezzo richiesto: <strong>{euro(item.priceCents)}</strong>. Il venditore può accettare,
            rifiutare o ignorare la tua offerta.
          </p>
          <label>
            La tua offerta (€)
            <input
              type="number"
              min="1"
              step="0.5"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </label>
          <label>
            Messaggio (opzionale)
            <textarea
              rows={3}
              maxLength={500}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ciao! Ti va bene se…"
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        title="Acquista ora"
        footer={
          <>
            <button type="button" className="button button-ghost" onClick={() => setBuyOpen(false)}>
              Annulla
            </button>
            <button type="submit" form="buy-form" className="button button-primary" disabled={busy}>
              {busy ? "Elaboro…" : `Conferma · ${euro(item.priceCents)}`}
            </button>
          </>
        }
      >
        <form id="buy-form" onSubmit={submitBuy} className="form">
          <div className="demo-banner">
            <CheckIcon /> Pagamento demo: nessun addebito reale.
          </div>
          <label>
            Nome e cognome
            <input
              value={shipping.shippingName}
              onChange={(event) => setShipping({ ...shipping, shippingName: event.target.value })}
              required
            />
          </label>
          <label>
            Indirizzo
            <input
              value={shipping.shippingAddress}
              onChange={(event) => setShipping({ ...shipping, shippingAddress: event.target.value })}
              required
            />
          </label>
          <div className="form-row">
            <label>
              Città
              <input
                value={shipping.shippingCity}
                onChange={(event) => setShipping({ ...shipping, shippingCity: event.target.value })}
                required
              />
            </label>
            <label>
              CAP
              <input
                value={shipping.shippingPostalCode}
                onChange={(event) =>
                  setShipping({ ...shipping, shippingPostalCode: event.target.value })
                }
                required
              />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
