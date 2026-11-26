import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ItemCard } from "../components/ItemCard";
import { EmptyState, PageHeader, Spinner } from "../components/ui";
import { HeartIcon } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import type { Item } from "../lib/types";

export function Favorites() {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      const result = await api.favorites(token);
      setItems(result.items);
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

  async function remove(item: Item) {
    setBusyId(item.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      await api.toggleFavorite(item.id, token);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      showToast("Rimosso dai preferiti", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="I tuoi preferiti"
        subtitle="Tieni da parte gli annunci che ti piacciono e ritrovali qui."
      />
      {loading ? (
        <Spinner />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<HeartIcon width={34} height={34} />}
          title="Nessun preferito, per ora"
          description="Tocca il cuore su un annuncio per salvarlo."
          action={
            <button type="button" className="button button-primary" onClick={() => navigate("/")}>
              Scopri gli annunci
            </button>
          }
        />
      ) : (
        <div className="item-grid">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onToggleFavorite={remove} busy={busyId === item.id} />
          ))}
        </div>
      )}
      {!loading && items.length > 0 && (
        <p className="center muted">
          <Link to="/">Continua a scoprire →</Link>
        </p>
      )}
    </div>
  );
}
