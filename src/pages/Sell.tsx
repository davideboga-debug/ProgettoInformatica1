import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, uploadImage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";
import type { Category, Size } from "../lib/types";
import { CameraIcon, XIcon } from "../components/icons";
import { PageHeader } from "../components/ui";

const conditions = [
  ["nuovo", "Nuovo con etichetta"],
  ["come_nuovo", "Come nuovo"],
  ["ottimo", "Ottimo"],
  ["buono", "Buono"],
  ["discreto", "Discreto"],
] as const;

export function Sell() {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    categoryId: "",
    sizeId: "",
    condition: "ottimo",
    city: "",
  });

  useEffect(() => {
    api.categories().then(setCategories).catch(() => setCategories([]));
    api.sizes().then(setSizes).catch(() => setSizes([]));
  }, []);

  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = [...photos, ...Array.from(files)].slice(0, 6);
    setPhotos(next);
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, position) => position !== index));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (photos.length === 0) {
      showToast("Aggiungi almeno una foto", "error");
      return;
    }
    const priceCents = Math.round(Number(form.price.replace(",", ".")) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 100) {
      showToast("Inserisci un prezzo di almeno 1,00 €", "error");
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sessione scaduta, accedi di nuovo.");

      const photoKeys: string[] = [];
      for (let index = 0; index < photos.length; index += 1) {
        setProgress(`Carico foto ${index + 1} di ${photos.length}…`);
        const uploaded = await uploadImage(photos[index], token, "item");
        photoKeys.push(uploaded.key);
      }

      setProgress("Pubblico l'annuncio…");
      const item = await api.createItem(
        {
          title: form.title,
          description: form.description,
          priceCents,
          categoryId: form.categoryId ? Number(form.categoryId) : null,
          sizeId: form.sizeId ? Number(form.sizeId) : null,
          condition: form.condition,
          city: form.city || null,
          photoKeys,
        },
        token,
      );
      showToast("Annuncio pubblicato!", "success");
      navigate(`/annuncio/${item.id}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Pubblicazione non riuscita", "error");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="sell-page">
      <PageHeader
        title="Vendi un capo"
        subtitle="Scatta qualche foto, racconta l'oggetto e scegli un prezzo. Ci pensiamo noi al resto."
      />

      <form className="sell-form" onSubmit={submit}>
        <section className="panel">
          <h2>Foto</h2>
          <p className="muted">Fino a 6 immagini. La prima sarà la copertina dell'annuncio.</p>
          <div className="photo-grid">
            {previews.map((preview, index) => (
              <div key={preview} className="photo-preview">
                <img src={preview} alt={`Foto ${index + 1}`} />
                <button
                  type="button"
                  className="photo-remove"
                  onClick={() => removePhoto(index)}
                  aria-label="Rimuovi foto"
                >
                  <XIcon width={16} height={16} />
                </button>
                {index === 0 && <span className="cover-tag">Copertina</span>}
              </div>
            ))}
            {photos.length < 6 && (
              <label className="photo-add">
                <CameraIcon width={28} height={28} />
                <span>Aggiungi foto</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => addFiles(event.target.files)}
                  hidden
                />
              </label>
            )}
          </div>
        </section>

        <section className="panel">
          <h2>Dettagli</h2>
          <div className="form">
            <label>
              Titolo
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                maxLength={120}
                placeholder="Es. Giacca di pelle vintage"
                required
              />
            </label>
            <label>
              Descrizione
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={4000}
                placeholder="Condizioni, vestibilità, eventuali difetti…"
              />
            </label>
            <div className="form-row">
              <label>
                Categoria
                <select
                  value={form.categoryId}
                  onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                >
                  <option value="">Scegli…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Taglia
                <select
                  value={form.sizeId}
                  onChange={(event) => setForm({ ...form, sizeId: event.target.value })}
                >
                  <option value="">Scegli…</option>
                  {sizes.map((size) => (
                    <option key={size.id} value={size.id}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Condizione
                <select
                  value={form.condition}
                  onChange={(event) => setForm({ ...form, condition: event.target.value })}
                >
                  {conditions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prezzo (€)
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  placeholder="29,00"
                  required
                />
              </label>
            </div>
            <label>
              Città
              <input
                value={form.city}
                onChange={(event) => setForm({ ...form, city: event.target.value })}
                placeholder="Es. Rimini"
              />
            </label>
          </div>
        </section>

        <div className="sell-actions">
          {progress && <span className="progress-note">{progress}</span>}
          <button type="submit" className="button button-primary button-large" disabled={busy}>
            {busy ? "Pubblico…" : "Pubblica annuncio"}
          </button>
        </div>
      </form>
    </div>
  );
}
