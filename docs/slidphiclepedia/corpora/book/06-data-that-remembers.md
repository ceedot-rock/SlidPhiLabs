# Chapter 6: Data That Remembers

Chapter 5 gave your programs something to *do*. But programs that only juggle a handful of variables are like a mind that can hold one thought at a time: impressive for a parlor trick, useless for real work. Real programs manage thousands, millions, billions of pieces of data — users, messages, transactions, pixels — and the way that data is *organized* determines whether the program is instant or unusable.

A **data structure** is an organized way of storing data, plus the operations that organization makes fast. That last clause is the whole game. There is no best data structure — only the right one for the operation you need. Choosing well is the difference between a lookup that takes a microsecond and one that takes a minute, on the same machine, with the same data. This chapter gives you the four structures that carry 95% of real software, the honest reason each one is fast at what it's fast at, and a guide for choosing among them.

One note on notation before we start: you'll see expressions like O(1) and O(log n) below. They describe how an operation's cost grows as the data grows — O(1) means constant time no matter how much data, O(n) means proportional to the data size, O(log n) means growing with the *logarithm* of the size. Chapter 7 will define this properly and teach you to measure it. For now, treat these as promises about scaling, and notice how dramatically different they are.

## Lists: data in a row

An **array** is the simplest structure that matters: a contiguous block of memory holding a sequence of elements, all the same size, laid out back to back like houses on a street. Python's `list` is built on this idea (a *dynamic* array — the growth mechanics are a Chapter 7 topic).

```python
scores = [85, 92, 78, 95]
print(scores[0])    # first element
print(scores[2])    # third element
scores.append(88)   # add to the end
print(len(scores))  # how many?
```

Output:

```
85
78
5
```

Note the indexing: `scores[0]` is the *first* element. Counting from zero is not a quirk — it's the addressing math showing through, and here's why.

**Why indexing is O(1): the mechanism, not the magic.** The machine knows two things: the **base address** — where the array starts in memory — and the **element size** — how many bytes each element occupies. The address of element `i` is then:

> address(i) = base_address + i × element_size

One multiplication, one addition. That's it. It doesn't matter whether the array holds ten elements or ten million: finding element 4,000,000 costs exactly the same two arithmetic operations as finding element 0. *That* is what O(1) means — constant time, independent of n. Zero-based indexing exists because the first element sits at offset zero from the base: `scores[0]` lives at `base + 0`. The notation leaked the implementation, and the implementation is beautiful.

But honesty requires the other side of the ledger: arrays are fast at *positional* access and slow at *positional* change. Inserting an element at the front of an array means shifting every existing element one slot over — O(n) work, proportional to the size. Appending at the end is cheap (usually O(1), amortized — Chapter 7 will make "amortized" precise). Searching an unsorted array for a value means checking each element in turn — O(n). Every structure is a tradeoff; the array trades away cheap insertion and search to buy instant indexing.

## Dicts: data by name

Arrays answer "what's at position i?" But half the time the real question is "what's the value *for this key*?" — the phone number for Maya, the balance for account 4417, the definition of "quixotic." A **dict** (short for dictionary; the general name is **hash map** or **hash table**) stores key–value pairs and finds any value by its key in roughly constant time, no matter how many pairs it holds.

```python
phone = {"maya": "555-0101", "julian": "555-0102"}
print(phone["maya"])       # look up by key
phone["dre"] = "555-0103"  # add a pair
print("sam" in phone)      # is this key present?
```

Output:

```
555-0101
False
```

How does it find "maya" without scanning? **Hashing** — and here's the intuition-level mechanism. A **hash function** takes the key and scrambles it deterministically into a number: same key in, same number out, always. The dict takes that number modulo the number of **buckets** (slots in an internal array) and looks in exactly that bucket. Key → hash → bucket → value. One scramble, one array indexing — the same O(1) addressing math as the array, with a hash function in front.

Two honest complications. First, **collisions**: two different keys can hash to the same bucket — with a fixed number of buckets and unlimited possible keys, this is mathematically unavoidable (the pigeonhole principle: more pigeons than holes). The standard fix is **chaining**: each bucket holds a small list of the pairs that landed there, and lookup checks that short list. As long as the hash function spreads keys evenly and the table resizes when crowded, those lists stay tiny and lookup stays effectively O(1) on average. (The full analysis — load factors, universal hashing — is marked *intuition only* here; Chapter 7 gives you the tools to make it rigorous.)

