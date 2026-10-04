import { Injectable, Pipe, PipeTransform, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api } from './api';

const LOCALE = 'en-GB';

/** Timezone and currency of the cinema: every date and price is shown in them. */
@Injectable({ providedIn: 'root' })
export class VenueSettings {
  private api = inject(Api);
  readonly name = signal('Cinema');
  readonly timezone = signal(Intl.DateTimeFormat().resolvedOptions().timeZone);
  readonly currency = signal('EUR');

  async load(): Promise<void> {
    try {
      const venue = await firstValueFrom(this.api.venue());
      this.name.set(venue.name);
      this.timezone.set(venue.timezone);
      this.currency.set(venue.currency);
    } catch {
      // Keep the browser defaults: pages still work, times show in local time
    }
  }

  /** "YYYY-MM-DD" of a moment in the venue's timezone. */
  dayKey(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: this.timezone() }).format(date);
  }

  /** Add days to a "YYYY-MM-DD" key, safe across daylight saving changes. */
  shiftDay(key: string, days: number): string {
    const d = new Date(`${key}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  /** Local date and time at the venue to an ISO instant, e.g. ("2026-10-04", "20:30"). */
  toInstant(day: string, time: string): string {
    const guess = new Date(`${day}T${time}:00Z`);
    // The venue's offset at that moment, read back from Intl
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone(),
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(guess);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return new Date(guess.getTime() - (asLocal - guess.getTime())).toISOString();
  }

  format(iso: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: this.timezone() }).format(new Date(iso));
  }

  money(amount: string | number | null | undefined, currency = this.currency()): string {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(Number(amount ?? 0));
  }
}

@Pipe({ name: 'venueTime' })
export class VenueTimePipe implements PipeTransform {
  private venue = inject(VenueSettings);
  transform(iso: string | null | undefined): string {
    return iso ? this.venue.format(iso, { hour: '2-digit', minute: '2-digit' }) : '';
  }
}

@Pipe({ name: 'venueDate' })
export class VenueDatePipe implements PipeTransform {
  private venue = inject(VenueSettings);
  transform(iso: string | null | undefined, style: 'short' | 'long' | 'datetime' = 'short'): string {
    if (!iso) return '';
    const options: Record<string, Intl.DateTimeFormatOptions> = {
      short: { weekday: 'short', day: 'numeric', month: 'short' },
      long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
      datetime: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
    };
    return this.venue.format(iso, options[style]);
  }
}

@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private venue = inject(VenueSettings);
  transform(amount: string | number | null | undefined, currency?: string): string {
    return this.venue.money(amount, currency);
  }
}
