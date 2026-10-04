import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Api, errorMessage } from '../../core/api';
import { Icon } from '../../core/icon';
import { Summary } from '../../core/models';
import { MoneyPipe, VenueDatePipe, VenueSettings, VenueTimePipe } from '../../core/venue';
import { DayPicker } from '../../layout/day-picker';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, Icon, MoneyPipe, VenueTimePipe, VenueDatePipe, DayPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page__head">
        <h1 class="page__title">{{ isToday() ? 'Today' : (day() + 'T12:00:00Z' | venueDate: 'long') }}</h1>
        <app-day-picker [(day)]="day" />
      </header>

      @if (error()) {
        <p class="alert" role="alert"><app-icon name="warning" [size]="18" /> {{ error() }}</p>
      }

      @if (summary(); as s) {
        <section class="kpis" aria-label="Key figures">
          <div class="kpi kpi--lead">
            <span class="kpi__label">Seats sold</span>
            <span class="kpi__value mono">{{ s.totals.sold }} <small>of {{ s.totals.capacity }}</small></span>
            <span class="kpi__bar" aria-hidden="true"><span [style.width.%]="occupancy()"></span></span>
            <span class="kpi__note">{{ occupancy() }}% full across {{ s.totals.showtimes }} screenings</span>
          </div>
          <div class="kpi">
            <span class="kpi__label">Takings</span>
            <span class="kpi__value mono">{{ s.totals.revenue | money: s.currency }}</span>
            <span class="kpi__note">From the screenings of this day</span>
          </div>
          <div class="kpi">
            <span class="kpi__label">Checked in</span>
            <span class="kpi__value mono">{{ s.totals.checked_in }}</span>
            <span class="kpi__note">{{ s.totals.held }} {{ s.totals.held === 1 ? 'seat' : 'seats' }} held in unfinished payments</span>
          </div>
          <div class="kpi">
            <span class="kpi__label">Sold online today</span>
            <span class="kpi__value mono">{{ s.sales_today.revenue | money: s.currency }}</span>
            <span class="kpi__note">{{ s.sales_today.tickets }} {{ s.sales_today.tickets === 1 ? 'ticket' : 'tickets' }} in {{ s.sales_today.bookings }} {{ s.sales_today.bookings === 1 ? 'booking' : 'bookings' }}, for any date</span>
          </div>
        </section>

        <section>
          <h2 class="section-title">Screenings</h2>
          @if (s.showtimes.length) {
            <div class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Film</th>
                    <th>Screen</th>
                    <th>Occupancy</th>
                    <th class="num">Checked in</th>
                    <th class="num">Takings</th>
                    <th><span class="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of s.showtimes; track row.id) {
                    <tr [class.is-past]="isPast(row.ends_at)">
                      <td class="mono">{{ row.starts_at | venueTime }}</td>
                      <td>{{ row.movie.title }}</td>
                      <td>{{ row.hall.name }} <span class="muted">{{ row.hall.format }}</span></td>
                      <td>
                        <div class="occ" [attr.aria-label]="row.sold + ' sold, ' + row.held + ' held, of ' + row.capacity">
                          <span class="occ__bar" aria-hidden="true">
                            <span class="occ__sold" [style.width.%]="pct(row.sold, row.capacity)"></span>
                            <span class="occ__held" [style.width.%]="pct(row.held, row.capacity)"></span>
                          </span>
                          <span class="mono occ__num">{{ row.sold }}/{{ row.capacity }}</span>
                        </div>
                      </td>
                      <td class="num">{{ row.checked_in }}</td>
                      <td class="num">{{ row.revenue | money: s.currency }}</td>
                      <td class="num">
                        <a class="row-link" [routerLink]="['/bookings']" [queryParams]="{ showtime: row.id }">Bookings</a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="empty">
              <p>No screenings on this day.</p>
              <a class="btn btn--ghost" routerLink="/programme">Open the programme</a>
            </div>
          }
        </section>
      } @else if (!error()) {
        <div class="kpis">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="skeleton" style="height: 128px"></div>
          }
        </div>
        <div class="skeleton" style="height: 320px"></div>
      }
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr 1fr;
      gap: 14px;
    }

    .kpi {
      display: grid;
      gap: 6px;
      align-content: start;
      padding: 18px 20px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--bg-raised);
    }

    .kpi--lead {
      background:
        radial-gradient(100% 120% at 100% 0%, rgb(255 207 74 / 0.12), transparent 60%),
        var(--bg-raised);
    }

    .kpi__label {
      font-size: 13px;
      color: var(--ink-soft);
    }

    .kpi__value {
      font-size: 28px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }

    .kpi__value small {
      font-size: 15px;
      color: var(--muted);
      font-weight: 400;
    }

    .kpi__note {
      font-size: 12px;
      color: var(--muted);
    }

    .kpi__bar {
      height: 6px;
      border-radius: 999px;
      background: var(--line);
      overflow: hidden;
    }

    .kpi__bar span {
      display: block;
      height: 100%;
      background: var(--accent);
      border-radius: inherit;
      transition: width 0.6s var(--ease);
    }

    .section-title {
      font-size: 20px;
      margin-bottom: 12px;
    }

    .is-past td {
      color: var(--muted);
    }

    .occ {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 180px;
    }

    .occ__bar {
      display: flex;
      flex: 1;
      height: 8px;
      border-radius: 999px;
      background: var(--line);
      overflow: hidden;
    }

    .occ__sold {
      background: var(--accent);
    }

    .occ__held {
      background: rgb(255 207 74 / 0.35);
    }

    .occ__num {
      font-size: 13px;
      color: var(--ink-soft);
      min-width: 56px;
      text-align: right;
    }

    .row-link {
      color: var(--ink-soft);
      font-size: 13px;
    }

    .row-link:hover {
      color: var(--accent);
    }

    @media (max-width: 1099px) {
      .kpis {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 559px) {
      .kpis {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class Dashboard {
  private api = inject(Api);
  private venue = inject(VenueSettings);

  protected day = signal(this.venue.dayKey());
  protected summary = signal<Summary | null>(null);
  protected error = signal('');
  protected isToday = computed(() => this.day() === this.venue.dayKey());
  protected occupancy = computed(() => {
    const t = this.summary()?.totals;
    return t?.capacity ? Math.round((t.sold / t.capacity) * 100) : 0;
  });

  constructor() {
    effect((onCleanup) => {
      const day = this.day();
      this.summary.set(null);
      this.error.set('');
      const sub = this.api.summary(day).subscribe({
        next: (s) => this.summary.set(s),
        error: (err) => this.error.set(errorMessage(err, 'The figures could not be loaded.')),
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected pct(part: number, total: number) {
    return total ? (part / total) * 100 : 0;
  }

  protected isPast(iso: string) {
    return new Date(iso) < new Date();
  }
}
