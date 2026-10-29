# Chapter 3: Bits and the Algebra of Certainty

Everything you've seen so far — files, folders, commands, the screen itself — is made of something smaller. This chapter goes all the way down, to the atoms of computing. The good news: there are only two of them.

A **bit** is the smallest unit of information: a single binary digit, either **0** or **1**. Off or on. False or true. That's it — the entire digital universe is built from a coin that landed. This chapter is about how two symbols become numbers, text, images, logic itself — and why that works with mathematical certainty rather than luck.

## Counting in base 2

You count in base 10 because you have ten fingers. Each position in a number is worth ten times the one to its right: in 345, the 3 means three *hundreds* (10²), the 4 means four *tens* (10¹), the 5 means five *ones* (10⁰). The base is just a choice of how many symbols you get (0–9) before you carry.

A machine with wires that are either on or off gets two symbols: 0 and 1. So it counts in **base 2**, or **binary**. Each position is worth *two* times the one to its right:

```
 1   1   0   1
 2³   2²   2¹   2⁰
 8  + 4  + 0  + 1  = 13
```

Binary `1101` is decimal 13. Each slot is a power of two, and you add up the slots holding 1s. Check it: 8 + 4 + 0 + 1 = 13. The mechanism is identical to decimal — only the base changed.

**Define before using:** a *base-n* number system uses n symbols (0 through n−1); the value of each position is n raised to that position's index, counting from 0 at the right. Decimal is base 10, binary is base 2. Same machinery, different n.

Now watch what happens as you add bits. With 1 bit you can represent 2 values (0, 1). With 2 bits, 4 values (00, 01, 10, 11 → 0–3). With 3 bits, 8 values. Each new bit *doubles* the count, because it doubles the number of combinations: every old pattern can now end in 0 or 1.

With **n bits**, you get **2ⁿ values**. This exponential, 2ⁿ, is the drumbeat of the chapter. Memorize its rhythm:

| bits (n) | values (2ⁿ) |
|---|---|
| 1 | 2 |
| 4 | 16 |
| 8 | 256 |
| 10 | 1,024 (≈ a thousand) |
| 16 | 65,536 |
| 20 | ≈ a million |
| 30 | ≈ a billion |
| 32 | ≈ 4.3 billion |

Eight bits get a name: a **byte**. A byte holds 2⁸ = **256** distinct values — 0 through 255. Why 8? Partly historical accident (early machines settled on it), partly sweet spot: 256 values is enough for an alphabet's characters plus control codes (see ASCII below), and 8 is a convenient power of two. Every byte on your machine — all 16 billion of them in your RAM — is just 8 bits, 8 tiny on/off switches, holding one of 256 patterns. And 10 bits ≈ a thousand is the engineer's rule of thumb you'll use forever: 2¹⁰ ≈ 10³, so every 10 bits multiplies capacity by roughly a thousand. Twenty bits, a million. Thirty, a billion. A 32-bit number spans the population of Earth.

Intuition only, but a useful one: exponentials start boring and end terrifying. The difference between 8 bits and 32 bits isn't 4× — it's 16 *million* ×.

## Boolean logic: the algebra of true and false

Bits aren't just for counting. They're for *reasoning* — and the mathematics of reasoning with true/false was worked out in 1854 by **George Boole**, an English mathematician, in *The Laws of Thought*. **Boolean algebra** is the algebra of propositions that are either true or false, with three fundamental operations:

**NOT** flips a value: NOT true = false, NOT 0 = 1.

**AND** is true only when *both* inputs are true. **OR** is true when *at least one* input is true. (This OR is inclusive — "coffee or tea" where you may take both — unlike the exclusive "soup or salad" of restaurant menus. Precision matters; Boole chose inclusive.)

The rigorous way to define them is a **truth table**: every possible input combination, with the output:

```
AND:          OR:           NOT:
A B | A∧B    A B | A∨B     A | ¬A
0 0 |  0     0 0 |  0      0 | 1
0 1 |  0     0 1 |  1      1 | 0
1 0 |  0     1 0 |  1
1 1 |  1     1 1 |  1
```

