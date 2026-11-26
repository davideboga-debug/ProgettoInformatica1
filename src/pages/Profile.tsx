import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ItemCard } from "../components/ItemCard";
import { Avatar, Badge, EmptyState, Modal, PageHeader, Spinner, Stars } from "../components/ui";
import { CameraIcon, PackageIcon, SparkIcon } from "../components/icons";
import { api, uploadImage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { timeAgo } from "../lib/format";
import { useToast } from "../lib/toast";
import type { Item, Me, Profile, Review } from "../lib/types";

function ProfileHeader({
  profile,
  stats,
  onEdit,
}: {
  profile: Profile;
  stats?: Me["counts"];
  onEdit?: () => void;
}) {
  return (
    <section className="profile-hero">
      <Avatar name={profile.name} src={profile.avatarUrl} size={92} />
      <div className="profile-main">
        <div className="profile-title-row">
          <h1>{profile.name}</h1>
          <Badge tone="accent">
            <SparkIcon width={13} height={13} /> Membro
          </Badge>
        </div>
        <div className="profile-meta">
          <Stars rating={profile.rating ?? 0} count={profile.reviewCount ?? 0} />
          <span>· {profile.soldCount ?? 0} venduti</span>
          {profile.city && <span>· {profile.city}</span>}
          {profile.joinedAt && <span>· dal {new Date(profile.joinedAt).getFullYear()}</span>}
        </div>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        {stats && (
          <div className="profile-stats">
            <div>
              <strong>{stats.activeItems}</strong>
              <span>In vendita</span>
            </div>
            <div>
              <strong>{stats.soldItems}</strong>
              <span>Venduti</span>
            </div>
            <div>
              <strong>{stats.purchases}</strong>
              <span>Acquisti</span>
            </div>
            <div>
              <strong>{stats.favorites}</strong>
              <span>Preferiti</span>
            </div>
          </div>
        )}
      </div>
      {onEdit && (
        <button type="button" className="button button-ghost" onClick={onEdit}>
          Modifica profilo
        </button>
      )}
    </section>
  );
}

function ReviewsList({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) {
    return <p className="muted">Ancora nessuna recensione ricevuta.</p>;
  }
  return (
    <div className="review-list">
      {reviews.map((review) => (
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
  );
}

export function MyProfile() {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ displayName: "", bio: "", city: "" });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      const meResult = await api.me(token);
      const [itemsResult, userResult] = await Promise.all([
        api.items({ seller: meResult.profile.id }, token),
        api.user(meResult.profile.id, token),
      ]);
      setMe(meResult);
      setItems(itemsResult.items);
      setReviews(userResult.reviews);
      setForm({
        displayName: meResult.profile.name,
        bio: meResult.profile.bio ?? "",
        city: meResult.profile.city ?? "",
      });
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

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta");
      let avatarKey: string | undefined;
      if (avatarFile) {
        const uploaded = await uploadImage(avatarFile, token, "avatar");
        avatarKey = uploaded.key;
      }
      await api.updateMe(
        {
          displayName: form.displayName,
          bio: form.bio,
          city: form.city,
          avatarKey,
        },
        token,
      );
      showToast("Profilo aggiornato", "success");
      setEditOpen(false);
      setAvatarFile(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Aggiornamento non riuscito", "error");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (!me) return <EmptyState title="Profilo non disponibile" />;

  return (
    <div>
      <PageHeader title="Il mio profilo" subtitle="La tua vetrina su Riuso." />
      <ProfileHeader profile={me.profile} stats={me.counts} onEdit={() => setEditOpen(true)} />

      <section className="profile-section">
        <div className="section-head">
          <h2>I miei annunci</h2>
          <Link to="/vendi" className="text-link">
            + Nuovo annuncio
          </Link>
        </div>
        {items.length === 0 ? (
          <EmptyState
            icon={<PackageIcon width={30} height={30} />}
            title="Non hai ancora pubblicato nulla"
            description="Dai una seconda vita a un capo che non indossi più."
            action={
              <Link to="/vendi" className="button button-primary">
                Pubblica il primo annuncio
              </Link>
            }
          />
        ) : (
          <div className="item-grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="profile-section">
        <h2>Recensioni ricevute</h2>
        <ReviewsList reviews={reviews} />
      </section>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Modifica profilo"
        footer={
          <>
            <button type="button" className="button button-ghost" onClick={() => setEditOpen(false)}>
              Annulla
            </button>
            <button type="submit" form="profile-form" className="button button-primary" disabled={busy}>
              {busy ? "Salvo…" : "Salva"}
            </button>
          </>
        }
      >
        <form id="profile-form" className="form" onSubmit={save}>
          <label>
            Nome visualizzato
            <input
              value={form.displayName}
              onChange={(event) => setForm({ ...form, displayName: event.target.value })}
              required
            />
          </label>
          <label>
            Bio
            <textarea
              rows={3}
              value={form.bio}
              onChange={(event) => setForm({ ...form, bio: event.target.value })}
              placeholder="Racconta cosa vendi e come spedisci."
            />
          </label>
          <label>
            Città
            <input
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
          </label>
          <label className="avatar-upload">
            <CameraIcon width={20} height={20} />
            {avatarFile ? avatarFile.name : "Cambia foto profilo"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </form>
      </Modal>
    </div>
  );
}

export function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const result = await api.user(id, token);
        if (!cancelled) {
          setProfile(result.profile);
          setItems(result.items);
          setReviews(result.reviews);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Utente non trovato");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, getToken]);

  if (loading) return <Spinner />;
  if (error || !profile) {
    return (
      <EmptyState
        title="Utente non trovato"
        description={error ?? undefined}
        action={
          <Link to="/" className="button button-primary">
            Torna al feed
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <ProfileHeader profile={profile} />
      <section className="profile-section">
        <h2>Annunci di {profile.name}</h2>
        {items.length === 0 ? (
          <p className="muted">Nessun annuncio attivo.</p>
        ) : (
          <div className="item-grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
      <section className="profile-section">
        <h2>Recensioni</h2>
        <ReviewsList reviews={reviews} />
      </section>
    </div>
  );
}
