# Chapter 12: Data at Scale

Chapter 10 gave us one machine's government. Chapter 11 taught machines to talk. Now the question that makes both of those expensive: where does the data *live*? A file on one laptop is fine until a million people need to read and write it at the same time, until the laptop dies, until someone asks "show me every order from last Tuesday over fifty dollars" and expects an answer in milliseconds. This chapter is about **databases** — organized, queryable, durable data — and about what happens when one machine isn't enough and you have to spread the data across many. Databases and networks are infrastructure. Next chapter, we build what people actually touch.

## Databases: Memory That Survives

Define it: a **database** is an organized collection of data that is **queryable** (you can ask it questions in a precise language), **durable** (it survives crashes and power loss — the answers are on disk, not just in RAM), and usually **shared** (many programs and users read and write it concurrently, with rules). A spreadsheet on your laptop is organized; it is not a database in this sense, because two programs writing to it at once will cheerfully corrupt it.

The dominant species is the **relational database**: data stored in **tables** — rows and columns, like a spreadsheet with discipline. Each table has a **schema**: the declared shape of every row (this column is text, that one is a number, this one can never be empty). The schema is a contract, and the database enforces it on every write. That enforcement is the whole difference between "a pile of files" and "a database": the database refuses to store nonsense.

## SQL in Five Minutes

The language for talking to relational databases is **SQL** (Structured Query Language, "sequel"), and it has been the answer since the 1970s — one of the longest-lived technologies in computing, outliving nearly every programming language trend. It reads almost like English, which is deliberate. Three statements carry 90% of daily life:

```sql
CREATE TABLE accounts (
    id            INTEGER PRIMARY KEY,
    owner         TEXT NOT NULL,
    balance_cents INTEGER NOT NULL DEFAULT 0
);
```

This declares the contract: an `accounts` table where every row has an integer `id` that uniquely identifies it (the **primary key**), a text `owner` that must be present, and an integer `balance_cents` defaulting to zero. Note the money is stored in *cents* as an integer — a professional habit you'll meet everywhere, because floating-point arithmetic and money are a famously bad marriage (0.1 + 0.2 ≠ 0.3 in binary floating point; Chapter 3's algebra of certainty has limits, and this is one of them).

```sql
INSERT INTO accounts (owner, balance_cents) VALUES ('Maya', 10000);
INSERT INTO accounts (owner, balance_cents) VALUES ('Julian', 5000);
```

Two rows written. Maya has $100.00, Julian has $50.00.

```sql
SELECT owner, balance_cents FROM accounts WHERE balance_cents >= 7000;
```

And the payoff: "show me owners with at least $70.00." The answer is Maya, 10000. You described *what you want*, not *how to find it* — that's the declarative power of SQL. The database figures out the how. This division of labor (you specify the question, the machine plans the execution) is why SQL survived: it lets the database get smarter — better planners, better indexes — without you changing a word.

## Indexes: The Card Catalog

Here's the performance question SQL's declarativism raises: *how* does the database find Maya's row? The naive way is a **full table scan**: read every row, check the condition, keep the matches. That costs O(n) — linear in the number of rows. A million rows means a million checks.

An **index** is a data structure — usually a **B-tree** — maintained alongside the table that makes lookups fast. Think of the card catalog in an old library: instead of walking every shelf (full scan), you consult the alphabetized drawers (index) and go straight to the right shelf. A B-tree is a balanced tree where each node branches many ways; finding a key means walking from the root to a leaf, one decision per level.

Quantify it. A binary search over a million sorted entries needs about **20 comparisons** (2^20 ≈ 1,048,576) instead of 1,000,000 — a fifty-thousand-fold reduction. Real B-trees do better still: each node holds hundreds of keys, so a million-row index is typically only 3–4 levels deep, meaning a lookup costs a handful of disk reads instead of a million. The price: every write must update the index too, and indexes consume space. So you index the columns you query by, and you don't index everything — engineering is the art of paying for only what you use.

