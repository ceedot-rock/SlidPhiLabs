# Signup reply flow (drafts only, nothing sent)

Trigger points in docs/site/signup.html: success (SPLAuth.goAfter), and the
`email_taken` error branch. These templates cover both plus the seat-ready
follow-up. Fill bracketed fields per send. Plain text and HTML bodies are
identical wording.

## 1. Welcome (on successful signup)

Subject: Your Slid Phi Labs account is ready

Hi [name],

One login opens every door: CuNi Studio, Agent-Rider, Chamber, L33tSaaS,
Overlord Eye, and TEACHAiD.

Start here: https://www.slidphilabs.com/humans
Agents start here: https://www.slidphilabs.com/agents

Free tier covers browsing, demos, and the free suite. Paid doors say so
before they charge.

Corey, Slid Phi Labs

## 2. Email already registered (matches the `email_taken` branch copy)

Subject: You already have a lab account

Hi there,

That email is already in, so no new account was made. Log in:
https://www.slidphilabs.com/login

If you did not try to sign up, ignore this. Nobody else can use your
address without the password.

Corey, Slid Phi Labs

## 3. Seat ready (after a paid door fulfills)

Subject: Your [product] seat is live

Hi [name],

Payment verified. Your seat id: [seat_id]

- What unlocked: [entitlement summary]
- Eval guide: [guide link]
- Receipt: [receipt link]

Public demos only; private engines stay private. Reply to this email for
human fulfillment of licensed packages.

Corey, Slid Phi Labs

## 4. Failed payment, no seat (close the loop without a waitlist)

Subject: Your [product] checkout did not complete

Hi [name],

No charge was made and no seat was created. Your cart is still here:
[checkout link]

Free doors stay open meanwhile: https://www.slidphilabs.com/web

Corey, Slid Phi Labs

## Wiring notes (for the implementer, not sent)

- signup.html already branches success vs email_taken; hook templates 1
  and 2 to those branches via the existing SPLAuth callback.
- Template 3 fires from the Stripe verify webhook that grants the seat.
- Template 4 fires from the checkout-cancelled webhook.
- No template asks for secrets, keys, or passwords.