That's the whole of Boolean logic's foundation — three tiny tables. From them you can build *any* logical statement: "the door opens if (badge valid AND (it's daytime OR I'm the manager)) AND NOT (alarm active)" is just ANDs, ORs, and a NOT, composed. Every `if` statement in every program ever written is one of these tables in disguise.

Boole did this as pure philosophy of mind — logic as algebra, a century before computers. He had no idea.

## From logic to lightning: gates

In 1937, a 21-year-old MIT master's student named **Claude Shannon** wrote a thesis with the delicious title *A Symbolic Analysis of Relay and Switching Circuits*. His insight: Boole's algebra describes electrical switches perfectly. A switch that's closed is true; open is false. Wire switches in series and you get AND (current flows only if *both* close). Wire them in parallel and you get OR (current flows if *either* closes). Shannon proved that *any* Boolean expression can be built from switching circuits — and therefore any logical reasoning can be done by hardware.

This is the bridge the entire digital age walks on: **logic = circuits**. Shannon's thesis is arguably the most consequential master's thesis ever written.

The modern switch is the **transistor**: a microscopic device where a tiny voltage on one terminal controls whether current flows between two others — an electrically operated switch with no moving parts. Transistors are wired into **logic gates**: physical circuits implementing AND, OR, NOT. Gates are wired into adders (binary addition, built from AND/OR/NOT — you can derive a full adder from the truth tables above as an exercise), adders into an ALU, and eventually into the CPU from chapter 1, with its tens of billions of transistors. Proof sketch of the chain: transistors → gates → arithmetic → processor. Each link is fully understood; the wonder is only in the scale of composition.

So when your CPU adds 2 + 2, no one "taught" it arithmetic the way you learned it. It routes voltages through gates that implement Boolean logic that implements binary addition. Thought, turned into switching, turned into silicon. Boole's philosophy, Shannon's circuits, your laptop.

## Representation: everything is numbers

If all a machine holds is bits, then *everything* — numbers, text, images, this book — must be encoded as bit patterns. **Representation** is the agreed mapping between bit patterns and meanings. Different data needs different mappings, and choosing them well is half of computer science.

### Integers: unsigned, then the clever trick

**Unsigned integers** are the obvious mapping: the bit pattern *is* the number in binary. `00001101` (8 bits) = 13. Range: 0 to 2ⁿ − 1. An 8-bit unsigned integer holds 0–255; a 32-bit one holds 0 to ~4.3 billion.

But what about negative numbers? The naive idea — reserve one bit for the sign — creates two zeros (+0 and −0) and makes subtraction circuitry awkward. The real solution, used by every computer on Earth, is **two's complement**, and its mechanism is genuinely beautiful:

To represent −x in n bits: write x in binary, flip every bit (0↔1), then add 1.

Example — negative three in 4 bits. Start with 3 = `0011`. Flip: `1100`. Add 1: **`1101`**. So `1101` means −3.

Why does this work? Add 3 and −3 and watch: `0011` + `1101` = `10000` — five bits, but we only have four, so the overflow bit falls off the edge, leaving `0000`. **3 + (−3) = 0**, exactly as required, using the *same* addition circuit as unsigned numbers. No special subtraction hardware needed — subtraction is just addition of the complement. That economy is why it won: one circuit does both jobs.

Check the range: 4-bit two's complement spans −8 (`1000`) to +7 (`0111`) — 16 values total, 2⁴, as the drumbeat demands. The top bit now means "negative" (it's 1 exactly for the negative half). Notice there's one more negative than positive (−8 has no +8); that asymmetry is the price of having a single zero. Falsifier for the curious: if a system used sign-bit instead, adding +3 and −3 would need special handling — two's complement needs none.

### Text: ASCII, then the whole world

Numbers were easy. Text needs an agreement: which number means 'A'?

**ASCII** (1963) assigned the numbers 0–127 to English letters, digits, punctuation, and control codes: 'A' is 65, 'a' is 97, '0' is 48. Seven bits sufficed — one byte per character with room to spare. Every text file, every program's source code, every email of the early internet was ASCII bytes. (Proof you can check: in a terminal, `echo -n A | od -An -tu1` prints `65`.)

