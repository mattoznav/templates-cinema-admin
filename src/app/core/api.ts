import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Booking, CheckIn, Genre, Hall, Movie, Page, Showtime, Summary, User, Venue } from './models';

/** All calls go to /api, proxied to the backend in development (see proxy.conf.json). */
export const API = '/api';

type Params = Record<string, string | number | null | undefined>;

function params(values: Params = {}): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') p = p.set(key, String(value));
  }
  return p;
}

/** Turn a DRF error response into one readable sentence. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (!(err instanceof HttpErrorResponse)) return fallback;
  if (err.status === 0) return 'The server cannot be reached. Check that the backend is running.';
  const data = err.error;
  if (data && typeof data === 'object') {
    if (typeof data.detail === 'string') return data.detail;
    const messages = Object.entries(data).flatMap(([field, value]) =>
      (Array.isArray(value) ? value : [value])
        .filter((v) => typeof v === 'string')
        .map((v) => (field === 'non_field_errors' ? v : `${field.replaceAll('_', ' ')}: ${v}`)),
    );
    if (messages.length) return messages.join(' ');
  }
  return fallback;
}

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  venue = () => this.http.get<Venue>(`${API}/venue/`);
  me = () => this.http.get<User>(`${API}/auth/me/`);
  genres = () => this.http.get<Genre[]>(`${API}/genres/`);
  halls = () => this.http.get<Hall[]>(`${API}/halls/`);

  summary = (date: string) => this.http.get<Summary>(`${API}/admin/summary/`, { params: params({ date }) });

  // Films
  movies = (filters: Params) => this.http.get<Page<Movie>>(`${API}/movies/`, { params: params(filters) });
  movie = (slug: string) => this.http.get<Movie>(`${API}/movies/${slug}/`);
  createMovie = (data: Partial<Movie>) => this.http.post<Movie>(`${API}/movies/`, data);
  updateMovie = (slug: string, data: Partial<Movie>) => this.http.patch<Movie>(`${API}/movies/${slug}/`, data);
  deleteMovie = (slug: string) => this.http.delete<void>(`${API}/movies/${slug}/`);

  // Programme
  showtimes = (filters: Params) => this.http.get<Page<Showtime>>(`${API}/showtimes/`, { params: params(filters) });
  createShowtime = (data: Partial<Showtime>) => this.http.post<Showtime>(`${API}/showtimes/`, data);
  updateShowtime = (id: number, data: Partial<Showtime>) => this.http.patch<Showtime>(`${API}/showtimes/${id}/`, data);
  deleteShowtime = (id: number) => this.http.delete<void>(`${API}/showtimes/${id}/`);

  // Bookings and tickets
  bookings = (filters: Params) => this.http.get<Page<Booking>>(`${API}/bookings/`, { params: params(filters) });
  booking = (id: number) => this.http.get<Booking>(`${API}/bookings/${id}/`);
  cancelBooking = (id: number) => this.http.post<Booking>(`${API}/bookings/${id}/cancel/`, {});
  checkIn = (code: string): Observable<CheckIn> =>
    this.http.post<CheckIn>(`${API}/tickets/${encodeURIComponent(code)}/check-in/`, {});
}
