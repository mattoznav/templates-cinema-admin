import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { errorMessage } from '../../core/api';
import { Auth } from '../../core/auth';
import { VenueSettings } from '../../core/venue';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="login">
      <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="card__head">
          <h1>{{ venue.name() }}</h1>
          <p class="muted">Back office. Staff accounts only.</p>
        </div>

        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" autocomplete="username" />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" autocomplete="current-password" />
        </div>

        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }

        <button class="btn btn--primary" type="submit" [disabled]="busy()">Sign in</button>
      </form>
    </section>
  `,
  styles: `
    .login {
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 16px;
      background:
        radial-gradient(60% 50% at 80% 0%, rgb(255 207 74 / 0.1), transparent 70%),
        var(--bg);
    }

    .card {
      display: grid;
      gap: 18px;
      width: min(400px, 100%);
      padding: 32px;
      border: 1px solid var(--line);
      border-radius: var(--radius);
      background: var(--bg-raised);
    }

    .card__head {
      display: grid;
      gap: 6px;
      margin-bottom: 6px;
    }

    h1 {
      font-size: 28px;
    }
  `,
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);
  protected venue = inject(VenueSettings);

  protected form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected busy = signal(false);
  protected error = signal('');

  async submit() {
    if (this.form.invalid) {
      this.error.set('Enter your email and password.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.signIn(email, password);
      await this.router.navigateByUrl('/');
    } catch (err) {
      this.error.set(
        err instanceof Error && !('status' in err)
          ? err.message
          : (err as { status?: number }).status === 401
            ? 'Email or password is not right.'
            : errorMessage(err),
      );
    } finally {
      this.busy.set(false);
    }
  }
}
