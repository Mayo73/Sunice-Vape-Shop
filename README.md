# Sunice Vape Shop

A small pickup shop for phones. Customers browse a single list of items, order
anonymously, and get a four-character code. An admin accepts the order, hands
over a location, and a ten minute pickup countdown starts. Cash only, on pickup.

- **Built as** a React single-page app served as static files by Caddy.
- **Backed by** Supabase (Postgres + row level security, auth, storage).
- **No customer accounts.** No name, no phone number, no email — just a code.
- **Unlimited stock.** Nothing is ever reserved or blocked during ordering.

---

## How it works

```
Phone browser  ──►  Caddy (static files, auto HTTPS)
      │
      └─────────►  Supabase: Postgres + RLS + rpcs · Auth · Storage
```

There is no application server. Everything that matters is enforced in the
database, not in the browser:

- Customers **cannot read the `orders` table at all**. They call three
  `SECURITY DEFINER` functions and nothing else.
- Order totals are **recomputed server-side** from `products`. Prices sent by a
  client are ignored entirely.
- Closing the shop is enforced by `create_order`, so an already-open page cannot
  slip an order through.
- Accepting an order is a single conditional `UPDATE`, so if two admins tap
  *Accept* at the same moment exactly one of them wins.

### The order flow

| | |
|---|---|
| 1 | Customer adds items and taps **Place order** — no form, no fields. |
| 2 | They get a code like `GMDP` and a secret link, kept in this browser only. |
| 3 | The order appears on every admin's board instantly. |
| 4 | An admin taps **Accept** and shares a location, automatically or by typing a meeting point. |
| 5 | The customer's screen shows the location and a **10:00** countdown. |
| 6 | The admin marks it **Picked up**, and cash changes hands. |

---

## Deploying

Requirements: a Linux server with a public IP. Docker is installed for you if it
is missing. **No DNS is needed to start** — you can point a domain at it later.

```bash
git clone https://github.com/Mayo73/Sunice-Vape-Shop.git
cd Sunice-Vape-Shop
./deploy.sh
```

That is the whole thing. The script checks Docker (offering to install it),
asks how you want to serve the shop, writes `.env`, builds, starts, and checks
that it answers. It is safe to re-run.

### The two modes

|  | |
|---|---|
| **`./deploy.sh --ip`** | Plain HTTP on the server's IP — `http://<server-ip>/`. Works immediately, no DNS. |
| **`./deploy.sh --domain vape.mlevo.de`** | Automatic Let's Encrypt HTTPS. Needs DNS pointing at the server first. |

Both serve exactly the same app. The one thing the HTTP mode costs is the
admin **Use my location** button: browsers only expose geolocation on a secure
origin, so until the domain is live admins type the meeting point instead. The
app says so plainly rather than failing quietly, and a typed meeting point is
often clearer than coordinates anyway.

Switching later is one command — nothing is lost, and the shop keeps running:

```bash
./deploy.sh --domain vape.mlevo.de
```

### When you do set up the domain

Point `vape.mlevo.de` at the server with an A record.

> **If the domain is on Cloudflare, that record must be set to "DNS only" (grey
> cloud), not proxied.** With the orange cloud on, Cloudflare terminates TLS
> itself and Caddy's certificate check never completes, so HTTPS will not come
> up. In the Cloudflare dashboard: *DNS → Records →* the `vape` record *→* click
> the orange cloud so it turns grey.

`deploy.sh --domain` warns you before starting if DNS does not resolve to this
server, which is the usual reason a certificate never arrives.

### Sharing a domain

If ports 80 and 443 on the server already belong to another site, the shop can
live next to it under a path, e.g. `https://example.com/shop/`. No DNS change is
needed because the domain already points at the server. In `.env`:

```
SITE_ADDRESS=:80
HTTP_PORT=8080
HTTPS_PORT=8443
BASE_PATH=/shop/
```

Caddy then serves the app on port 8080 with every asset, route and the PWA
manifest under `/shop/`, and the existing web server hands that path over with
the prefix stripped. For nginx:

```nginx
location = /shop { return 301 /shop/; }
location ^~ /shop/ {
    proxy_pass http://<server-ip>:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`^~` matters: without it a regex `location` for static files would catch
`/shop/assets/…` first. The admin area is then at `/shop/303`, and since the
outer site is HTTPS, **Use my location** works.

> Behind Cloudflare, Bot Fight Mode injects an inline script that the shop's
> Content Security Policy blocks. The app is unaffected; it only shows up as a
> console error. Turn the feature off for the zone if that bothers you.

### Add items

Open `/303` on whichever address you are serving, sign in, and add the first
items under **Items**.

### Updating

```bash
./deploy.sh --update
```

`VITE_*` values and `BASE_PATH` are compiled into the bundle, so changing them
means rebuilding, which `--update` does.

### Checking on it

```bash
docker compose logs -f web     # Caddy, including certificate issuance
docker compose ps
```

---

## The admin area

`/303` is unlisted: nothing in the customer interface links to it, and the site
is marked `noindex`. Admins reach it by typing the path, or by **tapping the
Sunice wordmark five times** quickly.

There are exactly five admins, named after animals: `gecko`, `kobra`, `mantis`,
`panther`, `skarab`. They type the animal name only — the app appends the rest of
the address. Passwords were handed over separately and are not in this repo.

| Screen | What it does |
|---|---|
| **Orders** | Live board of open orders. Accept, decline, mark picked up, cancel. |
| **Items** | Add, edit, hide and delete items, with pictures. |
| **Shop** | Close the shop temporarily, with a message customers see. |

**Sharing a location.** *Use my location* reads the phone's GPS. Browsers only
allow that over HTTPS, which is why the deployment above is HTTPS-only — over
plain HTTP the button reports the problem and the admin types a meeting point
instead. Typing one always works and is often clearer than coordinates.

Deleting an item does not damage past orders: each order line keeps its own copy
of the name and price it was sold at.

---

## Working on it locally

```bash
npm install
cp .env.example .env
npm run dev
```

| Command | |
|---|---|
| `npm run dev` | Dev server on `localhost:5173` |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run typecheck` | Types only |

Geolocation and the PWA install prompt need a secure origin; `localhost` counts
as one, so both work in development.

### Layout

```
src/
  lib/          supabase client, formatting, geolocation, image resizing, hooks
  state/        cart, auth and shop-status contexts
  components/   shell, top bar, cart sheet, countdown, product card, icons
  routes/       Shop · Product · Checkout · OrderStatus
    admin/      Login · Layout · Orders · Products · Settings
supabase/
  migrations/   the database, in order
```

### Database

The migrations in `supabase/migrations/` are already applied to the project.
They are kept here so the whole thing can be rebuilt from scratch — apply them
in filename order. `0005_admins.sql` ships with placeholder passwords; see the
notes in that file.

---

## Notes on privacy and security

- The Supabase **publishable key in `.env.example` is meant to be public.** It
  only ever acts as the anonymous role; row level security is what protects the
  data, and that has been tested against a hostile client.
- A customer's claim on their order is the random token in their browser's
  `localStorage`. Clearing site data loses access to the order — by design,
  since there is no account to recover it with.
- The only thing stored about a customer is what they ordered and when.
