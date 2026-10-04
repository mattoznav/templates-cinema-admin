import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { Api, errorMessage } from '../../core/api';
import { Icon } from '../../core/icon';
import { Movie, MovieStatus, Page } from '../../core/models';

export const STATUS_LABELS: Record<MovieStatus, string> = {
  now_showing: 'Now showing',
  coming_soon: 'Coming soon',
  archive: 'Archive',
};

@Component({
  selector: 'app-films',
  imports: [RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page__head">
        <h1 class="page__title">Films</h1>
        <a class="btn btn--primary" routerLink="/films/new"><app-icon name="plus" [size]="16" /> New film</a>
      </header>

      <div class="toolbar">
        <div class="segments" role="group" aria-label="Status">
          @for (option of statuses; track option.value) {
            <button type="button" [attr.aria-pressed]="status() === option.value" (click)="setStatus(option.value)">{{ option.label }}</button>
          }
        </div>
        <label class="search">
          <span class="sr-only">Search films</span>
          <app-icon name="magnifying-glass" [size]="16" />
          <input class="input" type="search" placeholder="Title, cast or director" [value]="query()" (input)="search$.next($any($event.target).value)" />
        </label>
      </div>

      @if (error()) {
        <p class="alert" role="alert"><app-icon name="warning" [size]="18" /> {{ error() }}</p>
      }

      @if (page(); as p) {
        @if (p.results.length) {
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th><span class="sr-only">Poster</span></th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Release</th>
                  <th class="num">Runtime</th>
                  <th>Genres</th>
                </tr>
              </thead>
              <tbody>
                @for (m of p.results; track m.id) {
                  <tr class="is-link" (click)="open(m)">
                    <td class="poster-cell"><img [src]="m.poster" alt="" width="36" height="54" loading="lazy" /></td>
                    <td>
                      <a [routerLink]="['/films', m.slug]" class="title" (click)="$event.stopPropagation()">{{ m.title }}</a>
                      <div class="muted small">{{ m.directors.join(', ') }}</div>
                    </td>
                    <td><span class="badge" [class]="'badge badge--' + m.status">{{ labels[m.status] }}</span></td>
                    <td class="mono small">{{ m.release_date }}</td>
                    <td class="num">{{ m.runtime_minutes ? m.runtime_minutes + ' min' : '' }}</td>
                    <td class="small">{{ genreNames(m.genres) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="pager">
            <span>{{ p.count }} {{ p.count === 1 ? 'film' : 'films' }}</span>
            <div class="toolbar">
              <button type="button" class="btn btn--ghost" [disabled]="!p.previous" (click)="pageNumber.set(pageNumber() - 1)">Previous</button>
              <span>Page {{ pageNumber() }}</span>
              <button type="button" class="btn btn--ghost" [disabled]="!p.next" (click)="pageNumber.set(pageNumber() + 1)">Next</button>
            </div>
          </div>
        } @else {
          <div class="empty">
            <p>No films match.</p>
            <a class="btn btn--ghost" routerLink="/films/new">Add a film</a>
          </div>
        }
      } @else if (!error()) {
        <div class="skeleton" style="height: 420px"></div>
      }
    </div>
  `,
  styles: `
    .poster-cell {
      width: 60px;
    }

    .poster-cell img {
      width: 36px;
      height: 54px;
      border-radius: 4px;
      object-fit: cover;
      background: var(--bg-hover);
    }

    .title {
      font-weight: 600;
      text-decoration: none;
    }

    .title:hover {
      color: var(--accent);
    }

    .small {
      font-size: 13px;
    }
  `,
})
export class Films {
  private api = inject(Api);
  private router = inject(Router);

  protected readonly labels = STATUS_LABELS;
  protected readonly statuses: { value: MovieStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'now_showing', label: 'Now showing' },
    { value: 'coming_soon', label: 'Coming soon' },
    { value: 'archive', label: 'Archive' },
  ];

  protected status = signal<MovieStatus | ''>('now_showing');
  protected query = signal('');
  protected pageNumber = signal(1);
  protected page = signal<Page<Movie> | null>(null);
  protected error = signal('');
  protected search$ = new Subject<string>();
  private genres = toSignal(this.api.genres(), { initialValue: [] });
  private genreIndex = computed(() => new Map(this.genres().map((g) => [g.slug, g.name])));

  constructor() {
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe((q) => {
      this.pageNumber.set(1);
      this.query.set(q);
    });

    effect((onCleanup) => {
      const filters = { status: this.status(), q: this.query(), page: this.pageNumber() };
      this.page.set(null);
      this.error.set('');
      const sub = this.api.movies(filters).subscribe({
        next: (p) => this.page.set(p),
        error: (err) => this.error.set(errorMessage(err, 'The films could not be loaded.')),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected genreNames(slugs: string[]): string {
    return slugs.map((s) => this.genreIndex().get(s) ?? s).join(', ');
  }

  protected setStatus(value: MovieStatus | '') {
    this.pageNumber.set(1);
    this.status.set(value);
  }

  protected open(m: Movie) {
    this.router.navigate(['/films', m.slug]);
  }
}
