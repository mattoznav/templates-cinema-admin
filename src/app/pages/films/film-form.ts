import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, errorMessage } from '../../core/api';
import { Icon } from '../../core/icon';
import { Genre, Movie } from '../../core/models';
import { STATUS_LABELS } from './films';

const list = (value: string) =>
  value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

@Component({
  selector: 'app-film-form',
  imports: [ReactiveFormsModule, RouterLink, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <a routerLink="/films" class="back"><app-icon name="arrow-left" [size]="16" /> Films</a>
      <header class="page__head">
        <h1 class="page__title">{{ slug() ? form.controls.title.value || 'Edit film' : 'New film' }}</h1>
      </header>

      @if (loading()) {
        <div class="skeleton" style="height: 480px"></div>
      } @else {
        <form class="layout" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <div class="main-col">
            <section class="card">
              <div class="field">
                <label for="f-title">Title</label>
                <input id="f-title" formControlName="title" (input)="syncSlug()" />
                @if (form.controls.title.touched && form.controls.title.invalid) {
                  <span class="field__error">A title is required.</span>
                }
              </div>
              <div class="field">
                <label for="f-slug">Web address</label>
                <input id="f-slug" formControlName="slug" class="mono" />
                <span class="field__hint">Used in the film page link: /films/{{ form.controls.slug.value || 'film-title' }}/</span>
              </div>
              <div class="field">
                <label for="f-synopsis">Synopsis</label>
                <textarea id="f-synopsis" formControlName="synopsis" rows="7"></textarea>
              </div>
            </section>

            <section class="card">
              <h2 class="card__title">People</h2>
              <div class="field">
                <label for="f-directors">Directed by</label>
                <input id="f-directors" formControlName="directors" />
                <span class="field__hint">Separate names with commas.</span>
              </div>
              <div class="field">
                <label for="f-cast">Starring</label>
                <input id="f-cast" formControlName="cast" />
                <span class="field__hint">The first names are shown on the website.</span>
              </div>
            </section>

            <section class="card">
              <h2 class="card__title">Genres</h2>
              <div class="chips" role="group" aria-label="Genres">
                @for (g of genres(); track g.slug) {
                  <button type="button" class="chip" [attr.aria-pressed]="selected().includes(g.slug)" (click)="toggleGenre(g.slug)">
                    {{ g.name }}
                  </button>
                }
              </div>
            </section>
          </div>

          <aside class="side-col">
            <section class="card">
              <div class="field">
                <label for="f-status">Status</label>
                <select id="f-status" formControlName="status">
                  @for (s of statusOptions; track s[0]) {
                    <option [value]="s[0]">{{ s[1] }}</option>
                  }
                </select>
                <span class="field__hint">Archived films stay in past bookings but leave the website.</span>
              </div>
              <div class="field">
                <label for="f-release">Release date</label>
                <input id="f-release" type="date" formControlName="release_date" />
              </div>
              <div class="field">
                <label for="f-runtime">Running time, minutes</label>
                <input id="f-runtime" type="number" min="1" formControlName="runtime_minutes" />
                <span class="field__hint">Needed to schedule showtimes.</span>
              </div>
              <div class="field">
                <label for="f-languages">Original languages</label>
                <input id="f-languages" formControlName="languages" class="mono" />
                <span class="field__hint">Two-letter codes, for example en, it.</span>
              </div>
            </section>

            <section class="card">
              <img class="poster" [src]="posterPreview()" alt="" width="180" height="270" />
              <div class="field">
                <label for="f-poster">Poster image address</label>
                <input id="f-poster" type="url" formControlName="poster_url" placeholder="https://" />
                <span class="field__hint">Leave empty to use the generated poster.</span>
              </div>
              <div class="field">
                <label for="f-trailer">YouTube trailer ID</label>
                <input id="f-trailer" formControlName="trailer_youtube_id" class="mono" />
                @if (form.controls.trailer_youtube_id.value) {
                  <a class="field__hint" [href]="'https://www.youtube.com/watch?v=' + form.controls.trailer_youtube_id.value" target="_blank" rel="noopener">Watch on YouTube</a>
                }
              </div>
            </section>
          </aside>

          <footer class="actions">
            @if (error()) {
              <p class="alert" role="alert"><app-icon name="warning" [size]="18" /> {{ error() }}</p>
            }
            <div class="toolbar">
              @if (slug()) {
                <button type="button" class="btn btn--danger" (click)="remove()" [disabled]="busy()"><app-icon name="trash" [size]="16" /> Delete</button>
              }
              <span class="spacer"></span>
              <a routerLink="/films" class="btn btn--ghost">Cancel</a>
              <button type="submit" class="btn btn--primary" [disabled]="busy()">{{ slug() ? 'Save changes' : 'Create film' }}</button>
            </div>
          </footer>
        </form>
      }
    </div>
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--ink-soft);
      text-decoration: none;
      font-size: 14px;
    }

    .back:hover {
      color: var(--ink);
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
      gap: 20px;
      align-items: start;
    }

    .main-col,
    .side-col {
      display: grid;
      gap: 20px;
    }

    .card {
      display: grid;
      gap: 16px;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--bg-raised);
    }

    .card__title {
      font-size: 17px;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .chip {
      padding: 6px 14px;
      border: 1px solid var(--line-strong);
      border-radius: 999px;
      background: transparent;
      font-size: 13px;
      cursor: pointer;
    }

    .chip[aria-pressed='true'] {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
    }

    .poster {
      width: 140px;
      height: auto;
      border-radius: 6px;
      background: var(--bg-hover);
    }

    .actions {
      grid-column: 1 / -1;
      display: grid;
      gap: 12px;
      position: sticky;
      bottom: 0;
      padding: 14px 0;
      background: linear-gradient(transparent, var(--bg) 30%);
    }

    .spacer {
      flex: 1;
    }

    @media (max-width: 959px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FilmForm implements OnInit {
  private api = inject(Api);
  private router = inject(Router);

  /** From the route: missing when creating a new film */
  readonly slug = input<string>();

  protected readonly statusOptions = Object.entries(STATUS_LABELS);
  protected genres = toSignal(this.api.genres(), { initialValue: [] as Genre[] });
  protected selected = signal<string[]>([]);
  protected loading = signal(false);
  protected busy = signal(false);
  protected error = signal('');
  protected posterPreview = signal('');
  private slugEdited = false;

  protected form = inject(FormBuilder).nonNullable.group({
    title: ['', Validators.required],
    slug: ['', Validators.required],
    status: ['coming_soon'],
    release_date: [''],
    runtime_minutes: [null as number | null],
    synopsis: [''],
    directors: [''],
    cast: [''],
    languages: ['en'],
    poster_url: [''],
    trailer_youtube_id: [''],
  });

  async ngOnInit() {
    const slug = this.slug();
    if (!slug) return;
    this.loading.set(true);
    try {
      const movie = await firstValueFrom(this.api.movie(slug));
      this.fill(movie);
    } catch (err) {
      this.error.set(errorMessage(err, 'The film could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  private fill(m: Movie) {
    this.slugEdited = true;
    this.form.reset({
      title: m.title,
      slug: m.slug,
      status: m.status,
      release_date: m.release_date ?? '',
      runtime_minutes: m.runtime_minutes,
      synopsis: m.synopsis,
      directors: m.directors.join(', '),
      cast: m.cast.join(', '),
      languages: m.languages.join(', '),
      poster_url: m.poster_url,
      trailer_youtube_id: m.trailer_youtube_id,
    });
    this.selected.set(m.genres);
    this.posterPreview.set(m.poster);
  }

  protected syncSlug() {
    // Follow the title until someone edits the address by hand
    if (this.slug()) return;
    if (this.form.controls.slug.dirty) this.slugEdited = true;
    if (!this.slugEdited) this.form.controls.slug.setValue(slugify(this.form.controls.title.value));
  }

  protected toggleGenre(slug: string) {
    this.selected.update((list) => (list.includes(slug) ? list.filter((g) => g !== slug) : [...list, slug]));
  }

  protected async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.error.set('Fill in the title and the web address.');
      return;
    }
    const v = this.form.getRawValue();
    const payload: Partial<Movie> = {
      ...v,
      status: v.status as Movie['status'],
      release_date: v.release_date || null,
      runtime_minutes: v.runtime_minutes || null,
      directors: list(v.directors),
      cast: list(v.cast),
      languages: list(v.languages),
      genres: this.selected(),
    };
    this.busy.set(true);
    this.error.set('');
    try {
      const current = this.slug();
      const saved = await firstValueFrom(current ? this.api.updateMovie(current, payload) : this.api.createMovie(payload));
      await this.router.navigate(['/films', saved.slug], { replaceUrl: true });
      this.fill(saved);
    } catch (err) {
      this.error.set(errorMessage(err, 'The film could not be saved.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove() {
    const slug = this.slug();
    if (!slug || !confirm(`Delete ${this.form.controls.title.value}? This cannot be undone.`)) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteMovie(slug));
      await this.router.navigateByUrl('/films');
    } catch (err) {
      this.error.set(errorMessage(err, 'The film could not be deleted.'));
    } finally {
      this.busy.set(false);
    }
  }
}
