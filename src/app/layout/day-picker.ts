import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';

import { Icon } from '../core/icon';
import { VenueSettings } from '../core/venue';

/** Previous day, a date input, next day, and a shortcut back to today. */
@Component({
  selector: 'app-day-picker',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <button type="button" class="btn btn--ghost btn--icon" (click)="shift(-1)" aria-label="Previous day">
        <app-icon name="caret-left" [size]="16" />
      </button>
      <input class="input date" type="date" [value]="day()" (change)="pick($event)" aria-label="Day" />
      <button type="button" class="btn btn--ghost btn--icon" (click)="shift(1)" aria-label="Next day">
        <app-icon name="caret-right" [size]="16" />
      </button>
      <button type="button" class="btn btn--ghost" (click)="day.set(today())" [disabled]="day() === today()">Today</button>
    </div>
  `,
  styles: `
    .date {
      width: auto;
      border-radius: 999px;
      color-scheme: dark;
    }
  `,
})
export class DayPicker {
  private venue = inject(VenueSettings);
  readonly day = model.required<string>();
  protected today = computed(() => this.venue.dayKey());

  protected shift(days: number) {
    this.day.set(this.venue.shiftDay(this.day(), days));
  }

  protected pick(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.day.set(value);
  }
}
