# Chapter 13: The Web as a World

Chapter 12 ended with a useful observation: databases and networks are infrastructure. Nobody wakes up excited about a database. They get excited about what *runs on top* — the thing with a name, an address, a page you can visit. This chapter is about that thing. The web is the largest thing humanity has ever built together, and it is also, mechanically, one of the simplest ideas in this book: one computer asks, another answers, and they agree on the shape of the conversation.

## The client asks; the server answers

Two definitions, and everything else in this chapter hangs on them.

A **client** is a program that asks for things. Your browser is a client. So is the app on your phone, so is a script that checks the weather.

A **server** is a program that waits for questions and answers them. It sits on a computer somewhere, listening on a port — a numbered door, from Chapter 11 — and when a request arrives, it does some work and sends back a response.

The conversation between them is called the **request/response cycle**, and it is the entire web, compressed:

1. You type `https://example.com/quote` into your browser.
2. The browser asks DNS (Chapter 11) for the address behind the name.
3. It opens a TCP connection to that address, on port 443.
4. It sends a **request**: a few lines of text describing what it wants.
5. The server reads the request, decides what to do, and sends back a **response**: a status line, some headers, and a body.
6. The browser reads the response and renders the body as a page.

Here is what step 4 actually looks like, on the wire. This is the whole protocol, more or less:

```
GET /quote HTTP/1.1
Host: example.com

```

That's it. A verb (`GET` — "give me this"), a path (`/quote` — "this"), and the protocol version. And here is a possible step 5:

```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 34

{"quote": "Ship small, ship working."}
```

A status code (`200` — "all good"), headers describing the body, a blank line, and the body itself. HTTP — the HyperText Transfer Protocol — is deliberately this plain. The web conquered the world not by being sophisticated but by being simple enough that anyone could implement it in an afternoon. You are about to.

## What runs where: frontend and backend

Two more definitions, and a warning that will save you real money someday.

**Frontend** is code that runs on the *user's* machine — in their browser. HTML, CSS, and JavaScript. It draws the page, reacts to clicks, and makes requests.

**Backend** is code that runs on *your* machine — the server. It answers requests, talks to the database, and decides what is allowed.

The honest version: the frontend is the face; the backend is the part that matters. And here is the warning, stated as a law:

**Never trust the client.**

Everything that runs on the user's machine is, from your server's perspective, attacker-controlled. A user can open your page's source, edit your JavaScript in their browser's dev tools, and send your server any request they like — including requests your frontend would never generate. So every check that matters must happen on the server: Is this user allowed to do this? Is this input sane? Did they actually pay? The frontend can check too, for speed and politeness — instant feedback is good manners — but the server's check is the one that counts. A lock on the frontend is a suggestion; a lock on the backend is a lock.

Two corollaries. First, **never put secrets in frontend code**. API keys, passwords, private tokens — anything baked into JavaScript ships to every visitor, and "View Source" is one right-click away. Secrets live on the server. Second, the round trip has a cost: each request to the server takes roughly 30 to 200 milliseconds depending on distance — light can only cross an ocean so fast — so the frontend handles what must feel instant (typing, hovering, animating) and the server handles what must be true (who you are, what you own, what happened).

## Fifteen lines, and you own a world

Enough theory. Here is a complete web server, in Python's standard library, no packages to install:

```python
from http.server import BaseHTTPRequestHandler, HTTPServer

visits = 0  # in-memory counter: forgets everything on restart

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        global visits
        visits += 1
        body = ("<h1>You are visitor number " + str(visits) + "</h1>"
                "<p>You asked for: " + self.path + "</p>").encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
```

Save it as `server.py`, run `python3 server.py`, and visit `http://127.0.0.1:8000/hello` in your browser. Congratulations: you are looking at a world you built. It has an address, it counts visitors, it answers questions.

Walk through the mechanism, because there is no magic here. `HTTPServer` binds to port 8000 on your own machine (`127.0.0.1` means "this computer only" — nobody else can reach it yet) and waits. When your browser connects, the library parses the raw request bytes into a `Handler` object; `self.path` holds the path you asked for (`/hello`); because the request was a `GET`, the library calls your `do_GET` method. You build a body, announce `200` ("OK"), describe the body with headers, and write the bytes back down the same connection. The browser renders the HTML. That is the entire request/response cycle from the server's side of the table.

