# Chapter 10: The Operating System — The Machine's Government

Chapter 9 ended with an uncomfortable truth: programs don't run in a vacuum. Your code, however elegant, is one tenant among many on a machine it doesn't own. This chapter is about the landlord, the police, the courts, and the civil service all at once — the operating system. It is the most consequential piece of software on your computer, and also the one you notice least, which is exactly how good government is supposed to feel.

Define it plainly: the **operating system (OS)** is the program that manages the machine's hardware on behalf of every other program. It decides which program runs on the CPU and when, carves up memory so programs can't see each other's data, stores files, talks to disks and networks, and enforces the rules when programs misbehave. Everything else — your browser, your editor, the database from Chapter 12 — is a guest. The OS owns the building.

## Processes: Citizens With Private Property

A **process** is a running program. Not the file on disk — the live instance, with its own memory, its own open files, its own current position in the code. Your text editor's executable is a file; every window you open in it is (roughly) a process. The distinction matters: the file is the recipe, the process is the cooking.

The OS's first great invention is isolation. Each process gets its own **address space** — its own private view of memory, as if it owned the whole machine. Process A literally cannot name a memory location inside Process B, because A's addresses refer to A's memory. When a process crashes — segfaults, divides by zero, spirals into an infinite loop — the OS kills that process and the rest of the system carries on. This is why one misbehaving tab doesn't take down your whole computer the way it did in the 1990s. (Windows 95 gave every program shared access to everything. It was, in retrospect, anarchy with a Start menu.)

You can see the citizenry right now:

```
ps aux --sort=-%cpu | head -15
```