```sql
CREATE INDEX idx_balance ON accounts(balance_cents);
```

One line, and every future `WHERE balance_cents >= ...` query stops scanning and starts seeking. You'll measure exactly how much this matters in the exercises.

## Transactions and ACID: Money Must Not Vanish

Now the hard problem. Two programs update the same account at the same time. The machine crashes halfway through a transfer. How do we keep the data *correct*? The answer is the **transaction**: a group of operations treated as a single, indivisible unit. The classic example — move $30.00 from Maya to Julian — is two writes: debit Maya, credit Julian. Either both happen or neither does. There is no acceptable middle.

Databases promise four properties for transactions, remembered as **ACID**:

- **Atomicity:** a transaction is all-or-nothing — every step commits, or none does. No half-transfers.
- **Consistency:** each transaction moves the database from one valid state to another — all constraints and rules still hold afterward.
- **Isolation:** concurrent transactions behave *as if* they ran one at a time, even though they actually overlap. Your transfer doesn't see my half-finished transfer.
- **Durability:** once a transaction commits, it stays committed — it's on durable storage, surviving crashes and power loss.

Why they matter, in one sentence each: without atomicity, a crash mid-transfer destroys money; without consistency, the database slowly fills with contradictions nobody can untangle; without isolation, two simultaneous transfers corrupt each other's arithmetic; without durability, "committed" is a rumor. ACID is the reason banks trust databases with the actual money. It is also genuinely hard to implement — the database is doing concurrency control, crash recovery, and disk management so your application doesn't have to — which is why databases are among the most carefully engineered software on Earth, and why "just use files" stops being funny around the second concurrent user.

## Distributed Systems: When One Machine Isn't Enough

One machine has limits: it can only be so fast, hold so much, and — critically — it can die. So we spread data across many machines: for capacity (more disks), for speed (more CPUs serving queries), and for survival (if one machine dies, the others keep answering). Welcome to **distributed systems**, where the problems get philosophically interesting.

Three realities define the territory. Learn them as facts of nature, not as bugs to be fixed:

**Consistency** — *does everyone see the same data?* If Maya's balance updates on server A, does a read from server B see the new value immediately, or the old one for a while? Strong consistency says immediately, always. Weaker variants say "eventually." The choice shapes what your application can promise its users.

**Partitions** — *the network can split, and it will.* A **partition** is when some machines can't talk to others — a cut cable, a dead switch, a misconfigured firewall. This isn't a rare disaster; at scale it's routine. Undersea cables get cut by ship anchors. Configurations get fat-fingered. Any design that assumes the network never partitions is a design with an expiration date.

**Failure** — *machines die; design assuming it.* Disks fail, power fails, processes crash, entire data centers flood. In a fleet of ten thousand machines, something is always broken — the statistics guarantee it. The question is never "will it fail" but "what happens when it does." Systems that survive are systems that *expected* the death: data replicated on multiple machines, work that can move, no single point whose failure is total.

These three realities collide in the most famous result in the field.

## Brewer's CAP Theorem: You Can't Have Everything

In 2000, Eric **Brewer** stated what became the CAP theorem (later proved by Gilbert and Lynch in 2002): a distributed data system cannot simultaneously guarantee all three of **C**onsistency (every read receives the most recent write), **A**vailability (every request receives a non-error response), and **P**artition tolerance (the system keeps operating despite network partitions). The honest reading — and people routinely get this wrong — is that partition tolerance isn't really a choice: partitions happen whether you plan for them or not, so the theorem is really about what you sacrifice *during* a partition. When the network splits and server A can't reach server B, you have two options and both hurt: keep accepting writes on both sides and let them disagree (choose availability, sacrifice consistency — the two halves diverge and someone reconciles later), or refuse writes until the partition heals so no disagreement is possible (choose consistency, sacrifice availability — part of your system goes dark rather than lie). There is no third option where everything stays consistent *and* available across a split; that's what the proof proves. Also honestly: real systems don't pick a religion, they tune — quorum reads, tunable consistency levels, careful choices per operation — because "pick two" is a slogan and engineering is a dial. But the dial exists because the theorem is true, and every distributed database you've ever heard of — and every one you'll build on — sits somewhere on it.

