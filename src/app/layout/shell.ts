import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Auth } from '../core/auth';
import { Icon, IconName } from '../core/icon';
import { VenueSettings } from '../core/venue';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="side">
      <a routerLink="/" class="brand" [attr.aria-label]="venue.name() + ' back office'">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
          <circle cx="6" cy="16" r="3.5" fill="var(--accent)" />
          <path d="M10 13.5 28 5v22L10 18.5z" fill="var(--accent)" opacity="0.35" />
          <path d="M10 14.8 28 11v10l-18-3.8z" fill="var(--accent)" opacity="0.7" />
        </svg>
        <span class="brand__text">
          <span class="brand__name">{{ venue.name() }}</span>
          <span class="brand__sub">Back office</span>
        </span>
      </a>

      <nav class="nav" aria-label="Sections">
        @for (link of links; track link.path) {
          <a [routerLink]="link.path" routerLinkActive="is-active" [routerLinkActiveOptions]="{ exact: link.path === '/' }">
            <app-icon [name]="link.icon" [size]="18" />
            <span>{{ link.label }}</span>
          </a>
        }
      </nav>

      <div class="me">
        <span class="me__email" [title]="auth.user()?.email ?? ''">{{ auth.user()?.email }}</span>
        <button type="button" class="btn btn--ghost btn--icon" (click)="auth.signOut()" aria-label="Sign out" title="Sign out">
          <app-icon name="sign-out" [size]="18" />
        </button>
      </div>
    </aside>

    <main class="main">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: grid;
      grid-template-columns: var(--sidebar) minmax(0, 1fr);
      min-height: 100dvh;
    }

    .side {
      position: sticky;
      top: 0;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      gap: 28px;
      padding: 20px 14px;
      border-right: 1px solid var(--line);
      background: var(--bg-sunken);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 8px;
      text-decoration: none;
    }

    .brand__text {
      display: grid;
      line-height: 1.15;
    }

    .brand__name {
      font-family: var(--display);
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .brand__sub {
      font-size: 12px;
      color: var(--muted);
    }

    .nav {
      display: grid;
      gap: 2px;
    }

    .nav a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 9px 12px;
      border-radius: 8px;
      color: var(--ink-soft);
      text-decoration: none;
      font-weight: 500;
      transition: background-color 0.15s, color 0.15s;
    }

    .nav a:hover {
      background: var(--bg-raised);
      color: var(--ink);
    }

    .nav a.is-active {
      background: var(--bg-raised);
      color: var(--ink);
      box-shadow: inset 2px 0 0 var(--accent);
    }

    .me {
      margin-top: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 8px 0;
      border-top: 1px solid var(--line);
    }

    .me__email {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      color: var(--muted);
    }

    .main {
      min-width: 0;
      overflow-x: clip;
    }

    /* Narrow screens: the sidebar becomes a top bar with a scrollable nav */
    @media (max-width: 899px) {
      :host {
        grid-template-columns: minmax(0, 1fr);
      }

      .side {
        position: static;
        height: auto;
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-right: 0;
        border-bottom: 1px solid var(--line);
      }

      .nav {
        order: 3;
        width: 100%;
        display: flex;
        overflow-x: auto;
      }

      .nav a {
        flex: 0 0 auto;
      }

      .nav a.is-active {
        box-shadow: inset 0 -2px 0 var(--accent);
      }

      .me {
        margin: 0 0 0 auto;
        padding: 0;
        border: 0;
      }

      .me__email {
        display: none;
      }
    }
  `,
})
export class Shell {
  protected auth = inject(Auth);
  protected venue = inject(VenueSettings);

  protected links: { path: string; label: string; icon: IconName }[] = [
    { path: '/', label: 'Today', icon: 'chart-bar' },
    { path: '/programme', label: 'Programme', icon: 'calendar' },
    { path: '/films', label: 'Films', icon: 'film-strip' },
    { path: '/bookings', label: 'Bookings', icon: 'ticket' },
    { path: '/check-in', label: 'Check-in', icon: 'qr-code' },
  ];
}
