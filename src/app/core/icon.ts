import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

// Phosphor icons (regular), bundled as text by the ".svg" loader in angular.json
import armchair from '@phosphor-icons/core/assets/regular/armchair.svg';
import arrowLeft from '@phosphor-icons/core/assets/regular/arrow-left.svg';
import calendar from '@phosphor-icons/core/assets/regular/calendar-dots.svg';
import caretLeft from '@phosphor-icons/core/assets/regular/caret-left.svg';
import caretRight from '@phosphor-icons/core/assets/regular/caret-right.svg';
import chartBar from '@phosphor-icons/core/assets/regular/chart-bar.svg';
import check from '@phosphor-icons/core/assets/regular/check-circle.svg';
import filmStrip from '@phosphor-icons/core/assets/regular/film-strip.svg';
import magnifyingGlass from '@phosphor-icons/core/assets/regular/magnifying-glass.svg';
import plus from '@phosphor-icons/core/assets/regular/plus.svg';
import qrCode from '@phosphor-icons/core/assets/regular/qr-code.svg';
import scan from '@phosphor-icons/core/assets/regular/scan.svg';
import signOut from '@phosphor-icons/core/assets/regular/sign-out.svg';
import ticket from '@phosphor-icons/core/assets/regular/ticket.svg';
import trash from '@phosphor-icons/core/assets/regular/trash.svg';
import warning from '@phosphor-icons/core/assets/regular/warning-circle.svg';
import x from '@phosphor-icons/core/assets/regular/x.svg';

const ICONS = {
  armchair,
  'arrow-left': arrowLeft,
  calendar,
  'caret-left': caretLeft,
  'caret-right': caretRight,
  'chart-bar': chartBar,
  check,
  'film-strip': filmStrip,
  'magnifying-glass': magnifyingGlass,
  plus,
  'qr-code': qrCode,
  scan,
  'sign-out': signOut,
  ticket,
  trash,
  warning,
  x,
};

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'aria-hidden': 'true',
    '[innerHTML]': 'svg()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    style: 'display: inline-grid; flex-shrink: 0',
  },
})
export class Icon {
  private sanitizer = inject(DomSanitizer);
  readonly name = input.required<IconName>();
  readonly size = input(20);
  // The markup is our own bundled file, never user input
  protected svg = computed(() => this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()].replace('<svg ', '<svg width="100%" height="100%" ')));
}