Now notice the flaw, because it is the most instructive part of the program: restart the server and the counter resets to zero. The server's memory is **amnesiac** — it forgets everything when the process dies, which, in production, happens constantly (restarts, crashes, deploys). A counter that resets is a toy; a counter that survives is a service. Surviving is what Chapter 12's databases are for: the server answers, the database remembers.

## What "real" adds

Your fifteen lines are a real server, but not yet a real *service*. The gap is four things:

**A domain.** `127.0.0.1:8000` is an address only you can visit. A domain name — `yourthing.com` — is a name anyone can type, resolved by DNS (Chapter 11) to the address of a computer that is always on. The domain is not technical machinery so much as it is a promise: this place has a name, and names imply someone will be home.

**HTTPS.** Right now your server speaks plain HTTP: anyone on the network between the user and you — the café wifi, the ISP — can read every request, including passwords. HTTPS is HTTP wrapped in TLS encryption (the handshake from Chapter 11's world, applied here): it encrypts the conversation and, via certificates, proves to the user that the server is who the domain says it is. One honest caveat: the padlock means the *pipe* is private, not that the *site* is trustworthy. An encrypted connection to a scammer is still a scammer.

**A database.** As established: memory forgets, disks (via Chapter 12) remember. Every real service is a server plus a database — the server thinks, the database remembers what it thought.

**Someone else's always-on computer.** Your laptop sleeps, moves, and loses wifi. A service needs a machine that doesn't — rented by the month for a few dollars, running your same fifteen lines (plus the database, the domain, and HTTPS). That rented computer is all "the cloud" ever was: somebody else's computer, left on.

## Someone else has to be able to use it

The moment strangers use your thing, three concerns appear that localhost never taught you.

**Uptime** is the fraction of time your service answers. 99.9% sounds excellent until you do the arithmetic: 0.1% of a year is about 8.8 hours of downtime — a full working day, gone. Every nine you add (99.99%) divides the downtime by ten and multiplies the engineering effort by considerably more than ten. For your first project, the right uptime target is "it works when someone visits," and the right monitoring is a friend texting you "your site is down."

**Error handling** is what your users experience instead of your intentions. The status codes are a vocabulary worth learning: `404` means "you asked for something that isn't here" (their mistake, be helpful); `500` means "the server broke" (your mistake, apologize and log it). The rule: every failure mode you don't handle is one your users experience raw. A crashed server that shows a clean error page and restarts itself is, from the user's perspective, barely an incident. A crashed server that hangs forever is an abandonment.

**Thinking about the user** is the rest: pages that load before patience runs out, errors written for humans ("that username is taken" beats `E_CONSTRAINT_VIOLATION`), never losing someone's work. None of this is glamorous. All of it is the difference between a demo and a service.

## Ship small, ship working

Here is the opinionated part, earned by watching a hundred projects die of ambition: **ship small, ship working.**

An ugly page, deployed, that does one thing for real users beats a beautiful architecture that has never left your laptop. The deployed thing teaches you what to build next — real users, real requests, real failures. The laptop thing teaches you what you *imagined* users want, which is a genre of fiction.

Small means: one page, one feature, one database table. Working means: it runs, it survives a restart without losing everything, it handles the obvious failure (bad input, missing page, dead database) with grace, and you could send the URL to a stranger without flinching. Then iterate — in public, where the feedback is. Perfection is not the goal; *contact with reality* is. Every chapter of this book has ended with "build it" for exactly this reason: the web rewards the shipped.

## Build it

1. **See the raw conversation.** Run the server, then in a terminal run `curl -i http://127.0.0.1:8000/hello`. Identify the status line, the headers, the blank line, and the body in the output. Then look at your server's terminal: the library logged the request line (`GET /hello HTTP/1.1`) when it arrived. That log line is the request, seen from the other side of the table.
2. **Build an API.** Add a second route: if `self.path == "/quote"`, respond with `Content-Type: application/json` and the body `{"quote": "Ship small, ship working."}`. Then read it from Python — about eight lines with `urllib.request` and `json.load`. Notice what changed: the moment your server speaks structured data instead of pages, *other programs* become your users. That is what an API is: the web, machine to machine.
3. **Survive your first outage.** Kill the server with Ctrl-C and reload the page. Write down the exact error your browser shows, word for word. That is what your users see when you're down — sit with it for a moment. Now restart the server and add one piece of professionalism: log every request with a timestamp to a file. Next time something breaks at 2 a.m., you will have evidence instead of a story.