Opinion, offered with the receipts above: CAP is the rare theorem that makes you a better engineer just by knowing it. Most system designs fail not from bad code but from demanding the impossible — perfect consistency *and* total availability *during* a network split — and then being surprised. The theorem doesn't tell you what to build. It tells you what you can't, so you spend your ingenuity on the possible.

## The Infrastructure Beneath the World

Look at where we've arrived. Databases give us organized, queryable, durable truth, guarded by ACID. Indexes make the truth retrievable in milliseconds from millions of rows. Distribution spreads the truth across machines that die and networks that split, with CAP marking the boundary of the possible. And Chapter 11's protocols move it all between those machines at the speed of light's own limit.

This is infrastructure — the part users never see and everything depends on. It is deliberately invisible when it works, which is why whole careers are built on understanding it anyway: when the invisible breaks, only the people who know how it works can fix it.

But infrastructure is not the destination. Nobody wakes up excited about a B-tree. People get excited about what gets *built on top*: the applications, the sites, the services — the things with users. Databases and networks are the foundation and the roads. Chapter 13 is the city: the Web as a world, client and server, and how you build things other people actually use.

## Build it

1. **Feel the index.** You'll need `sqlite3` (install it if missing — it's a single small package on every platform). Then:
   ```
   sqlite3 demo.db "CREATE TABLE logs(id INTEGER PRIMARY KEY, level TEXT, msg TEXT);"
   python3 -c "
   import sqlite3, random
   db = sqlite3.connect('demo.db')
   db.executemany('INSERT INTO logs(level,msg) VALUES (?,?)',
       [(random.choice(['INFO','WARN','ERROR']), f'msg-{i}') for i in range(100000)])
   db.commit()"
   sqlite3 demo.db ".timer on" "SELECT COUNT(*) FROM logs WHERE level='ERROR';"
   ```
   Note the time. Now `sqlite3 demo.db "CREATE INDEX idx_level ON logs(level);"` and run the timed query again. Same question, same answer — wildly different time. You just measured O(n) versus O(log n) with your own hands.
2. **Watch money vanish (then save it).** Save this as `bank.py` and run it:
   ```python
   import sqlite3
   db = sqlite3.connect('/tmp/bank.db')
   db.execute("CREATE TABLE IF NOT EXISTS accounts(owner TEXT PRIMARY KEY, balance_cents INTEGER)")
   db.execute("DELETE FROM accounts")
   db.executemany("INSERT INTO accounts VALUES (?,?)", [('Maya', 10000), ('Julian', 5000)])
   db.commit()

   def transfer_no_txn(db, amount):
       db.isolation_level = None  # autocommit: each statement commits alone
       db.execute("UPDATE accounts SET balance_cents = balance_cents - ? WHERE owner='Maya'", (amount,))
       raise RuntimeError("power cut!")  # crash between the two writes
       db.execute("UPDATE accounts SET balance_cents = balance_cents + ? WHERE owner='Julian'", (amount,))

   try:
       transfer_no_txn(db, 3000)
   except RuntimeError:
       pass
   print(db.execute("SELECT * FROM accounts").fetchall())
   ```
   Maya lost $30.00 and Julian never received it — 3,000 cents destroyed by a crash between two statements. Now fix it: wrap the two updates in a transaction (`with db:` commits on success and rolls back on exception) and confirm the balances are unchanged after the simulated crash. That's atomicity, and you now understand viscerally why it exists.
3. **Take a side in CAP — in writing.** Pick two applications: (a) a bank ledger, (b) a social network's like counter. For each, write one paragraph: during a network partition, do you choose consistency or availability, and why? There are defensible answers on both sides for (b); for (a) there is really one. The point isn't the answer — it's that you can now *see* the trade-off instead of stumbling into it.
