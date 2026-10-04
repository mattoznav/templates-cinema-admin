export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
}

export interface Venue {
  name: string;
  timezone: string;
  currency: string;
}

export type MovieStatus = 'now_showing' | 'coming_soon' | 'archive';

export interface Movie {
  id: number;
  slug: string;
  title: string;
  status: MovieStatus;
  release_date: string | null;
  runtime_minutes: number | null;
  synopsis: string;
  genres: string[];
  directors: string[];
  cast: string[];
  countries: string[];
  languages: string[];
  poster: string;
  poster_url: string;
  trailer_youtube_id: string;
  popularity: number;
  source_url: string;
}

export interface Genre {
  id: number;
  slug: string;
  name: string;
}

export interface Hall {
  id: number;
  name: string;
  format: string;
  rows: number;
  seats_per_row: number;
  base_price: string;
  capacity: number;
}

export interface Showtime {
  id: number;
  movie: string;
  movie_title: string;
  hall: number;
  hall_name: string;
  hall_format: string;
  starts_at: string;
  ends_at: string;
  price: string;
  language: string;
  subtitles: string;
  is_bookable: boolean;
}

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'expired';

export interface Booking {
  id: number;
  reference: string;
  status: BookingStatus;
  showtime: {
    id: number;
    starts_at: string;
    movie: { slug: string; title: string };
    hall: { id: number; name: string; format: string };
  };
  seats: {
    seat: string;
    seat_type: string;
    ticket_type: string;
    price: string;
    ticket: { code: string; checked_in_at: string | null } | null;
  }[];
  total: string;
  currency: string;
  expires_at: string;
  created_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  can_cancel: boolean;
  customer: { email: string; name: string } | null;
  payments: { provider: string; status: string; amount: string; created_at: string }[] | null;
}

export interface Summary {
  date: string;
  currency: string;
  totals: { showtimes: number; capacity: number; sold: number; held: number; checked_in: number; revenue: string | number };
  sales_today: { bookings: number; tickets: number; revenue: string | number };
  showtimes: {
    id: number;
    starts_at: string;
    ends_at: string;
    movie: { slug: string; title: string };
    hall: { id: number; name: string; format: string };
    capacity: number;
    sold: number;
    held: number;
    checked_in: number;
    revenue: string | number;
  }[];
}

export interface CheckIn {
  code: string;
  seat: string;
  booking: string;
  movie: string;
  starts_at: string;
  checked_in_at?: string;
  detail?: string;
}
