# Chapter 11: How Machines Talk

Chapter 10 gave us a government: one machine, one authority, hardware-enforced rules. Now zoom out. Your laptop talks to a server in Virginia, which talks to a database in Oregon, which answers in a fraction of a second — and there is no world government of computers. No central authority assigns the rules, polices the traffic, or can be appealed to when something breaks. And yet it works, billions of times a day, with a reliability that would make any actual government weep with envy.

How? The answer is **protocols**: agreements about how to communicate, precise enough that machines built by strangers, running software written decades apart, can understand each other. The internet is not a thing. It is an *agreed fiction that works* — a stack of shared conventions, and this chapter is the tour from the bottom up.

## Packets: The Postal System

Define the atom first: a **packet** is a small chunk of data bundled with addressing information — where it's from, where it's going. Everything on the internet travels as packets. When you load a photo, nobody opens a dedicated wire from the server to you and pours the photo through it. The photo is chopped into packets, each packet is flung into the network independently, and your machine reassembles them at the other end. Packets from the same photo may take different routes. They may arrive out of order. Some may not arrive at all.

Why chop data up at all? Four reasons, each worth one line. **Fairness:** the network is shared, and chopping prevents one giant transfer from hogging a link while everyone else's packets queue behind it — small packets interleave. **Recovery:** if something goes wrong mid-transfer, you retransmit the lost packet, not the whole file. **Routing:** each packet carries its destination, so routers can forward packets independently along whatever path is best right now — no setup, no ceremony. **Diversity:** the networks in between have different limits (an Ethernet link caps a packet around 1,500 bytes — the **MTU**, maximum transmission unit), and small packets fit everywhere.

Quantify it: that 1,500-byte MTU means a 1 GB video file becomes roughly 700,000 packets (1,000,000,000 ÷ 1,500 ≈ 666,667). Your machine sends and reassembles hundreds of thousands of addressed envelopes per file without you ever knowing. The postal analogy is almost too good: imagine mailing a book by tearing out each page, putting every page in its own envelope with the destination address, and trusting the world's postal services — plural, uncoordinated — to deliver them all. That's the internet. The miracle is that the book arrives readable.

## IP: Addresses as Numbers

For packets to find their destinations, every machine needs an address, and addresses need to be numbers — routers are machines, and machines route numbers, not names. The **Internet Protocol (IP)** defines the addressing scheme and the packet format. The version that built the internet, **IPv4**, uses **32-bit** addresses: four numbers like `93.184.216.34`, each 0–255, each one byte, four bytes total.

Now the arithmetic that shaped history: 32 bits means 2^32 possible addresses — 4,294,967,296, about **4.3 billion**. In the 1970s that looked inexhaustible; there were barely 4.3 billion *people* online-adjacent, let alone devices. Then came the PC, the phone, the thermostat, the doorbell — each wanting an address. We burned through them. The central allocator, IANA, handed out its last blocks in **2011**. We've been living on workarounds ever since (notably NAT — network address translation — where your whole home shares one public address; your router keeps the internal books). **IPv6** exists, with 128-bit addresses — 2^128, roughly 3.4 × 10^38, enough to give every grain of sand on Earth its own internet — and it is slowly, glacially, taking over. One sentence, as promised; the address shortage is a whole tragicomedy you can now appreciate at parties.

An IP packet's header carries the source and destination addresses plus a few control fields; **routers** — specialized machines whose whole job is forwarding — read the destination, consult their routing tables, and fling the packet toward the next hop. The key algorithm is *longest-prefix match*: addresses are hierarchical (like postal codes), and the router forwards toward whichever known network prefix matches the most leading bits of the destination. No router knows the whole internet. Each one just knows which direction is closer. The packet gets there by a thousand local decisions, like asking directions in a country where everyone only knows their own neighborhood. It should not work. It does.

## TCP: Reliability Built on Sand