But 128 characters can't hold the world's writing — not Chinese, not Arabic, not emoji. **Unicode** is the modern agreement: a single numbering of *every* character in every writing system, currently over **149,000 characters** and still growing — Latin, Cyrillic, Han ideographs (tens of thousands), Egyptian hieroglyphs, musical symbols, emoji. Each character gets a **code point**, a number: 'A' is still 65 (Unicode begins as ASCII, deliberately), 'é' is 233, '中' is 20013, '😀' is 128512.

Storing code points naively would cost 4 bytes per character — quadrupling every English text file. **UTF-8** is the clever encoding that avoids this: it's variable-length. Code points 0–127 take exactly 1 byte (identical to ASCII — every ASCII file *is* already valid UTF-8, which is why the transition worked); higher code points take 2, 3, or 4 bytes as needed. English text costs nothing extra; the world's scripts cost what they need. UTF-8 now encodes the overwhelming majority of the web. Representation lesson, repeated: pick the mapping that makes the common case cheap.

### Images: pixels and arithmetic

An **image** is a grid of tiny colored dots — **pixels** (picture elements). Each pixel's color is stored as three numbers: **R**ed, **G**reen, **B**lue intensities, one byte (0–255) each. Why three? Human color vision has three receptor types; mixing three primaries reproduces the perceivable range. Three bytes per pixel, 256³ = 16,777,216 possible colors — more than the eye distinguishes.

Now the resolution math, because this book quantifies:

A "1080p" image is **1920 × 1080** pixels. Total pixels: 1920 × 1080 = 2,073,600 — about 2 million. At 3 bytes per pixel: 2,073,600 × 3 = **6,220,800 bytes ≈ 6.2 MB** for *one* uncompressed frame. A 4K frame (3840 × 2160) is four times that: ~25 MB. A minute of 4K video at 60 frames per second? 60 × 60 × 25 MB ≈ **90 GB per minute** — which is why video *compression* exists (an industry built on the fact that consecutive frames barely change; your lab's compression work lives here).

And that screen redraw from chapter 1 — 2 million pixels, 120 times a second — is the machine pushing ~6 MB through its display pipeline every 8 milliseconds, forever, just to show your desktop. The numbers were always there. Now you can compute them.

## Certainty, not magic

Step back and see what this chapter built. From one distinction — 0 vs. 1 — we derived counting (binary, 2ⁿ), reasoning (Boolean algebra, truth tables), physical logic (Shannon's gates, transistors), and the representation of numbers (two's complement), all human text (Unicode/UTF-8), and images (RGB pixels). Each layer is *exact*: given the bit pattern, the meaning is determined, with no ambiguity and no luck involved. That determinism is what "the algebra of certainty" means — and it's what lets billion-transistor machines be *reliable* rather than merely complicated.

But representation is only half the story. We know how data *sits* in the machine. We don't yet know how the machine *acts* on it — how those bit patterns become instructions, how instructions become programs, how the CPU actually fetches, decodes, and executes, and how your typed commands turn into voltages in gates.

That is chapter 4: the stored program. The machine is about to start moving.

## Build it

1. **Count to 31 on one hand.** Each finger is a bit (down = 0, up = 1). Binary-count from 0 to 31 — that's 5 bits, 2⁵ values. Feel the doubling: adding one finger doubles how high you can count. Then answer: how many values can you represent with all ten fingers, and what's the largest number?
2. **Do two's complement by hand.** In 8 bits, represent −42: write 42 in binary (`00101010`), flip every bit, add 1. Then add your result to `00101010` and verify you get `00000000` (dropping the overflow bit). Then find the 8-bit two's complement range and confirm −128 has no positive counterpart — explain in one sentence why.
3. **Measure your own screen.** Look up your display's resolution (or your phone's), multiply width × height × 3 bytes, and compute one uncompressed frame in MB. Then compute one second of video at 60 fps. Compare the result to a real video file of the same length on your device — the ratio between your number and the file's size is the compression ratio, and now you know exactly what compression is *for*.
