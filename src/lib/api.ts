import type { Category, Item, ItemDetail, Me, Offer, Order, Profile, Review, Size } from "./types";

const BASE = import.meta.env.VITE_API_URL || "/api";

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error || `Richiesta fallita (${response.status})`);
  }
  return data as T;
}

export const api = {
  health: () => request<{ ok: boolean; time: string; branch: string | null }>("/health"),
  categories: () => request<Category[]>("/categories"),
  sizes: () => request<Size[]>("/sizes"),
  items: (params: { category?: string; q?: string; seller?: string } = {}, token?: string | null) => {
    const search = new URLSearchParams();
    if (params.category) search.set("category", params.category);
    if (params.q) search.set("q", params.q);
    if (params.seller) search.set("seller", params.seller);
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return request<{ items: Item[] }>(`/items${suffix}`, { token });
  },
  item: (id: string, token?: string | null) => request<ItemDetail>(`/items/${id}`, { token }),
  createItem: (body: unknown, token: string) =>
    request<ItemDetail>("/items", { method: "POST", body, token }),
  toggleFavorite: (id: string, token: string) =>
    request<{ favorited: boolean }>(`/items/${id}/favorite`, { method: "POST", token }),
  favorites: (token: string) => request<{ items: Item[] }>("/me/favorites", { token }),
  createOffer: (id: string, body: { amountCents: number; message?: string }, token: string) =>
    request<Offer>(`/items/${id}/offers`, { method: "POST", body, token }),
  offers: (token: string) => request<{ received: Offer[]; sent: Offer[] }>("/me/offers", { token }),
  acceptOffer: (id: string, token: string) =>
    request<{ orderId: string }>(`/offers/${id}/accept`, { method: "POST", token }),
  declineOffer: (id: string, token: string) =>
    request<{ status: string }>(`/offers/${id}/decline`, { method: "POST", token }),
  buy: (id: string, body: unknown, token: string) =>
    request<{ orderId: string }>(`/items/${id}/buy`, { method: "POST", body, token }),
  orders: (token: string) => request<{ orders: Order[] }>("/me/orders", { token }),
  ship: (id: string, body: { carrier?: string; trackingNumber?: string }, token: string) =>
    request<{ status: string }>(`/orders/${id}/ship`, { method: "POST", body, token }),
  deliver: (id: string, token: string) =>
    request<{ status: string }>(`/orders/${id}/deliver`, { method: "POST", token }),
  review: (id: string, body: { rating: number; comment?: string }, token: string) =>
    request<Review>(`/orders/${id}/review`, { method: "POST", body, token }),
  user: (id: string, token?: string | null) =>
    request<{ profile: Profile; items: Item[]; reviews: Review[] }>(`/users/${id}`, { token }),
  me: (token: string) => request<Me>("/me", { token }),
  updateMe: (body: unknown, token: string) =>
    request<Profile>("/me", { method: "PATCH", body, token }),
  presignUpload: (
    body: { filename: string; contentType: string; kind?: "item" | "avatar" },
    token: string,
  ) =>
    request<{
      key: string;
      uploadUrl: string;
      publicUrl: string;
      headers: Record<string, string>;
      expiresIn: number;
    }>("/uploads/presign", { method: "POST", body, token }),
};

export async function uploadImage(
  file: File,
  token: string,
  kind: "item" | "avatar" = "item",
): Promise<{ key: string; publicUrl: string }> {
  const presigned = await api.presignUpload(
    { filename: file.name, contentType: file.type || "image/jpeg", kind },
    token,
  );
  const response = await fetch(presigned.uploadUrl, {
    method: "PUT",
    headers: presigned.headers,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload immagine fallito (${response.status})`);
  }
  return { key: presigned.key, publicUrl: presigned.publicUrl };
}