Here's the problem: IP is **unreliable by design**. Packets can be lost, duplicated, reordered, or corrupted, and IP will not tell you. It is a best-effort service — the network *tries*. For email and file transfer, "tries" is not good enough. So we built reliability *on top of* unreliability, in a higher-level protocol: the **Transmission Control Protocol (TCP)**.

The mechanism is beautifully simple, and you should learn it because it's one of the great ideas in engineering. Every byte the sender transmits gets a **sequence number**. The receiver, on getting data, sends back **acknowledgments (ACKs)** naming the highest *contiguous* byte received so far — "I've got everything up to byte 4,231." If the sender doesn't get an ACK within a timeout, or gets duplicate ACKs hinting a packet went missing, it **retransmits** just the missing piece. Corrupted packets are caught by checksums and treated as lost. Out-of-order packets are held and re-sequenced by their numbers. Before any of this, the two sides synchronize with a three-step **handshake** — SYN, SYN-ACK, ACK — agreeing on initial sequence numbers and parameters, like two people confirming they're both on the line before starting the conversation.

That's it. That is the whole trick: number everything, acknowledge what's arrived, resend what hasn't. From those three moves you get a stream that *behaves* as if it were perfectly reliable and perfectly ordered, built from a substrate that guarantees neither. TCP doesn't make the network reliable — it makes unreliability *irrelevant* to the application. The cost is latency: retransmission takes round trips, and TCP will wait rather than deliver data out of order or with gaps. (Applications that prefer speed over perfection — live video calls, online games — often use UDP instead: packets with addresses and no promises. Different trade, chosen on purpose.)

This layering — IP for addressing, TCP for reliability — is the **TCP/IP** stack, first described by Vint **Cerf** and Bob **Kahn** in **1974**. They split the problem in two and solved each half with the minimum mechanism required. Fifty years later, essentially every byte you receive still travels this way. When someone tells you protocols don't matter, remember: two men wrote a paper in 1974 and you're reading this sentence because of it.

## DNS: Names to Numbers

Humans don't want numbers. We want `example.com`. The **Domain Name System (DNS)** is the phone book that translates names to IP addresses — a globally distributed database, hierarchical like the addresses themselves.

Walk through one lookup, because the mechanism is the lesson. You type `example.com` into your browser:

1. Your machine asks its configured **recursive resolver** (often run by your ISP, or a public one like `1.1.1.1`) — "what's the IP for `example.com`?"
2. The resolver asks a **root server** — one of thirteen logical root clusters that know where the top-level domains live — "who handles `.com`?"
3. The resolver asks the `.com` **TLD server** — "who handles `example.com`?"
4. The resolver asks `example.com`'s **authoritative server** — "what's the address?" — and gets back an **A record**: `93.184.216.34`.
5. The answer flows back to your machine, and *every level caches it* for a while (the **TTL**, time to live), so the next lookup is instant.

Notice what's not here: no central database of all names. Authority is *delegated* down the hierarchy — the root delegates `.com`, `.com` delegates `example.com`, and `example.com`'s owner can change their records without asking anyone's permission. DNS is governance by delegation, and it resolves billions of names a day. Try it yourself: `dig +short example.com` prints the IP, and running `dig example.com` twice shows the second answer arriving far faster — the cache, working.

## HTTP: The Web's Language

DNS gets you the address; TCP gets you the reliable pipe. But what do the two ends *say*? For the World Wide Web, the language is the **Hypertext Transfer Protocol (HTTP)**: a simple request-and-response protocol, human-readable by design. Tim **Berners-Lee** invented it around 1990 at CERN, alongside the URL and HTML — the Web is his, and he gave it away.

Here is a real HTTP exchange, annotated. The request — what your browser sends:

```
GET /hello HTTP/1.1          ← method + path + version: "get me /hello"
Host: example.com            ← which site (one server can host many)
User-Agent: chapter-11-reader/1.0
Accept: */*                  ← I'll take any content type
                             ← blank line: headers end here
```

