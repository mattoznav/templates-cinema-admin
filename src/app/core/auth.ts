import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, map, shareReplay, switchMap, throwError } from 'rxjs';

import { API } from './api';
import { User } from './models';

interface Tokens {
  access: string;
  refresh: string;
}

const STORAGE_KEY = 'cinema.admin.auth';

/**
 * Staff sign-in with the backend's JWT endpoints. Tokens live in localStorage
 * so a refresh keeps the session; customers without staff rights are refused.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);

  private tokens = signal<Tokens | null>(this.read());
  readonly user = signal<User | null>(null);
  readonly signedIn = computed(() => this.tokens() !== null);

  private refreshing: Observable<Tokens> | null = null;

  get access(): string | null {
    return this.tokens()?.access ?? null;
  }

  async signIn(email: string, password: string): Promise<void> {
    const tokens = await firstValueFrom(this.http.post<Tokens>(`${API}/auth/token/`, { email, password }));
    this.store(tokens);
    const user = await this.loadUser();
    if (!user?.is_staff) {
      this.signOut(false);
      throw new Error('This account cannot use the back office. Ask an administrator for staff access.');
    }
  }

  async loadUser(): Promise<User | null> {
    if (!this.tokens()) return null;
    try {
      const user = await firstValueFrom(this.http.get<User>(`${API}/auth/me/`));
      this.user.set(user);
      return user;
    } catch {
      return null;
    }
  }

  signOut(redirect = true): void {
    this.store(null);
    this.user.set(null);
    if (redirect) this.router.navigateByUrl('/login');
  }

  /** One refresh at a time, shared by every request that hit a 401. */
  refresh(): Observable<Tokens> {
    const current = this.tokens();
    if (!current) return throwError(() => new Error('Not signed in'));
    this.refreshing ??= this.http.post<{ access: string }>(`${API}/auth/token/refresh/`, { refresh: current.refresh }).pipe(
      map((res) => ({ ...current, ...res })),
      map((tokens) => {
        this.store(tokens);
        return tokens;
      }),
      finalize(() => (this.refreshing = null)),
      shareReplay(1),
    );
    return this.refreshing;
  }

  private store(tokens: Tokens | null) {
    this.tokens.set(tokens);
    try {
      if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked: the session lasts until the tab closes
    }
  }

  private read(): Tokens | null {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }
}

const isAuthCall = (url: string) => url.includes('/auth/token/');

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const withToken = (token: string | null) =>
    token && !isAuthCall(req.url) ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(withToken(auth.access)).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || isAuthCall(req.url) || !auth.access) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(
        switchMap((tokens) => next(withToken(tokens.access))),
        catchError((refreshErr) => {
          auth.signOut();
          return throwError(() => refreshErr);
        }),
      );
    }),
  );
};

export const staffGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!auth.signedIn()) return router.parseUrl('/login');
  const user = auth.user() ?? (await auth.loadUser());
  if (user?.is_staff) return true;
  auth.signOut(false);
  return router.parseUrl('/login');
};
