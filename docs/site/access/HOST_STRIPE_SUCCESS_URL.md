# Stripe Payment Link — success URL (host)

For **instant Try Gate Access**, set the $9 chip-in Payment Link / Checkout success URL to:

```
https://www.slidphilabs.com/access?product=try-gate&session={CHECKOUT_SESSION_ID}
```

Stripe Dashboard → Payment links → `eVq8wQffL2X60CVfIY6wE0e` (or live $9 link) → After payment → redirect to above.

Without this, buyers still work: open `/access?product=try-gate` and add `session=cs_…` from receipt email if available; verify still needs `cs_` id.

Restricted key must allow `checkout.sessions` read (`STRIPE_RESTRICTED_KEY` / `STRIPE_SECRET_KEY` on Vercel project **site**).