Second, dicts are unordered by nature — well, Python dicts remember insertion order as a convenience, but the *mechanism* doesn't promise it, and you should never write code that depends on hash order in general. If order matters, that's information the structure must maintain deliberately, which is what the next structure family is for.

The dict is arguably the most-used structure in working software: caches, indexes, symbol tables in compilers, JSON objects, counting frequencies. When in doubt, reach for it.

## Sets: membership, nothing else

A **set** is a dict that kept only the keys and threw away the values. It stores unique items and answers one question blindingly fast: *is this thing in here?*

```python
seen = set()
for word in ["the", "cat", "sat", "the"]:
    seen.add(word)
print(len(seen))          # how many distinct words?
print("the" in seen)      # membership test
print("dog" in seen)
```

Output:

```
3
True
False
```

"The" appeared twice but the set holds it once — duplicates collapse, because a set models the mathematical idea of a *collection of distinct things*. Underneath, it's the same hashing machinery as a dict, so membership testing is O(1) on average.

Why does this deserve its own structure instead of "just use a list"? Because `"the" in some_list` scans the list element by element — O(n). On a list of ten words, nobody cares. On a list of ten million log lines, checked a thousand times, the difference between O(1) and O(n) is the difference between a blink and a coffee break. This is the single most common performance fix in beginner code: a membership test inside a loop, over a list, quietly doing O(n²) work — replaced by a set, becoming O(n). You'll know exactly how to measure this after Chapter 7. For now: **need fast membership testing or uniqueness → set (or dict), never a list.**

## Trees: data with a shape

Arrays are lines. Dicts are piles. Some data has *shape* — hierarchies, orderings, decisions. A **tree** is a structure of linked **nodes**: each node holds a value and links to child nodes below it. The **edges** are those links. The **root** is the single node at the top with no parent. Nodes with no children are **leaves**. File systems are trees. The DOM of every web page is a tree. Company org charts, decision flowcharts, the `if`/`elif` chains from Chapter 5 — trees everywhere.

The workhorse is the **binary search tree (BST)**: every node has at most two children, and they obey one ordering rule — everything in the left subtree is smaller than the node, everything in the right subtree is larger. That one rule turns searching into a halving game:

```python
class Node:
    def __init__(self, value):
        self.value = value
        self.left = None
        self.right = None

def insert(node, value):
    if node is None:
        return Node(value)
    if value < node.value:
        node.left = insert(node.left, value)
    else:
        node.right = insert(node.right, value)
    return node

def contains(node, value):
    while node is not None:
        if value == node.value:
            return True
        node = node.left if value < node.value else node.right
    return False

root = None
for v in [50, 30, 70, 20, 40, 60, 80]:
    root = insert(root, v)

print(contains(root, 40))
print(contains(root, 99))
```

Output:

```
True
False
```

Trace `contains(root, 40)`: start at 50. 40 < 50, go left to 30. 40 > 30, go right to 40. Match — `True`. Three comparisons to search seven items. Each comparison discards roughly half the remaining tree — go left and the entire right half is eliminated, forever. That halving is where O(log n) comes from.

