import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom, forkJoin, map } from 'rxjs';

import { Api, errorMessage } from '../../core/api';
import { Icon } from '../../core/icon';
import { Hall, Movie, Showtime } from '../../core/models';
import { VenueSettings, VenueTimePipe } from '../../core/venue';
import { DayPicker } from '../../layout/day-picker';

const LANGUAGES = ['en', 'it', 'fr', 'de', 'es', 'ko', 'ja', 'fa', 'ar', 'hi', 'no', 'pt'];

@Component({
  selector: 'app-programme',
  imports: [ReactiveFormsModule, Icon, VenueTimePipe, DayPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page__head">
        <h1 class="page__title">Programme</h1>
        <div class="toolbar">
          <app-day-picker [(day)]="day" />
          <button type="button" class="btn btn--primary" (click)="openNew()"><app-icon name="plus" [size]="16" /> New showtime</button>
        </div>
      </header>

      @if (error()) {
        <p class="alert" role="alert"><app-icon name="warning" [size]="18" /> {{ error() }}</p>
      }

      @if (loaded()) {
        <section class="timeline" aria-label="Showtimes by screen">
          <div class="timeline__hours" aria-hidden="true">
            <span class="timeline__corner"></span>
            <div class="timeline__scale">
              @for (h of hours(); track h; let last = $last) {
                @if (!last) {
                  <span [style.left.%]="pos(h * 60)">{{ h % 24 }}:00</span>
                }
              }
            </div>
          </div>
          @for (hall of halls(); track hall.id) {
            <div class="lane">
              <div class="lane__name">
                <strong>{{ hall.name }}</strong>
                <span class="muted">{{ hall.format }}</span>
              </div>
              <div class="lane__track">
                @for (h of hours(); track h) {
                  <span class="lane__tick" [style.left.%]="pos(h * 60)"></span>
                }
                @for (s of byHall().get(hall.id) ?? []; track s.id) {
                  <button
                    type="button"
                    class="show"
                    [class.is-past]="!s.is_bookable"
                    [style.left.%]="pos(minutes(s.starts_at))"
                    [style.width.%]="span(s)"
                    (click)="openEdit(s)"
                    [attr.aria-label]="(s.starts_at | venueTime) + ', ' + s.movie_title + ', ' + hall.name + '. Edit'"
                  >
                    <span class="show__time mono">{{ s.starts_at | venueTime }}</span>
                    <span class="show__title">{{ s.movie_title }}</span>
                  </button>
                }
              </div>
            </div>
          }
        </section>
        @if (!showtimes().length) {
          <div class="empty">
            <p>Nothing scheduled on this day yet.</p>
            <button type="button" class="btn btn--ghost" (click)="openNew()">Add the first showtime</button>
          </div>
        }
      } @else {
        <div class="skeleton" style="height: 360px"></div>
      }
    </div>

    @if (editing() !== undefined) {
      <div class="drawer-backdrop" (click)="close()"></div>
      <form class="drawer" [formGroup]="form" (ngSubmit)="save()" role="dialog" aria-modal="true" aria-labelledby="showtime-title">
        <div class="drawer__head">
          <h2 id="showtime-title">{{ editing() ? 'Edit showtime' : 'New showtime' }}</h2>
          <button type="button" class="btn btn--ghost btn--icon" (click)="close()" aria-label="Close"><app-icon name="x" [size]="18" /></button>
        </div>
        <div class="drawer__body">
          <div class="field">
            <label for="st-movie">Film</label>
            <select id="st-movie" formControlName="movie" (change)="onMovie()">
              <option value="" disabled>Choose a film</option>
              @for (m of movies(); track m.slug) {
                <option [value]="m.slug">{{ m.title }}{{ m.status === 'coming_soon' ? ' (coming soon)' : '' }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label for="st-hall">Screen</label>
            <select id="st-hall" formControlName="hall" (change)="onHall()">
              @for (h of halls(); track h.id) {
                <option [ngValue]="h.id">{{ h.name }} ({{ h.format }})</option>
              }
            </select>
          </div>
          <div class="grid2">
            <div class="field">
              <label for="st-date">Date</label>
              <input id="st-date" type="date" formControlName="date" />
            </div>
            <div class="field">
              <label for="st-time">Start</label>
              <input id="st-time" type="time" formControlName="time" step="300" />
              @if (endsAt()) {
                <span class="field__hint">Ends around {{ endsAt() }}, plus cleaning time.</span>
              }
            </div>
            <div class="field">
              <label for="st-price">Base price</label>
              <input id="st-price" type="number" min="0" step="0.5" formControlName="price" />
              <span class="field__hint">Before seat and ticket type adjustments.</span>
            </div>
            <div class="field">
              <label for="st-lang">Audio</label>
              <select id="st-lang" formControlName="language">
                @for (l of languages; track l) {
                  <option [value]="l">{{ languageName(l) }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label for="st-subs">Subtitles</label>
              <select id="st-subs" formControlName="subtitles">
                <option value="">None</option>
                @for (l of languages; track l) {
                  <option [value]="l">{{ languageName(l) }}</option>
                }
              </select>
            </div>
          </div>
          @if (formError()) {
            <p class="alert" role="alert"><app-icon name="warning" [size]="18" /> {{ formError() }}</p>
          }
        </div>
        <div class="drawer__foot">
          @if (editing(); as current) {
            <button type="button" class="btn btn--danger" (click)="remove(current)" [disabled]="busy()">
              <app-icon name="trash" [size]="16" /> Delete
            </button>
          }
          <span class="spacer"></span>
          <button type="button" class="btn btn--ghost" (click)="close()">Cancel</button>
          <button type="submit" class="btn btn--primary" [disabled]="busy() || form.invalid">Save</button>
        </div>
      </form>
    }
  `,
  styles: `
    .timeline {
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--bg-raised);
      overflow-x: auto;
    }

    .timeline__hours,
    .lane {
      display: grid;
      grid-template-columns: 150px minmax(720px, 1fr);
    }

    .timeline__hours {
      border-bottom: 1px solid var(--line);
    }

    .timeline__scale {
      position: relative;
      height: 34px;
    }

    .timeline__scale span {
      position: absolute;
      top: 9px;
      transform: translateX(-50%);
      font-family: var(--mono);
      font-size: 11px;
      color: var(--muted);
    }

    .lane + .lane {
      border-top: 1px solid var(--line);
    }

    .lane__name {
      display: grid;
      align-content: center;
      gap: 2px;
      padding: 0 16px;
      font-size: 14px;
      border-right: 1px solid var(--line);
    }

    .lane__name .muted {
      font-size: 12px;
    }

    .lane__track {
      position: relative;
      height: 76px;
    }

    .lane__tick {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--line);
      opacity: 0.6;
    }

    .show {
      position: absolute;
      top: 10px;
      bottom: 10px;
      display: grid;
      align-content: center;
      gap: 1px;
      min-width: 0;
      padding: 0 10px;
      overflow: hidden;
      border: 1px solid rgb(255 207 74 / 0.45);
      border-radius: 8px;
      background: rgb(255 207 74 / 0.12);
      text-align: left;
      cursor: pointer;
      transition: background-color 0.15s, border-color 0.15s;
    }

    .show:hover {
      background: rgb(255 207 74 / 0.22);
      border-color: var(--accent);
    }

    .show.is-past {
      border-color: var(--line-strong);
      background: var(--bg-hover);
      color: var(--muted);
    }

    .show__time {
      font-size: 12px;
      font-weight: 600;
    }

    .show__title {
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .spacer {
      flex: 1;
    }
  `,
})
export class Programme {
  private api = inject(Api);
  protected venue = inject(VenueSettings);
  private fb = inject(FormBuilder);

  protected readonly languages = LANGUAGES;
  protected day = signal(this.venue.dayKey());
  protected showtimes = signal<Showtime[]>([]);
  protected loaded = signal(false);
  protected error = signal('');
  protected halls = toSignal(this.api.halls(), { initialValue: [] as Hall[] });
  protected movies = toSignal(
    forkJoin([this.api.movies({ status: 'now_showing' }), this.api.movies({ status: 'coming_soon' })]).pipe(
      map(([a, b]) => [...a.results, ...b.results].sort((x, y) => x.title.localeCompare(y.title))),
    ),
    { initialValue: [] as Movie[] },
  );

  /** undefined: closed, null: creating, a showtime: editing it. */
  protected editing = signal<Showtime | null | undefined>(undefined);
  protected busy = signal(false);
  protected formError = signal('');
  protected form = this.fb.nonNullable.group({
    movie: ['', Validators.required],
    hall: [0, Validators.required],
    date: ['', Validators.required],
    time: ['18:00', Validators.required],
    price: ['9.00', Validators.required],
    language: ['en', Validators.required],
    subtitles: [''],
  });
  private formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  protected byHall = computed(() => {
    const groups = new Map<number, Showtime[]>();
    for (const s of this.showtimes()) groups.set(s.hall, [...(groups.get(s.hall) ?? []), s]);
    return groups;
  });

  /** Visible window: from 10:00 (or earlier) to midnight (or later). */
  private range = computed(() => {
    let start = 10 * 60;
    let end = 24 * 60;
    for (const s of this.showtimes()) {
      start = Math.min(start, Math.floor(this.minutes(s.starts_at) / 60) * 60);
      end = Math.max(end, Math.ceil(this.minutes(s.ends_at) / 60) * 60);
    }
    return { start, end };
  });

  protected hours = computed(() => {
    const { start, end } = this.range();
    return Array.from({ length: (end - start) / 60 + 1 }, (_, i) => start / 60 + i);
  });

  protected endsAt = computed(() => {
    const v = this.formValue();
    const movie = this.movies().find((m) => m.slug === v.movie);
    if (!movie?.runtime_minutes || !v.time || !v.date) return '';
    const start = this.venue.toInstant(v.date, v.time);
    const end = new Date(new Date(start).getTime() + movie.runtime_minutes * 60000).toISOString();
    return this.venue.format(end, { hour: '2-digit', minute: '2-digit' });
  });

  constructor() {
    effect(() => {
      this.load(this.day());
    });
  }

  private load(day: string) {
    this.loaded.set(false);
    this.error.set('');
    this.api.showtimes({ date: day }).subscribe({
      next: (page) => {
        this.showtimes.set(page.results);
        this.loaded.set(true);
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'The programme could not be loaded.'));
        this.loaded.set(true);
      },
    });
  }

  /** Minutes from midnight of the selected day, at the venue. */
  protected minutes(iso: string): number {
    const dayStart = new Date(this.venue.toInstant(this.day(), '00:00')).getTime();
    return (new Date(iso).getTime() - dayStart) / 60000;
  }

  protected pos(minutes: number): number {
    const { start, end } = this.range();
    return ((minutes - start) / (end - start)) * 100;
  }

  protected span(s: Showtime): number {
    const { start, end } = this.range();
    return ((this.minutes(s.ends_at) - this.minutes(s.starts_at)) / (end - start)) * 100;
  }

  protected languageName(code: string): string {
    try {
      return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) ?? code;
    } catch {
      return code;
    }
  }

  protected openNew() {
    const hall = this.halls()[0];
    this.form.reset({
      movie: '',
      hall: hall?.id ?? 0,
      date: this.day(),
      time: '18:00',
      price: hall?.base_price ?? '9.00',
      language: 'en',
      subtitles: '',
    });
    this.formError.set('');
    this.editing.set(null);
  }

  protected openEdit(s: Showtime) {
    this.form.reset({
      movie: s.movie,
      hall: s.hall,
      date: this.venue.dayKey(new Date(s.starts_at)),
      time: this.venue.format(s.starts_at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      price: s.price,
      language: s.language,
      subtitles: s.subtitles,
    });
    this.formError.set('');
    this.editing.set(s);
  }

  protected close() {
    this.editing.set(undefined);
  }

  /** Default audio to the film's original language, with English subtitles if it is not English. */
  protected onMovie() {
    const movie = this.movies().find((m) => m.slug === this.form.controls.movie.value);
    const original = movie?.languages[0] ?? 'en';
    if (!this.editing()) {
      this.form.patchValue({ language: LANGUAGES.includes(original) ? original : 'en', subtitles: original !== 'en' ? 'en' : '' });
    }
  }

  protected onHall() {
    const hall = this.halls().find((h) => h.id === Number(this.form.controls.hall.value));
    if (hall && !this.editing()) this.form.patchValue({ price: hall.base_price });
  }

  protected async save() {
    const v = this.form.getRawValue();
    const payload = {
      movie: v.movie,
      hall: Number(v.hall),
      starts_at: this.venue.toInstant(v.date, v.time),
      price: v.price,
      language: v.language,
      subtitles: v.subtitles,
    };
    this.busy.set(true);
    this.formError.set('');
    try {
      const current = this.editing();
      await firstValueFrom(current ? this.api.updateShowtime(current.id, payload) : this.api.createShowtime(payload));
      this.close();
      if (v.date !== this.day()) this.day.set(v.date);
      else this.load(this.day());
    } catch (err) {
      this.formError.set(errorMessage(err, 'The showtime could not be saved.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(s: Showtime) {
    if (!confirm(`Delete the ${this.venue.format(s.starts_at, { hour: '2-digit', minute: '2-digit' })} showing of ${s.movie_title}?`)) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.deleteShowtime(s.id));
      this.close();
      this.load(this.day());
    } catch (err) {
      this.formError.set(errorMessage(err, 'The showtime could not be deleted.'));
    } finally {
      this.busy.set(false);
    }
  }
}