That lists processes sorted by CPU hunger. Each row shows a process ID (PID — the citizen's social security number), who owns it, how much CPU and memory it holds. There are usually hundreds. Your machine is a crowded city and you had no idea.

## Threads: The Lighter-Weight Sibling

One honest paragraph, as promised. A **thread** is a unit of execution *inside* a process — a process can contain many threads, all running (or appearing to run) simultaneously. Here's the difference that matters: processes have separate address spaces; the threads of one process **share** the same address space — the same memory, the same open files, the same heap. That's why spawning a thread is cheap (no new memory maps to build, nothing to copy) and why threads are dangerous (one thread can silently corrupt another thread's data, and the OS's memory protection doesn't apply *between* threads — the walls are between processes, not between threads). Concurrency bugs — race conditions, deadlocks — are the price of that sharing. The honest rule: use processes when you want isolation, because the OS will physically stop one process from touching another's memory; use threads when tasks share so much data that copying it between processes would be absurd. And one footnote for the Python programmers: CPython's Global Interpreter Lock means threads give you concurrency for I/O-bound work (waiting on networks and disks) but not parallelism for CPU-bound work. The mechanism matters more than the slogan.

## Scheduling: Who Gets the Microphone

Your machine has, say, 8 CPU cores and 300 processes that all want to run. The **scheduler** is the OS component that decides which process runs on which core at any instant, and for how long. When a process's turn ends, the OS performs a **context switch**: it saves the outgoing process's state (registers, program counter — everything from Chapter 4's stored program) and loads the incoming one's. The machine then resumes the new process exactly where it left off, as if it had never been interrupted.

The mechanism is **time-slicing**: each process gets a short burst of CPU — a **time-slice** or *quantum* — typically on the order of milliseconds (Linux's default scheduler hands out slices around 1–10 ms depending on load). When the slice expires, a hardware timer interrupts the CPU — yes, an actual interrupt, the mechanism from Chapter 4 — and the scheduler picks who's next.

Now the quantification that makes this click. A context switch costs roughly single-digit **microseconds** on modern hardware (a few microseconds to save and restore registers for a thread switch; tens of microseconds for a full process switch that also flushes address-translation caches). A time-slice is roughly a **millisecond** — about a thousand times longer than the switch itself. So the overhead of all this swapping is well under 1% of CPU time, and a 3 GHz core executes some 3 million cycles in a single millisecond slice — plenty of real work. The machine isn't *actually* running 300 things at once on 8 cores. It's running 8 things at a time and switching so fast — hundreds of times per second — that to anything operating at human timescales (we notice delays around 100 ms) it looks like everything runs simultaneously. The OS fakes parallelism with speed, and the fake is so good that for most purposes it *is* parallelism.

Opinion, stated plainly: scheduling is the OS's most underrated miracle. Every smooth video call you've ever had happened because a scheduler gave the audio process its slice on time, thousands of times per second, while three hundred other processes clamored for the same cores. Nobody applauds the scheduler. It wouldn't want the attention anyway.

## Memory: Everyone Gets Their Own Country

**Virtual memory** is the OS's second great invention, and it's a beautiful lie. Every process is told it has its own vast, private, contiguous stretch of memory — on a 64-bit machine, effectively unlimited (2^64 bytes of address space, more than any machine will ever have). In reality, physical RAM is far smaller and shared. The OS maintains the fiction with **pages**: memory is divided into fixed-size chunks — 4 KiB on typical x86-64 systems — and the hardware's memory-management unit translates each process's *virtual* page numbers into *physical* page numbers via tables the OS controls. Your process's address `0x7fff0000` and my process's address `0x7fff0000` are the same number pointing at different physical RAM, because each process has its own translation table. Same digits, different countries.

This is also how the OS enforces the isolation from the first section: a process simply has no page-table entry for anyone else's memory, so the hardware itself refuses the access. Protection isn't a policy the OS politely asks programs to follow — it's physics, enforced by silicon on every single memory access, billions of times per second.

But what happens when RAM fills up? The OS starts **paging out**: it takes pages a process isn't using right now and writes them to disk, to a reserved area called **swap space**, freeing the RAM for someone who needs it now. When the process touches that page again, the OS reads it back in — a **page fault** handled transparently. This is why your machine doesn't crash when you open the 47th browser tab.

Here's the cost, and it connects directly to Chapter 4's memory hierarchy. Reading from RAM takes about 100 **nanoseconds**. Reading a page back from an SSD takes about 100 **microseconds** — a thousand times slower. From a spinning hard disk, more like 10 **milliseconds** — a hundred thousand times slower. Swap works, but every swap-in is the OS dropping from the fast tier of the hierarchy to a slow one. And if RAM is so full that the OS spends all its time shuttling pages between RAM and disk — a condition gloriously named **thrashing** — the machine doesn't just get slow, it gets *philosophically* slow: busy at 100% and accomplishing nothing, like a government in gridlock. The fix is never cleverer swapping. It's more RAM, or fewer hungry processes.

You can look at your own process's private country right now:

```
grep -E 'heap|stack' /proc/$$/maps
```

That shows the heap and stack regions of your own shell's address space — proof, in your terminal, that the fiction is running.

## Files and Permissions: The Filing Cabinet and the Locks

A **file** is a named sequence of bytes on persistent storage. That's the whole definition, and its simplicity is its power: source code, photos, databases, the OS kernel itself — all files, all bytes, all named. A **directory** is a special file that maps names to other files. The filesystem is the OS's naming scheme for durable data, a tree of names rooted at `/`.

Because many users and processes share the machine, files need locks. Unix permissions are the classic scheme, and they're worth learning to read because you'll meet them weekly for the rest of your career:

```
-rw-r--r-- 1 corey staff 4096 Oct 16 10:24 notes.txt
```

Reading left to right: the first character is the file type (`-` means regular file; `d` would mean directory; `l` a symbolic link). The next nine characters are three groups of three: **owner**, **group**, **other**. Each triple is **r**ead, **w**rite, e**x**ecute. So `-rw-r--r--` says: the owner can read and write; the group can only read; everyone else can only read. Then `1` is the link count, `corey` the owner, `staff` the group, `4096` the size in bytes, `Oct 16 10:24` the last modification time, and `notes.txt` the name.

Two honest details. First, "execute" on a *directory* doesn't mean what you think — it means permission to *traverse* it, to reach files inside. A directory with read-but-not-execute is a room with a glass wall: you can see the names inside but can't touch anything. Second, the OS enforces these bits on every open, not as advice but as law: a process running as you simply cannot write a file you lack write permission for, no matter how nicely it asks. The permission check happens in the kernel, which the process cannot bypass — it can only ask the kernel to do things, via **system calls**, the guarded border crossings between user programs and the OS. Every file read, every network send, every new process is a system call: the program knocks, the kernel decides.

## The Government, Restated

So the metaphor earns its keep. The OS is a government in the serious sense: it holds a monopoly on the legitimate use of force (only the kernel touches hardware directly), it defines property rights (address spaces, file ownership), it runs the courts (permission checks, killing misbehaving processes), it manages shared infrastructure (scheduling the CPU, paging memory, routing packets — that's next chapter), and it taxes everyone a little overhead to pay for it all (those microseconds per context switch). And like any government, you mostly notice it when it fails: the freeze, the thrash, the permission denied.

But here's the part the metaphor undersells. Governments are made of people and can be argued with. The OS is made of invariants enforced by hardware at billions of operations per second, and it does not negotiate. A process cannot talk its way into another process's memory. That rigidity is the whole point. Civilization — the civilization where your banking app and your game coexist on one machine without eating each other — rests on the OS being utterly, boringly incorruptible about its few core rules.

Next, we leave the single machine. Because as impressive as this government is, the modern world runs on machines *talking to each other* — and out there, there is no government at all. Chapter 11 is about how that possibly works.

## Build it

1. **Meet the citizenry.** Run `ps aux --sort=-%cpu | head -15` and identify the hungriest process on your machine right now. Then pick any file and run `ls -l` on it; decode every field of the output line aloud — type, all nine permission bits, owner, group, size, timestamp — until you can do it without thinking. This is literacy, not trivia: you will read these lines for years.
2. **Watch the scheduler work.** Open a terminal and run `for i in 1 2 3 4; do yes > /dev/null & done` — four CPU-hungry processes, output discarded. Now run `top` or `htop` and watch your cores saturate; notice the machine stays responsive anyway, because the scheduler keeps giving every process (including your terminal) its millisecond slices. When you're done observing, run `killall yes` to clean up. You just watched hundreds of context switches per second keep a crowded city moving.
3. **Visit your own private country.** Run `grep -E 'heap|stack' /proc/$$/maps` and look at the heap and stack regions of your own shell's virtual address space. Those addresses are yours alone — another process printing the same command sees the same *numbers* mapped to different physical RAM. The lie is running, and it's beautiful.
