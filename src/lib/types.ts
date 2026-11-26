export type Category = {
  id: number;
  slug: string;
  name: string;
  icon: string | null;
};

export type Size = {
  id: number;
  label: string;
};

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  author: { name: string; avatarUrl: string | null };
};

export type Seller = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio?: string | null;
  city?: string | null;
  rating?: number;
  reviewCount?: number;
  soldCount?: number;
  joinedAt?: string;
};

export type Item = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  condition: string;
  status: string;
  city: string | null;
  createdAt: string;
  category: { id: number; name: string; slug: string } | null;
  size: string | null;
  seller: Seller;
  coverUrl: string | null;
  favoriteCount: number;
  isFavorite: boolean;
};

export type ItemDetail = Item & {
  photos: string[];
  seller: Seller;
  sellerReviews: Review[];
};

export type Profile = Seller & {
  bio: string | null;
  city: string | null;
  rating: number;
  reviewCount: number;
  soldCount: number;
  joinedAt: string;
};

export type Offer = {
  id: string;
  itemId: string;
  title: string;
  coverUrl: string | null;
  askingPriceCents: number;
  amountCents: number;
  message: string | null;
  status: string;
  createdAt: string;
  buyerName: string;
  sellerName: string;
};

export type Order = {
  id: string;
  amountCents: number;
  status: string;
  createdAt: string;
  role: "buyer" | "seller";
  item: { id: string; title: string; coverUrl: string | null };
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
  shipping: { name: string | null; address: string | null; city: string | null; postalCode: string | null };
  payment: { provider: string | null; status: string | null; paidAt: string | null };
  shipment: {
    status: string | null;
    carrier: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  };
  review: { id: string; rating: number; comment: string | null } | null;
};

export type Me = {
  profile: Profile;
  counts: {
    activeItems: number;
    soldItems: number;
    purchases: number;
    favorites: number;
    pendingOffers: number;
  };
};
