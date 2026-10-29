# Chapter 4: The Stored Program

Chapter 3 ended with a quiet miracle: anything — text, pictures, music, numbers — can be frozen into bits. But frozen is not the same as *alive*. A photograph stored as bits is just a very orderly graveyard of numbers. The question now is: how does the machine *act* on them? How do inert patterns become behavior?

The answer is the single most consequential idea in computing: the **stored program**. The program itself — the instructions telling the machine what to do — is stored as data, in the very same memory as the numbers it operates on. That sentence looks innocent. It rebuilt civilization.

## The idea that ate the world

In 1945, John von Neumann circulated a document with an unglamorous title — *First Draft of a Report on the EDVAC* — describing how to build a computer in which instructions and data share one memory. Before this, machines were programmed by physically rewiring them: plugboards, switches, cables moved by hand to change what the machine computed. Changing the program meant changing the machine. Von Neumann's proposal: keep the machine fixed, and change the *numbers in its memory* instead. The instructions are just another kind of data.

This is worth sitting with, because everything else in this book rides on it. A computer is not a calculator with many functions. It is one fixed piece of hardware that can become, in effect, *any machine at all* — a calculator, a typewriter, a piano, a telephone exchange — simply by loading different numbers into its memory. The hardware is universal; the software is what it dreams of being today.

One warning before we go further: the stored program is also why computer viruses exist. If instructions are data, then data — arriving in an email attachment, a web page, a file — can *become* instructions. The power and the danger are the same mechanism. We'll return to this.

## The cast of characters

To understand how the machine acts, you need four definitions. I'll define each precisely, because Chapter 2 taught us that the machine punishes vagueness — starting with the vocabulary.

An **instruction** is a pattern of bits that the machine's control hardware interprets as a command rather than as a number. Same bits, different meaning — meaning comes from *context*, from *where* the bits sit and *when* they are read. `01100011` might be the number 99 to one part of the machine and the command "add" to another. The machine knows which interpretation applies because of a strict ritual it performs, over and over, billions of times per second.

A **register** is a tiny storage cell built directly into the processor — the CPU's own private scratch paper. A modern CPU has a few dozen of them. They hold the values the machine is working on *right now*: the two numbers being added, the result just computed, an address being looked up. Registers are the fastest storage in the machine because they are physically part of the computation circuitry — no travel time. There are never enough of them, which is why the memory hierarchy (coming shortly) matters so much.

The **program counter**, usually abbreviated **PC**, is one special register. It holds the *address* — the location in memory — of the next instruction to execute. Not the instruction itself: its address. Think of it as the machine's finger, pointing at the current line of the recipe. After each instruction, the finger moves to the next one, unless an instruction tells it to jump elsewhere. That jumping is what makes loops and decisions possible, as you'll see in Chapter 5.

**Memory** itself is a vast numbered row of slots — addresses — each holding a fixed-size chunk of bits. When we say the program counter "points to address 100," we mean: go to slot 100 in this row and read what's there.

## The cycle: fetch, decode, execute

Now the ritual. The CPU does exactly three things, forever, until the power dies:

1. **Fetch.** Read the instruction stored at the address in the program counter. Then advance the program counter to the next address.
2. **Decode.** Look at the bit pattern and figure out which command it is and what it operates on.
3. **Execute.** Do it. Add the numbers, move a value, compare two things — whatever the instruction says.

Fetch, decode, execute. Fetch, decode, execute. At 3 billion cycles per second on a typical laptop chip, that loop runs 3,000,000,000 times every second — the "3 GHz" on the box. Every app you've ever used, every game, every video call, is this loop, repeated until it looks like magic.

Let's watch it happen once, slowly. Here is a complete tiny program, four instructions, sitting in memory. Our data — the numbers 7 and 5 — waits at addresses 100 and 101.

| Address | Contents | Meaning |
|---|---|---|
| 0 | LOAD R1, [100] | Copy the value at memory address 100 into register R1 |
| 1 | LOAD R2, [101] | Copy the value at memory address 101 into register R2 |
| 2 | ADD R3, R1, R2 | Add R1 and R2, put the result in R3 |
| 3 | STORE R3, [102] | Copy R3 into memory address 102 |
| 100 | 7 | (data) |
| 101 | 5 | (data) |

