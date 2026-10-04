import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api, errorMessage } from '../../core/api';
import { Icon } from '../../core/icon';
import { CheckIn } from '../../core/models';
import { VenueDatePipe, VenueTimePipe } from '../../core/venue';

interface Scan {
  ok: boolean;
  title: string;
  result: CheckIn | null;
  at: Date;
}

// The Barcode Detection API is not in TypeScript's DOM types yet
declare const BarcodeDetector: {
  new (options: { formats: string[] }): { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
};

@Component({
  selector: 'app-check-in',
  imports: [Icon, VenueTimePipe, VenueDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page__head">
        <h1 class="page__title">Check-in</h1>
      </header>

      <div class="layout">
        <section class="scan">
          <form class="scan__form" (submit)="submit($event)">
            <div class="field">
              <label for="code">Ticket code</label>
              <input #codeInput id="code" class="mono" autocomplete="off" autofocus placeholder="Scan or type the code" />
            </div>
            <div class="toolbar">
              <button type="submit" class="btn btn--primary" [disabled]="busy()"><app-icon name="check" [size]="16" /> Check in</button>
              @if (cameraSupported) {
                <button type="button" class="btn btn--ghost" (click)="toggleCamera()">
                  <app-icon name="scan" [size]="16" /> {{ cameraOn() ? 'Stop camera' : 'Use camera' }}
                </button>
              }
            </div>
          </form>

          @if (cameraOn()) {
            <video #video class="camera" playsinline muted></video>
          }

          @if (last(); as scan) {
            <div class="result" [class.result--ok]="scan.ok" [class.result--bad]="!scan.ok" role="status">
              <app-icon [name]="scan.ok ? 'check' : 'warning'" [size]="36" />
              <div>
                <p class="result__title">{{ scan.title }}</p>
                @if (scan.result; as r) {
                  <p class="result__seat mono">Seat {{ r.seat }}</p>
                  <p>{{ r.movie }}, {{ r.starts_at | venueDate }} {{ r.starts_at | venueTime }}</p>
                  <p class="muted mono">Booking {{ r.booking }}</p>
                }
              </div>
            </div>
          } @else {
            <div class="empty">
              <p>Scan the QR code on the customer's phone, or type the code shown under it.</p>
            </div>
          }
        </section>

        <aside class="history">
          <h2 class="sub">This session</h2>
          @if (history().length) {
            <ul>
              @for (h of history(); track h.at) {
                <li>
                  <span [class]="'badge ' + (h.ok ? 'badge--ok' : 'badge--error')">{{ h.ok ? 'In' : 'Refused' }}</span>
                  <span>{{ h.result?.seat ? 'Seat ' + h.result?.seat : h.title }}</span>
                  <span class="muted small mono">{{ h.at.toTimeString().slice(0, 5) }}</span>
                </li>
              }
            </ul>
          } @else {
            <p class="muted small">Scans appear here.</p>
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 24px;
      align-items: start;
    }

    .scan {
      display: grid;
      gap: 18px;
    }

    .scan__form {
      display: grid;
      gap: 14px;
      padding: 20px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--bg-raised);
    }

    #code {
      min-height: 52px;
      font-size: 18px;
    }

    .camera {
      width: 100%;
      max-height: 360px;
      border-radius: var(--radius);
      background: #000;
      object-fit: cover;
    }

    .result {
      display: flex;
      gap: 18px;
      align-items: flex-start;
      padding: 24px;
      border-radius: var(--radius);
      animation: pop 0.3s var(--ease) both;
    }

    .result--ok {
      background: var(--success-soft);
      color: var(--success);
    }

    .result--bad {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .result p {
      color: var(--ink);
    }

    .result .muted {
      color: var(--muted);
    }

    .result__title {
      font-family: var(--display);
      font-size: 24px;
      font-weight: 650;
    }

    .result__seat {
      font-size: 32px;
      font-weight: 700;
      margin: 4px 0;
    }

    .history {
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
    }

    .sub {
      font-size: 15px;
      margin-bottom: 12px;
    }

    .history ul {
      display: grid;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .history li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 10px;
      font-size: 14px;
    }

    .small {
      font-size: 12px;
    }

    @keyframes pop {
      from {
        transform: scale(0.97);
        opacity: 0;
      }
    }

    @media (max-width: 899px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class CheckInPage implements OnDestroy {
  private api = inject(Api);
  private codeInput = viewChild.required<ElementRef<HTMLInputElement>>('codeInput');
  private video = viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly cameraSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices;
  protected cameraOn = signal(false);
  protected busy = signal(false);
  protected last = signal<Scan | null>(null);
  protected history = signal<Scan[]>([]);
  private stream: MediaStream | null = null;
  private lastCode = '';

  protected submit(event: Event) {
    event.preventDefault();
    const input = this.codeInput().nativeElement;
    this.check(input.value);
    input.value = '';
    input.focus();
  }

  private async check(raw: string) {
    const code = raw.trim();
    if (!code || this.busy()) return;
    this.busy.set(true);
    let scan: Scan;
    try {
      const result = await firstValueFrom(this.api.checkIn(code));
      scan = { ok: true, title: 'Welcome in', result, at: new Date() };
    } catch (err) {
      const body = err instanceof HttpErrorResponse && err.status === 409 ? (err.error as CheckIn) : null;
      const title =
        err instanceof HttpErrorResponse && err.status === 404 ? 'Unknown ticket' : body?.detail ?? errorMessage(err, 'Check-in failed');
      scan = { ok: false, title, result: body, at: new Date() };
    }
    this.last.set(scan);
    this.history.update((h) => [scan, ...h].slice(0, 30));
    this.busy.set(false);
  }

  protected async toggleCamera() {
    if (this.cameraOn()) return this.stopCamera();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      this.last.set({ ok: false, title: 'The camera is not available. Type the code instead.', result: null, at: new Date() });
      return;
    }
    this.cameraOn.set(true);
    // Wait for the video element to render
    await new Promise((r) => setTimeout(r));
    const video = this.video()?.nativeElement;
    if (!video) return;
    video.srcObject = this.stream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const loop = async () => {
      if (!this.cameraOn()) return;
      try {
        const [found] = await detector.detect(video);
        // The same code stays in front of the camera for a while: check it once
        if (found && found.rawValue !== this.lastCode) {
          this.lastCode = found.rawValue;
          await this.check(found.rawValue);
          setTimeout(() => (this.lastCode = ''), 3000);
        }
      } catch {
        // A frame that cannot be read: try the next one
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  private stopCamera() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.cameraOn.set(false);
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
