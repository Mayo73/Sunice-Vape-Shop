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

Requirements: a Linux server with Docker, ports 80 and 443 open, and a DNS
record pointing at it.

### 1. DNS

Point `vape.mlevo.de` at the server.

> **If the domain is on Cloudflare, the record must be set to "DNS only" (grey
> cloud), not proxied.** With the orange cloud on, Cloudflare terminates TLS
> itself and Caddy's certificate check never completes, so the site will not come
> up. In the Cloudflare dashboard: *DNS → Records →* the `vape` record *→* click
> the orange cloud so it turns grey.

### 2. Configure and start

```bash
git clone https://github.com/Mayo73/Sunice-Vape-Shop.git
cd Sunice-Vape-Shop
cp .env.example .env
nano .env            # set ACME_EMAIL; the rest is already filled in
docker compose up -d --build
```

Caddy requests a Let's Encrypt certificate on first start. Give it a few
seconds, then open `https://vape.mlevo.de`.

### 3. Add items

Open `https://vape.mlevo.de/303`, sign in, and add the first items under
**Items**.

### Updating later

```bash
git pull && docker compose up -d --build
```

`VITE_*` values are compiled into the bundle, so changing them means rebuilding
(`--build`), not just restarting.

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