**Quantify it:** a balanced binary tree with *d* levels holds about 2^d nodes. Flip it around: n items need about log₂(n) levels. And 2^20 = 1,048,576 — so a *million* items in a balanced BST take roughly **20 comparisons** to search. Twenty. Not a million, not a thousand — twenty. Compare that with scanning an unsorted list: a million comparisons. This is why databases index with tree structures (B-trees, the BST's bushier cousin): logarithmic scaling turns impossible searches into trivial ones.

Now the honest caveat, because a PhD-level treatment never hides the assumption: that O(log n) says *when balanced*. Insert sorted data — 1, 2, 3, 4, 5 — into the naive BST above and each new node dangles off the right of the last: the "tree" is a linked list wearing a costume, and search degrades to O(n). Real implementations maintain balance deliberately — AVL trees and red-black trees rebalance on every insert with rotations (Knuth devotes serious pages to this in *The Art of Computer Programming*, the field's canonical reference, which you'll consult for the rest of your career). The mechanism of rotation is left as an exercise with a pointer; the lesson is the pattern: **every fast structure has an assumption, and production structures are engineered to protect it.**

## Choosing: a decision guide

You've now got four tools. Here's how to reach for the right one — not as dogma, but as the questions to ask:

- **"I need items in order, accessed by position"** → **list**. Scores by rank, pixels by coordinate, lines of a file. Indexing is O(1); appending is cheap; inserting in the middle costs O(n).
- **"I need values looked up by key"** → **dict**. Phone books, caches, counters, configurations, anything JSON-shaped. Average O(1) lookup, insert, delete.
- **"I need to test membership or enforce uniqueness, fast"** → **set**. Seen-this-before filters, deduplication, allowed-values checks. O(1) membership; never scan a list for this.
- **"I need data kept sorted with fast insert and search"** → **balanced tree** (or a sorted container built on one). Leaderboards, ranges ("all events between Tuesday and Friday"), ordered indexes. O(log n) across the board.

Two scenarios to make it concrete. You're building a spell-checker over a 200,000-word dictionary, checking each word of a novel: membership testing, so **set** — each lookup O(1), total O(n) for the novel. Use a list and each lookup scans 200,000 words; the novel has 100,000 words; that's 2×10^10 comparisons — minutes or hours instead of a second. Second scenario: a leaderboard that must stay sorted as a million scores stream in, with frequent "top 10" queries. A list kept sorted costs O(n) per insert (shifting); a balanced tree costs O(log n) per insert — roughly 20 steps per score instead of up to a million. Different shape of need, different structure, thousand-fold difference in outcome.

And two structures you'll meet soon, named now so they're familiar: a **stack** (last-in, first-out — like a stack of plates; function calls themselves run on one) and a **queue** (first-in, first-out — like a line at a shop; print jobs, task schedulers). Both are usually built on arrays or linked lists, both O(1) for their signature operations. Python gives you `collections.deque` for the queue case — a list works as a stack with `append`/`pop`, but never use a list as a queue (`pop(0)` shifts everything: O(n), the array's old weakness again).

## What you've built

Step back. Four chapters ago, data was frozen bits. Then it became something the machine acts on (Chapter 4), something you command with programs (Chapter 5) — and now it's something *organized*, with each organization buying a different kind of speed. The progression is deliberate: representation, action, command, organization. Each layer assumes the ones below and enables the ones above.

But notice what we haven't done yet: we've *claimed* speeds — O(1), O(log n), O(n) — mostly on the strength of mechanism and arithmetic. Claims are cheap; measurements are truth. How do you actually know your dict lookup is O(1) and not secretly O(n)? How do you compare two approaches honestly, with a stopwatch and a straight face, instead of vibes? When does the constant factor hiding inside O(1) — remember the memory hierarchy's preferences from Chapter 4 — embarrass the "better" complexity class?

That's Chapter 7: thinking in algorithms — searching, sorting, and the discipline of measuring speed honestly. You're about to learn the single most transferable skill in this book: how to ask "how fast?" and get a real answer.

## Build it

1. **Prove O(1) indexing to yourself.** Build a list of 10 million integers (`list(range(10_000_000))` — this will use ~800 MB of RAM, so make sure your machine can spare it; use 1 million if not). Time `lst[0]`, `lst[500_000]`, and `lst[9_999_999]` with `time.perf_counter()`, repeating each access many times and averaging. The three timings should be indistinguishable — position doesn't matter, exactly as `base + i × size` predicts. Now time `"x" in lst` for a value near the end, and feel the O(n) scan. Write down both numbers; the ratio is the price of choosing the wrong structure.

2. **Build a frequency counter.** Take any text file on your machine (a chapter of this book works nicely) and write a program that counts how many times each word appears, using a dict: for each word, `counts[word] = counts.get(word, 0) + 1`. Print the ten most common words. Then answer honestly: what would this cost with a list of (word, count) pairs instead of a dict? (Each lookup would scan the list: O(n) per word, O(n²) total. On a 5,000-word chapter that's ~25 million comparisons versus ~5,000 hash lookups.) This is the spell-checker scenario from the chapter, in miniature.

3. **Break a binary search tree.** Take the BST code from this chapter and insert the numbers 1 through 15 *in order*. Draw the resulting tree on paper — it will be a straight line leaning right. Now count the comparisons `contains` needs to find 15 (answer: 15, every node). Then insert the same numbers in this order — 8, 4, 12, 2, 6, 10, 14, 1, 3, 5, 7, 9, 11, 13, 15 — draw that tree, and count comparisons to find 15 (answer: 4). Same data, same code, 15 vs 4: that gap is the entire difference between "balanced" and "degenerate," and it's why real tree implementations rebalance. (For the full story — rotations, AVL invariants, red-black coloring — the canonical reference is Knuth's *The Art of Computer Programming*, Volume 3: Sorting and Searching.)