Initial state: PC = 0, all registers empty. Now watch:

**Cycle 1.** Fetch the instruction at address 0. PC advances to 1. Decode: it's a LOAD — move data from a memory address into a register. Execute: R1 becomes 7. (Registers: R1=7.)

**Cycle 2.** Fetch the instruction at address 1. PC advances to 2. Decode: LOAD again. Execute: R2 becomes 5. (Registers: R1=7, R2=5.)

**Cycle 3.** Fetch the instruction at address 2. PC advances to 3. Decode: ADD — take two registers, add them, store in a third. Execute: R3 = 7 + 5 = 12. (Registers: R1=7, R2=5, R3=12.)

**Cycle 4.** Fetch the instruction at address 3. PC advances to 4. Decode: STORE — move data the other direction, from a register into memory. Execute: memory address 102 becomes 12.

**Cycle 5.** Fetch the instruction at address 4 — there's nothing there, or a HALT instruction, and the machine stops.

Result: memory address 102 now holds 12. Four cycles turned two stored numbers into their sum. Every program ever written is this, scaled up: billions of fetches, each one as dumb and exact as the ones you just watched. There is no step where the machine "understands" addition the way you do. It just moves bits through gates, and addition *falls out* of the arrangement. The understanding is yours; the machine supplies the obedience.

Notice something subtle: the program counter advancing by one each time is what makes a program a *sequence*. And an instruction that writes a new value into the program counter — a **jump** — is what makes a program able to *decide*. Jump to address 10 if R1 is zero, otherwise continue: that is the entire basis of `if` statements and loops. You'll meet them as friendly Python in the next chapter; underneath, they are all jumps.

## The memory hierarchy: why fast memory is small

Here's a problem. The CPU can fetch-decode-execute billions of times per second, but the data it needs lives in memory, and memory is *far away* — not in distance, in time. The CPU is a sprinter chained to a warehouse across town. The industry's solution is one of the great engineering compromises in history: the **memory hierarchy**, a stack of storage technologies, each level roughly 10 to 1,000 times slower than the one above it, but roughly 10 to 1,000 times larger. Fast things are small; big things are slow; you cannot have both in one technology, so you stack them:

- **Registers:** a few dozen values, effectively part of the CPU. Access time: a fraction of a nanosecond — essentially free. Capacity: a few hundred bytes.
- **L1 cache:** ~32–64 KB per core, built onto the chip. ~1 nanosecond. This is the CPU's shirt pocket.
- **L2 cache:** ~256 KB–2 MB per core, also on-chip. ~3–10 nanoseconds. The desk drawer.
- **L3 cache:** tens of megabytes, shared across cores. ~10–40 nanoseconds. The filing cabinet in the same room.
- **RAM (main memory):** gigabytes. ~60–100 nanoseconds. The warehouse across town. Roughly 100× slower than L1.
- **SSD:** terabytes. ~100 microseconds — that's 100,000 nanoseconds, roughly 1,000× slower than RAM.
- **Hard disk / network storage:** terabytes to effectively infinite. ~5–10 milliseconds for a disk seek — another 100× slower than SSD.

Read that column of times again: under a nanosecond at the top, milliseconds at the bottom — a spread of *ten million to one*. The hierarchy works because of **locality**, and locality comes in two flavors. **Temporal locality:** if the program just used a value, it will probably use it again soon (loops!). **Spatial locality:** if the program used address 100, it will probably want address 101 next (arrays! instructions in sequence!). So each level keeps a copy of the most recently and most adjacently used data from the level below. When the CPU asks for something, it checks the smallest, fastest level first and falls through only on a **miss**. In practice, well above 90% of accesses are satisfied by the caches — the CPU almost never waits for the warehouse.

Why should you, a future builder, care? Because this hierarchy is the hidden variable behind half of all performance mysteries. Two programs can do the "same" work with wildly different speeds if one respects locality and the other doesn't — accessing memory in a scattered pattern can be 10–100× slower than a sequential one, doing identical arithmetic. When Chapter 7 teaches you to measure speed honestly, the memory hierarchy will be the first suspect whenever the numbers surprise you. The machine we described as obedient is obedient, but it has *preferences*, and locality is its deepest one.

