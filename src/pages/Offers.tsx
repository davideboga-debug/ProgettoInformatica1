import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, EmptyState, PageHeader, Spinner } from "../components/ui";
import { TagIcon } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { euro, offerStatusLabels, timeAgo } from "../lib/format";
import { useToast } from "../lib/toast";
import type { Offer } from "../lib/types";

type Tab = "received" | "sent";

export function Offers() {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("received");
  const [received, setReceived] = useState<Offer[]>([]);
  const [sent, setSent] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      const result = await api.offers(token);
      setReceived(result.received);
      setSent(result.sent);
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

  async function accept(offer: Offer) {
    if (!window.confirm(`Accettare l'offerta di ${euro(offer.amountCents)}? Verrà creato un ordine demo.`)) {
      return;
    }
    setBusyId(offer.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      await api.acceptOffer(offer.id, token);
      showToast("Offerta accettata: ordine creato!", "success");
      navigate("/ordini");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function decline(offer: Offer) {
    setBusyId(offer.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      await api.declineOffer(offer.id, token);
      showToast("Offerta rifiutata", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setBusyId(null);
    }
  }

  const list = tab === "received" ? received : sent;

  return (
    <div>
      <PageHeader
        title="Offerte"
        subtitle="Le proposte ricevute sui tuoi annunci e quelle che hai inviato."
      />

      <div className="tabs">
        <button
          type="button"
          className={tab === "received" ? "tab active" : "tab"}
          onClick={() => setTab("received")}
        >
          Ricevute <span>{received.length}</span>
        </button>
        <button
          type="button"
          className={tab === "sent" ? "tab active" : "tab"}
          onClick={() => setTab("sent")}
        >
          Inviate <span>{sent.length}</span>
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<TagIcon width={34} height={34} />}
          title={tab === "received" ? "Nessuna offerta ricevuta" : "Nessuna offerta inviata"}
          description={
            tab === "received"
              ? "Quando qualcuno proporrà un prezzo per i tuoi annunci lo vedrai qui."
              : "Trova un annuncio che ti piace e fai la tua proposta."
          }
          action={
            <Link to="/" className="button button-primary">
              Scopri gli annunci
            </Link>
          }
        />
      ) : (
        <div className="offer-list">
          {list.map((offer) => (
            <article key={offer.id} className="offer-card">
              <Link to={`/annuncio/${offer.itemId}`} className="offer-cover">
                {offer.coverUrl ? <img src={offer.coverUrl} alt={offer.title} /> : <div className="item-placeholder">R</div>}
              </Link>
              <div className="offer-main">
                <div className="offer-head">
                  <Link to={`/annuncio/${offer.itemId}`} className="offer-title">
                    {offer.title}
                  </Link>
                  <Badge
                    tone={
                      offer.status === "accepted"
                        ? "success"
                        : offer.status === "declined"
                          ? "danger"
                          : offer.status === "pending"
                            ? "warning"
                            : "neutral"
                    }
                  >
                    {offerStatusLabels[offer.status] ?? offer.status}
                  </Badge>
                </div>
                <div className="offer-amounts">
                  <span className="offer-amount">{euro(offer.amountCents)}</span>
                  <span className="muted">richiesto {euro(offer.askingPriceCents)}</span>
                </div>
                <p className="offer-meta">
                  {tab === "received" ? `Da ${offer.buyerName}` : `A ${offer.sellerName}`} ·{" "}
                  {timeAgo(offer.createdAt)}
                </p>
                {offer.message && <p className="offer-message">“{offer.message}”</p>}
                {tab === "received" && offer.status === "pending" && (
                  <div className="offer-actions">
                    <button
                      type="button"
                      className="button button-primary small"
                      onClick={() => accept(offer)}
                      disabled={busyId === offer.id}
                    >
                      Accetta
                    </button>
                    <button
                      type="button"
                      className="button button-ghost small"
                      onClick={() => decline(offer)}
                      disabled={busyId === offer.id}
                    >
                      Rifiuta
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
