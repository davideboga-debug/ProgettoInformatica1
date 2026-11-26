import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, EmptyState, Modal, PageHeader, Spinner, Stars } from "../components/ui";
import { CheckIcon, PackageIcon, TruckIcon } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { euro, orderStatusLabels, timeAgo } from "../lib/format";
import { useToast } from "../lib/toast";
import type { Order } from "../lib/types";

type Tab = "buyer" | "seller";

const statusTone: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  pending: "warning",
  paid: "accent",
  shipped: "accent",
  delivered: "success",
  cancelled: "danger",
};

export function Orders() {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const highlight = params.get("evidenzia");
  const [tab, setTab] = useState<Tab>("buyer");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shipOrder, setShipOrder] = useState<Order | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [shipForm, setShipForm] = useState({ carrier: "Poste Italiane", trackingNumber: "" });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      const result = await api.orders(token);
      setOrders(result.orders);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Errore di caricamento", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function deliver(order: Order) {
    setBusyId(order.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      await api.deliver(order.id, token);
      showToast("Consegna confermata", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function submitShip(event: React.FormEvent) {
    event.preventDefault();
    if (!shipOrder) return;
    setBusyId(shipOrder.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      await api.ship(shipOrder.id, shipForm, token);
      showToast("Ordine segnato come spedito", "success");
      setShipOrder(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (!reviewOrder) return;
    setBusyId(reviewOrder.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      await api.review(reviewOrder.id, reviewForm, token);
      showToast("Recensione pubblicata, grazie!", "success");
      setReviewOrder(null);
      setReviewForm({ rating: 5, comment: "" });
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setBusyId(null);
    }
  }

  const list = orders.filter((order) => order.role === tab);

  return (
    <div>
      <PageHeader title="Ordini" subtitle="Acquisti e vendite, dal pagamento demo alla consegna." />

      <div className="tabs">
        <button type="button" className={tab === "buyer" ? "tab active" : "tab"} onClick={() => setTab("buyer")}>
          Acquisti <span>{orders.filter((order) => order.role === "buyer").length}</span>
        </button>
        <button type="button" className={tab === "seller" ? "tab active" : "tab"} onClick={() => setTab("seller")}>
          Vendite <span>{orders.filter((order) => order.role === "seller").length}</span>
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<PackageIcon width={34} height={34} />}
          title={tab === "buyer" ? "Nessun acquisto" : "Nessuna vendita"}
          description={
            tab === "buyer"
              ? "Quando acquisti un annuncio lo trovi qui con spedizione e recensione."
              : "Quando vendi un capo, qui gestisci la spedizione."
          }
          action={
            <Link to="/" className="button button-primary">
              Scopri gli annunci
            </Link>
          }
        />
      ) : (
        <div className="order-list">
          {list.map((order) => (
            <article
              key={order.id}
              className={`order-card${highlight === order.id ? " highlighted" : ""}`}
            >
              <div className="order-top">
                <Link to={`/annuncio/${order.item.id}`} className="order-cover">
                  {order.item.coverUrl ? (
                    <img src={order.item.coverUrl} alt={order.item.title} />
                  ) : (
                    <div className="item-placeholder">R</div>
                  )}
                </Link>
                <div className="order-main">
                  <div className="order-head">
                    <Link to={`/annuncio/${order.item.id}`} className="order-title">
                      {order.item.title}
                    </Link>
                    <Badge tone={statusTone[order.status] ?? "neutral"}>
                      {orderStatusLabels[order.status] ?? order.status}
                    </Badge>
                  </div>
                  <div className="order-amounts">
                    <span className="order-amount">{euro(order.amountCents)}</span>
                    <span className="muted">
                      {tab === "buyer" ? `Venditore: ${order.seller.name}` : `Acquirente: ${order.buyer.name}`} ·{" "}
                      {timeAgo(order.createdAt)}
                    </span>
                  </div>
                  <div className="order-timeline">
                    <span className={order.status !== "pending" ? "step done" : "step"}>
                      <CheckIcon width={14} height={14} /> Pagato
                    </span>
                    <span className={["shipped", "delivered"].includes(order.status) ? "step done" : "step"}>
                      <TruckIcon width={14} height={14} /> Spedito
                    </span>
                    <span className={order.status === "delivered" ? "step done" : "step"}>
                      <PackageIcon width={14} height={14} /> Consegnato
                    </span>
                  </div>
                  <div className="order-details">
                    <span>Pagamento demo: {order.payment.status ?? "—"}</span>
                    {order.shipment.trackingNumber && <span>Tracking: {order.shipment.trackingNumber}</span>}
                    {order.shipment.carrier && <span>Corriere: {order.shipment.carrier}</span>}
                  </div>
                  {tab === "seller" && order.shipping.address && (
                    <div className="shipping-box">
                      <strong>Spedisci a</strong>
                      <span>
                        {order.shipping.name} — {order.shipping.address}, {order.shipping.postalCode}{" "}
                        {order.shipping.city}
                      </span>
                    </div>
                  )}
                  <div className="order-actions">
                    {tab === "seller" && order.status === "paid" && (
                      <button
                        type="button"
                        className="button button-primary small"
                        onClick={() => setShipOrder(order)}
                        disabled={busyId === order.id}
                      >
                        <TruckIcon width={16} height={16} /> Segna come spedito
                      </button>
                    )}
                    {tab === "buyer" && order.status === "shipped" && (
                      <button
                        type="button"
                        className="button button-primary small"
                        onClick={() => deliver(order)}
                        disabled={busyId === order.id}
                      >
                        <CheckIcon width={16} height={16} /> Conferma consegna
                      </button>
                    )}
                    {tab === "buyer" && order.status === "delivered" && !order.review && (
                      <button
                        type="button"
                        className="button button-ghost small"
                        onClick={() => setReviewOrder(order)}
                      >
                        Lascia una recensione
                      </button>
                    )}
                    {order.review && (
                      <span className="review-done">
                        <Stars rating={order.review.rating} /> Recensione inviata
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(shipOrder)}
        onClose={() => setShipOrder(null)}
        title="Segna come spedito"
        footer={
          <>
            <button type="button" className="button button-ghost" onClick={() => setShipOrder(null)}>
              Annulla
            </button>
            <button type="submit" form="ship-form" className="button button-primary" disabled={Boolean(busyId)}>
              Conferma spedizione
            </button>
          </>
        }
      >
        <form id="ship-form" className="form" onSubmit={submitShip}>
          <label>
            Corriere
            <input
              value={shipForm.carrier}
              onChange={(event) => setShipForm({ ...shipForm, carrier: event.target.value })}
              required
            />
          </label>
          <label>
            Numero di tracking (opzionale)
            <input
              value={shipForm.trackingNumber}
              onChange={(event) => setShipForm({ ...shipForm, trackingNumber: event.target.value })}
              placeholder="Es. 123456789"
            />
          </label>
        </form>
      </Modal>

      <Modal
        open={Boolean(reviewOrder)}
        onClose={() => setReviewOrder(null)}
        title="Recensisci il venditore"
        footer={
          <>
            <button type="button" className="button button-ghost" onClick={() => setReviewOrder(null)}>
              Annulla
            </button>
            <button type="submit" form="review-form" className="button button-primary" disabled={Boolean(busyId)}>
              Pubblica recensione
            </button>
          </>
        }
      >
        <form id="review-form" className="form" onSubmit={submitReview}>
          <label>
            Valutazione
            <div className="rating-picker">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={value <= reviewForm.rating ? "rating-star active" : "rating-star"}
                  onClick={() => setReviewForm({ ...reviewForm, rating: value })}
                  aria-label={`${value} stelle`}
                >
                  ★
                </button>
              ))}
            </div>
          </label>
          <label>
            Commento (opzionale)
            <textarea
              rows={4}
              value={reviewForm.comment}
              onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })}
              placeholder="Com'è andata la trattativa?"
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}