## Two ways to turn words into action

You've seen what the machine executes: instructions as bit patterns. But nobody writes bit patterns — that way lies madness and, historically, the 1940s. Humans write programs in languages like Python, and something must bridge the gap. There are two fundamental strategies, and the tradeoff between them is one you'll meet everywhere in engineering.

A **compiler** translates the *entire program* into machine code *ahead of time*, before it ever runs. You write your source, you invoke the compiler, it thinks hard — often for seconds or minutes — and produces a standalone executable: pure instructions, ready for the fetch-decode-execute cycle. Then running is fast, because all the translation work was done once, up front. C, C++, Rust, and Go work this way.

An **interpreter** skips the separate translation step. It reads your program and executes it *line by line*, translating each piece on the fly, every time it runs. Python (in its standard implementation), Ruby, and early JavaScript work this way. Writing and running blur together: you type, it runs, you see what happened, you fix it, you run again.

The honest tradeoff, quantified: a compiled program typically runs **10–100× faster** than the same logic run through a naive interpreter — the interpreter pays translation tax on every single step, forever. But the interpreted workflow is *faster to iterate*: no compile step, no waiting, instant feedback. Compile once and run fast, versus run now and pay per step. For a program that will run a million times, compile it. For a program you're still figuring out, interpret it.

And — because the field hates clean binaries — the line blurs. Modern systems use **just-in-time (JIT) compilation**: the runtime watches which parts of your interpreted program run hottest and compiles *those* to machine code on the fly. JavaScript's V8 engine and Java's JVM do this; it's why web pages feel instant. The honest model is a spectrum: pure interpretation on one end, ahead-of-time compilation on the other, JIT in the middle, each point trading startup cost against running speed.

## The layers, stacked

Step back and look at what we've built across four chapters. At the bottom: physics — transistors switching. Above that: bits, and the algebra that makes them trustworthy (Chapter 3). Above that: the stored program — instructions as data, the fetch-decode-execute cycle turning patterns into action, the memory hierarchy feeding the beast, compilers and interpreters bridging human words to machine obedience.

Each layer is a *lie agreed upon*: the layer below pretends to be simpler than it is, so the layer above can think clearly. Registers pretend memory is instant. Caches pretend all memory is fast. Machine code pretends the CPU is simple. Python — which you are about to meet — pretends the whole stack is a helpful friend who speaks English.

These lies are not deceptions; they are *abstractions*, and abstraction is the master tool of this entire discipline. You will spend your career choosing which lies to believe at which moment — and knowing when to peel one back and look at the truth underneath, usually because something is slow or broken and the abstraction is where the answer hides.

The machine can represent anything, and it can act on anything. The only thing missing is *you*, telling it what to do. That's next: you write your first programs, and the loop that has been fetching, decoding, and executing since 1945 starts running *your* instructions.

## Build it

1. **Be the CPU.** Take the four-instruction program from this chapter (LOAD, LOAD, ADD, STORE with 7 and 5 at addresses 100 and 101). On paper, change the data to 13 and 29 and trace all four cycles by hand: write down the PC, the fetched instruction, and every register's value after each cycle. Then add a fifth instruction of your own design — say, an instruction that doubles R3 — and trace that too. If you can be the CPU for six instructions, you understand the cycle.

2. **Feel the hierarchy.** Time two loops in Python (you'll learn the syntax in Chapter 5 — peek ahead or just run it): one that sums a list of a million numbers in order, and one that sums them by jumping through a shuffled index order, touching the same elements. Same arithmetic, same count of operations. Measure with `time.perf_counter()`. The scattered version will be measurably slower — that gap is the memory hierarchy making its preferences known. Write down the ratio you measured.

3. **Compile versus interpret, by hand.** Take any three-line recipe ("add 2 and 3", "multiply the result by 10", "print it"). First, *compile* it: translate the whole thing into numbered fetch-decode-execute-style steps on paper before "running" any of it. Then *interpret* it: read line one, do it immediately, then read line two. Notice where your attention goes in each mode — the compiler-you plans globally, the interpreter-you reacts locally. That's the tradeoff, in your own head.
