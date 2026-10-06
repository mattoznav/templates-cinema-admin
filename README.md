# Cinema template: Admin

The back office for cinema staff: daily figures, programme, films, bookings and ticket check-in.

Angular 22, standalone components and signals, no UI library. Part of the [`templates-cinema`](https://github.com/mattoznav/templates-cinema) template, inside the [`templates`](https://github.com/mattoznav/templates) collection.

## Requirements

- Node.js 22.22 or newer (or 24.15+) and npm
- The backend running locally (see its README)

## Quick start

The admin needs the [backend](https://github.com/mattoznav/templates-cinema-backend) running on `http://localhost:8000`. In development every `/api` call is proxied there (`proxy.conf.json`), so there is no CORS to configure.

```bash
npm install
npm start
```

Open `http://localhost:4200` and sign in with a staff account. To create one, set `DEMO_ADMIN_PASSWORD` in the backend's `.env` and run `manage.py load_data`, or run `manage.py createsuperuser`.
Customer accounts are refused: only users with staff rights can sign in.

Check the project with `npm run build`, which compiles it with strict type checking into `dist/`.

## Sections

| Section | What staff can do |
| --- | --- |
| Today | Seats sold, takings and check-ins for any day, with occupancy per screening |
| Programme | A timeline per screen. Add, move or delete showtimes; overlaps are refused by the backend |
| Films | Search and filter the catalogue, create and edit films, archive or delete them |
| Bookings | Search by reference or email, filter by status, day or screening, see payments and door scans, cancel with refund |
| Check-in | Type or scan the ticket QR code. Each ticket works once. The camera scanner uses the browser's Barcode Detection API where available |

Rules that protect data live in the backend: a showtime or film with bookings cannot be deleted, a showtime cannot change screen once seats are sold, and tickets already used at the door cannot be refunded.

## Structure

```
src/app/
  core/      API client, auth (JWT with refresh), models, venue timezone and currency pipes, icons
  layout/    Shell with the navigation, day picker
  pages/     One folder per section
```

Dates and prices always use the cinema's timezone and currency, loaded from `/api/venue/` at startup.

## Production

```bash
npm run build
```

Serve `dist/cinema-admin/browser` from the same domain as the API (for example under `/admin/` with the API under `/api/`), or put both behind one reverse proxy.

## License

The code is released under the [MIT License](LICENSE).
