import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ItemCard } from "../components/ItemCard";
import { EmptyState, Spinner } from "../components/ui";
import { SearchIcon, SparkIcon } from "../components/icons";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import type { Category, Item } from "../lib/types";

export function Home() {
  const [params, setParams] = useSearchParams();
  const category = params.get("categoria") ?? "";
  const query = params.get("q") ?? "";
  const [search, setSearch] = useState(query);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { user, getToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const token = await getToken();
        const result = await api.items({ category: category || undefined, q: query || undefined }, token);
        if (!cancelled) setItems(result.items);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Errore di caricamento");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, query, getToken]);

  useEffect(() => {
    setSearch(query);
  }, [query]);

  const activeCategory = useMemo(
    () => categories.find((entry) => entry.slug === category),
    [categories, category],
  );

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (search.trim()) next.set("q", search.trim());
    else next.delete("q");
    setParams(next);
  }

  function selectCategory(slug: string) {
    const next = new URLSearchParams(params);
    if (slug) next.set("categoria", slug);
    else next.delete("categoria");
    setParams(next);
  }

  async function toggleFavorite(item: Item) {
    if (!user) {
      navigate("/auth?next=%2F");
      return;
    }
    setBusyId(item.id);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta, accedi di nuovo.");
      const result = await api.toggleFavorite(item.id, token);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                isFavorite: result.favorited,
                favoriteCount: entry.favoriteCount + (result.favorited ? 1 : -1),
              }
            : entry,
        ),
      );
      showToast(result.favorited ? "Aggiunto ai preferiti" : "Rimosso dai preferiti", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Operazione non riuscita", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <SparkIcon width={16} height={16} /> Seconda mano, primo amore
          </span>
          <h1>
            Dai nuova vita a quello che <em>non usi più</em>.
          </h1>
          <p>
            Compra e vendi abiti, accessori e oggetti scelti con cura. Meno sprechi, più stile,
            tutto vicino a te.
          </p>
          <form className="hero-search" onSubmit={submitSearch} role="search">
            <SearchIcon width={20} height={20} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca un capo, una taglia, un oggetto…"
              aria-label="Cerca annunci"
            />
            <button type="submit" className="button button-primary">
              Cerca
            </button>
          </form>
          <div className="hero-stats">
            <span>
              <strong>12+</strong> annunci demo
            </span>
            <span>
              <strong>7</strong> categorie
            </span>
            <span>
              <strong>100%</strong> usato
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-card card-a">
            <span>👗</span>
            <small>Vestito a fiori</small>
            <strong>29 €</strong>
          </div>
          <div className="hero-card card-b">
            <span>👟</span>
            <small>Sneaker retro</small>
            <strong>38 €</strong>
          </div>
          <div className="hero-card card-c">
            <span>👜</span>
            <small>Borsa in cuoio</small>
            <strong>62 €</strong>
          </div>
          <div className="hero-orbit" />
        </div>
      </section>

      <section className="filters" aria-label="Categorie">
        <button
          type="button"
          className={`chip${category === "" ? " active" : ""}`}
          onClick={() => selectCategory("")}
        >
          Tutto
        </button>
        {categories.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`chip${category === entry.slug ? " active" : ""}`}
            onClick={() => selectCategory(entry.slug)}
          >
            <span aria-hidden="true">{entry.icon}</span>
            {entry.name}
          </button>
        ))}
      </section>

      <section className="feed-section">
        <div className="section-head">
          <div>
            <h2>{activeCategory ? activeCategory.name : query ? `Risultati per “${query}”` : "Appena aggiunti"}</h2>
            <p>
              {loading ? "Carico gli annunci…" : `${items.length} annunci disponibili`}
            </p>
          </div>
          <Link to="/vendi" className="text-link">
            Vendi anche tu →
          </Link>
        </div>

        {loading ? (
          <Spinner label="Carico gli annunci…" />
        ) : error ? (
          <EmptyState
            title="Non riesco a caricare gli annunci"
            description={error}
            action={
              <button type="button" className="button button-primary" onClick={() => setParams(params)}>
                Riprova
              </button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nessun annuncio trovato"
            description="Prova con un'altra categoria o con una ricerca diversa."
            action={
              <button type="button" className="button button-ghost" onClick={() => setParams({})}>
                Azzera filtri
              </button>
            }
          />
        ) : (
          <div className="item-grid">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onToggleFavorite={toggleFavorite}
                busy={busyId === item.id}
              />
            ))}
          </div>
        )}
      </section>

      <section className="how-it-works">
        <div className="how-card">
          <span className="how-number">01</span>
          <h3>Fotografa</h3>
          <p>Carica le foto del capo o dell'oggetto. Le immagini finiscono su Neon Object Storage.</p>
        </div>
        <div className="how-card">
          <span className="how-number">02</span>
          <h3>Pubblica</h3>
          <p>Titolo, categoria, taglia e prezzo. Il tuo annuncio è subito visibile nel feed.</p>
        </div>
        <div className="how-card">
          <span className="how-number">03</span>
          <h3>Vendi</h3>
          <p>Ricevi offerte, accettale e gestisci la spedizione. I pagamenti sono simulati.</p>
        </div>
      </section>
    </div>
  );
}
