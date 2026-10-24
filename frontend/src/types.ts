export type User = {
  id: number;
  name: string;
  email: string;
  role: "reader" | "admin";
};
export type Taxon = { id: number; name: string; slug?: string; code?: string };
export type Book = {
  id: number;
  title: string;
  slug: string;
  description: string;
  author: Taxon;
  author_id: number;
  language: Taxon;
  language_id: number;
  categories: Taxon[];
  tags: string[];
  publisher: string;
  publication_year: number;
  isbn?: string;
  rights_status: string;
  rights_evidence?: string;
  read_available: boolean;
  download_available: boolean;
  download_price_paise: number;
  status: string;
  page_count: number;
  render_status: string;
  has_cover?: boolean;
  files?: { kind: string }[];
};
export type Page<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
};
export type Taxonomies = {
  authors: Taxon[];
  languages: Taxon[];
  categories: Taxon[];
  settings: Record<string, string>;
};
export type Order = {
  id: number;
  reference: string;
  book: Book;
  amount_paise: number;
  status: string;
  created_at: string;
  payments: { gateway_payment_id: string; status: string }[];
};
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);
