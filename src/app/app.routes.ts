import { Routes } from '@angular/router';

import { staffGuard } from './core/auth';
import { Shell } from './layout/shell';

export const routes: Routes = [
  { path: 'login', title: 'Sign in', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: '',
    component: Shell,
    canActivate: [staffGuard],
    children: [
      { path: '', title: 'Today', loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard) },
      { path: 'programme', title: 'Programme', loadComponent: () => import('./pages/programme/programme').then((m) => m.Programme) },
      { path: 'films', title: 'Films', loadComponent: () => import('./pages/films/films').then((m) => m.Films) },
      { path: 'films/new', title: 'New film', loadComponent: () => import('./pages/films/film-form').then((m) => m.FilmForm) },
      { path: 'films/:slug', title: 'Edit film', loadComponent: () => import('./pages/films/film-form').then((m) => m.FilmForm) },
      { path: 'bookings', title: 'Bookings', loadComponent: () => import('./pages/bookings/bookings').then((m) => m.Bookings) },
      { path: 'check-in', title: 'Check-in', loadComponent: () => import('./pages/check-in/check-in').then((m) => m.CheckInPage) },
    ],
  },
  { path: '**', redirectTo: '' },
];
