import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, debounceTime, firstValueFrom } from 'rxjs';

import { Api, errorMessage } from '../../core/api';
import { Icon } from '../../core/icon';
import { Booking, BookingStatus, Page } from '../../core/models';
import { MoneyPipe, VenueDatePipe, VenueTimePipe } from '../../core/venue';

const STATUS_LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmed',
  pending: 'Awaiting payment',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

@Component({
  selector: 'app-bookings',
  imports: [Icon, MoneyPipe, VenueDatePipe, VenueTimePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page__head">
        <h1 class="page__title">Bookings</h1>
      </header>

      <div class="toolbar">
        <label class="search">
          <span class="sr-only">Search bookings</span>
          <app-icon name="magnifying-glass" [size]="16" />
          <input class="input" type="search" placeholder="Reference or email" [value]="query()" (input)="search$.next($any($event.target).value)" />
        </label>
        <div class="segments" role="group" aria-label="Status">
          @for (option of statuses; track option.value) {
            <button type="button" [attr.aria-pressed]="status() === option.value" (click)="setStatus(option.value)">{{ option.label }}</button>
          }
        </div>
        <input class="input date" type="date" [value]="date()" (change)="setDate($any($event.target).value)" aria-label="Show date" />
        @if (showtime() || date()) {
          <button type="button" class="btn btn--ghost" (click)="clearScope()">
            <app-icon name="x" [size]="14" /> {{ showtime() ? 'One screening' : 'One day' }}
          </button>
        }
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
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Screening</th>
                  <th class="num">Seats</th>
                  <th class="num">Total</th>
                  <th>Status</th>
                  <th>Booked</th>
                </tr>
              </thead>
              <tbody>
                @for (b of p.results; track b.id) {
                  <tr class="is-link" (click)="open(b)" tabindex="0" (keydown.enter)="open(b)">
                    <td class="mono">{{ b.reference }}</td>
                    <td>
                      <div>{{ b.customer?.name || b.customer?.email }}</div>
                      @if (b.customer?.name) {
                        <div class="muted small">{{ b.customer?.email }}</div>
                      }
                    </td>
                    <td>
                      <div>{{ b.showtime.movie.title }}</div>
                      <div class="muted small">{{ b.showtime.starts_at | venueDate }}, {{ b.showtime.starts_at | venueTime }}. {{ b.showtime.hall.name }}</div>
                    </td>
                    <td class="num">{{ b.seats.length }}</td>
                    <td class="num">{{ b.total | money: b.currency }}</td>
                    <td><span [class]="'badge badge--' + b.status">{{ labels[b.status] }}</span></td>
                    <td class="small muted">{{ b.created_at | venueDate: 'datetime' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="pager">
            <span>{{ p.count }} {{ p.count === 1 ? 'booking' : 'bookings' }}</span>
            <div class="toolbar">
              <button type="button" class="btn btn--ghost" [disabled]="!p.previous" (click)="pageNumber.set(pageNumber() - 1)">Previous</button>
              <span>Page {{ pageNumber() }}</span>
              <button type="button" class="btn btn--ghost" [disabled]="!p.next" (click)="pageNumber.set(pageNumber() + 1)">Next</button>
            </div>
          </div>
        } @else {
          <div class="empty"><p>No bookings match these filters.</p></div>
        }
      } @else if (!error()) {
        <div class="skeleton" style="height: 420px"></div>
      }
    </div>

    @if (selected(); as b) {
      <div class="drawer-backdrop" (click)="selected.set(null)"></div>
      <section class="drawer" role="dialog" aria-modal="true" aria-labelledby="booking-title">
        <div class="drawer__head">
          <h2 id="booking-title" class="mono">{{ b.reference }}</h2>
          <button type="button" class="btn btn--ghost btn--icon" (click)="selected.set(null)" aria-label="Close"><app-icon name="x" [size]="18" /></button>
        </div>
        <div class="drawer__body">
          <span [class]="'badge badge--' + b.status" style="justify-self: start">{{ labels[b.status] }}</span>
          <dl class="facts">
            <div><dt>Film</dt><dd>{{ b.showtime.movie.title }}</dd></div>
            <div><dt>Screening</dt><dd>{{ b.showtime.starts_at | venueDate: 'long' }}, {{ b.showtime.starts_at | venueTime }}</dd></div>
            <div><dt>Screen</dt><dd>{{ b.showtime.hall.name }} ({{ b.showtime.hall.format }})</dd></div>
            <div><dt>Customer</dt><dd>{{ b.customer?.name }} <span class="muted">{{ b.customer?.email }}</span></dd></div>
            <div><dt>Booked</dt><dd>{{ b.created_at | venueDate: 'datetime' }}</dd></div>
            <div><dt>Total</dt><dd class="mono">{{ b.total | money: b.currency }}</dd></div>
          </dl>

          <div>
            <h3 class="sub">Seats and tickets</h3>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Seat</th><th>Ticket</th><th class="num">Price</th><th>Door</th></tr></thead>
                <tbody>
                  @for (s of b.seats; track s.seat) {
                    <tr>
                      <td class="mono">{{ s.seat }} <span class="muted small">{{ s.seat_type !== 'standard' ? s.seat_type : '' }}</span></td>
                      <td class="small">{{ s.ticket_type }}</td>
                      <td class="num">{{ s.price | money: b.currency }}</td>
                      <td class="small">
                        @if (s.ticket?.checked_in_at) {
                          <span class="badge badge--ok">In at {{ s.ticket?.checked_in_at | venueTime }}</span>
                        } @else if (s.ticket) {
                          <span class="muted">Not yet</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          @if (b.payments?.length) {
            <div>
              <h3 class="sub">Payments</h3>
              <ul class="payments">
                @for (p of b.payments; track p.created_at) {
                  <li>
                    <span [class]="'badge badge--' + p.status">{{ p.status }}</span>
                    <span class="mono">{{ p.amount | money: b.currency }}</span>
                    <span class="muted small">{{ p.provider }}, {{ p.created_at | venueDate: 'datetime' }}</span>
                  </li>
                }
              </ul>
            </div>
          }

          @if (actionError()) {
            <p class="alert" role="alert"><app-icon name="warning" [size]="18" /> {{ actionError() }}</p>
          }
        </div>
        @if (b.can_cancel) {
          <div class="drawer__foot">
            <button type="button" class="btn btn--danger" (click)="cancel(b)" [disabled]="busy()">
              {{ b.status === 'confirmed' ? 'Cancel and refund' : 'Release the seats' }}
            </button>
          </div>
        }
      </section>
    }
  `,
  styles: `
    .small {
      font-size: 13px;
    }

    .date {
      width: auto;
      border-radius: 999px;
      color-scheme: dark;
    }

    .sub {
      font-size: 15px;
      margin-bottom: 10px;
    }

    .payments {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .payments li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
  `,
})
export class Bookings {
  private api = inject(Api);
  private router = inject(Router);

  /** Query parameter, set by the dashboard's "Bookings" links */
  readonly showtimeParam = input<string>(undefined, { alias: 'showtime' });

  protected readonly labels = STATUS_LABELS;
  protected readonly statuses: { value: BookingStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'pending', label: 'Awaiting payment' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  protected query = signal('');
  protected status = signal<BookingStatus | ''>('');
  protected date = signal('');
  protected showtime = signal('');
  protected pageNumber = signal(1);
  protected page = signal<Page<Booking> | null>(null);
  protected error = signal('');
  protected selected = signal<Booking | null>(null);
  protected busy = signal(false);
  protected actionError = signal('');
  protected search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(debounceTime(250), takeUntilDestroyed()).subscribe((q) => {
      this.pageNumber.set(1);
      this.query.set(q);
    });

    effect(() => this.showtime.set(this.showtimeParam() ?? ''));

    effect((onCleanup) => {
      const filters = { q: this.query(), status: this.status(), date: this.date(), showtime: this.showtime(), page: this.pageNumber() };
      this.page.set(null);
      this.error.set('');
      const sub = this.api.bookings(filters).subscribe({
        next: (p) => this.page.set(p),
        error: (err) => this.error.set(errorMessage(err, 'The bookings could not be loaded.')),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected setStatus(value: BookingStatus | '') {
    this.pageNumber.set(1);
    this.status.set(value);
  }

  protected setDate(value: string) {
    this.pageNumber.set(1);
    this.date.set(value);
  }

  protected clearScope() {
    this.date.set('');
    this.showtime.set('');
    this.pageNumber.set(1);
    this.router.navigate([], { queryParams: {} });
  }

  protected open(b: Booking) {
    this.actionError.set('');
    this.selected.set(b);
  }

  protected async cancel(b: Booking) {
    const question =
      b.status === 'confirmed'
        ? `Cancel ${b.reference} and refund ${b.seats.length} ticket(s) to the customer?`
        : `Release the seats held by ${b.reference}?`;
    if (!confirm(question)) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      const updated = await firstValueFrom(this.api.cancelBooking(b.id));
      this.selected.set(updated);
      this.page.update((p) => (p ? { ...p, results: p.results.map((x) => (x.id === updated.id ? updated : x)) } : p));
    } catch (err) {
      this.actionError.set(errorMessage(err, 'The booking could not be cancelled.'));
    } finally {
      this.busy.set(false);
    }
  }
}