The response — what the server sends back:

```
HTTP/1.1 200 OK                    ← version + status: 200 means success
Content-Type: text/plain; charset=utf-8   ← what the bytes mean
Content-Length: 13                 ← how many bytes follow
                                   ← blank line: headers end, body begins
Hello, world!
```

Thirteen bytes, because `Hello, world!` is 13 characters — the server told you exactly how many to expect, so your machine knows when the message is complete. Status codes are the protocol's emotional vocabulary: `200` OK, `301` moved permanently, `404` not found, `500` the server broke. Every web page you've ever loaded was some version of this conversation: a GET, a status, some headers, some bytes. The modern encrypted web (HTTPS) wraps exactly this dialogue in TLS encryption — same language, whispered.

## The Agreed Fiction That Works

Step back and look at what we've built. Packets chopped and reassembled. Addresses that are just numbers, routed by machines that only know their neighborhood. Reliability conjured from unreliability by numbering and acknowledging. Names resolved by delegated authority. A whole civilization's commerce and conversation carried on a request/response dialogue a physicist invented to share documents.

Nothing central enforces any of this. There is no internet police, no master switch, no authority that can revoke your TCP. The protocols are *agreements* — published as RFCs, implemented by thousands of independent organizations, interoperating because everyone implements the same spec. Cerf and Kahn's 1974 paper, Berners-Lee's Web: these weren't products, they were *proposals*, and the world adopted them because they were open and they worked. The internet is the largest functioning anarchy in human history, and it routes your packets in milliseconds.

Milliseconds — let's quantify the physics, because physics always wins. Two numbers describe any network path: **bandwidth** (how many bits per second the pipe carries — capacity) and **latency** (how long one bit takes to make the trip — delay). People confuse them constantly, so here's the canonical image: bandwidth is how wide the highway is; latency is the speed limit. A fiber link across the Atlantic might carry 100 gigabits per second and still take 70 milliseconds to deliver a single bit, because the bit travels at the speed of light in fiber — about **200,000 kilometers per second** — and the ocean is wide. Nothing beats physics: light in fiber is the hard limit, and every network on Earth bows to it.

Do the arithmetic for a New York to Sydney round trip: roughly 16,000 km each way, 32,000 km round trip, divided by 200,000 km/s — that's 0.16 seconds, **160 ms**, as an absolute physical floor, before routers, queues, and software add their share. Real pings run ~200 ms. When someone promises you "instant" global communication, you now know exactly how instant physics allows: about a sixth of a second to the other side of the planet, and not one microsecond less. The agreed fiction works — but it works inside a universe with a speed limit.

Next: we've moved data between machines. Now we need somewhere to *keep* it — organized, searchable, and safe. Chapter 12 is about data at scale: databases, and what happens when one machine isn't enough.

## Build it

1. **Measure the speed of light (approximately).** Run `ping -c 4 example.com` and note the round-trip time. Now compute an upper bound on how far your packets traveled: distance ≤ (RTT ÷ 2) × 200,000 km/s. An 80 ms RTT means your packets went at most 8,000 km each way — the fiber path, including every detour, fits inside that number. Physics gave you a ruler; use it. (Optional: `traceroute example.com` shows the actual hops — each line a router that only knew its own neighborhood.)
2. **Read a real HTTP conversation.** Run `curl -v https://example.com -o /dev/null` and study the output: find the request line (`GET / HTTP/2` or similar), the request headers your machine sent, the status line of the response, and the response headers. Annotate each line the way this chapter did. You are now literate in the protocol that carries the Web.
3. **Watch DNS caching work.** Run `dig example.com` and note the `Query time`. Run it again immediately — the second query should return in ~0 ms, served from cache. Then try `dig +short` on three sites you use daily and write down their IPs. You looked up the phone book; the phone book remembered you.
