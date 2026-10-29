# Chapter 7: Thinking in Algorithms

Chapter 6 ended with a question, and I owe you an answer. We built lists and dictionaries and trees of data, and I said the next thing an honest programmer asks is: *how fast are these operations, really?* Not "fast" — fast is a slogan. I mean: if I double the amount of data, what happens to the time? If I multiply it by a thousand, does the program shrug, or does it lie down and die?

This chapter is about learning to answer that question before you run the code. It is about the most valuable habit in programming that isn't typing.

## What an algorithm is

An **algorithm** is a precise procedure for getting something done — precise enough that no human judgment is required anywhere in the middle. A recipe is an algorithm ("stir for two minutes") only if every step is unambiguous; "season to taste" is not algorithmic, because it asks a person to decide. A computer, being gloriously free of taste, only runs algorithms.

That definition matters because it draws the line where this chapter starts. Chapter 5 was about *correctness*: does the program produce the right answer? This chapter is about *cost*: what does the right answer cost, and how does the cost grow?

Every algorithm consumes two things: **time** (elementary operations — comparisons, additions, assignments) and **space** (memory). We will mostly talk about time, and everything we say generalizes.

## The problem with stopwatches

Suppose you write a search routine and time it: 0.003 seconds on a million items. Is that good? You have learned nothing durable. On my machine it might be 0.001 seconds; on your phone, 0.02. Next year's machine cuts both numbers in half. The stopwatch measures the machine, not the idea.

What we want is a description of cost that survives a change of hardware — something about the *shape of the work*, not the speed of the hands doing it. The trick is to ask a relative question: **as the input size grows, how does the work grow?**

Call the input size **n** — the number of items. We count operations as a function of n. We don't care whether one operation is a nanosecond or a microsecond; we care whether the total is roughly n operations, or n², or something in between. Constants wash out. Growth rates don't.

## Big-O, honestly

Here is the definition, intuition first, formal second. Intuitively: **f(n) is O(g(n)) if, for large n, f(n) is bounded by some constant multiple of g(n).** The algorithm's work grows *no faster than* g(n), up to a constant we agree not to care about.

Slightly more formally — not drowning you, I promise: f(n) is O(g(n)) if there exist constants C and N such that f(n) ≤ C · g(n) for every n ≥ N. That's all. We're saying: past some size N, the curve f never escapes C times the curve g. The constants C and N are where machine-specific details go to be politely ignored.

Two consequences that beginners always find slightly scandalous:

1. **We drop constants.** O(3n) is O(n). O(10,000n) is O(n). At n = 10⁹, nobody cares about the 10,000; they care about the n.
2. **We drop lower-order terms.** O(n² + n) is O(n²). When n is huge, the n² term is the entire story; the +n is a rounding error.

"But," you will say, "for small n, constants matter enormously!" Correct. Big-O is an *asymptotic* statement — it describes the large. For small inputs, just measure. Big-O is the tool for the inputs you haven't seen yet, the ones your program will meet next year when the business is a hundred times bigger. Choosing an O(n²) algorithm when an O(n log n) one exists is how programs that worked in testing fall over in production.

What would prove a Big-O claim wrong? Timing. Double n and watch: if time roughly doubles, you're linear; if it quadruples, you're quadratic. That falsifiability is what makes the notation science rather than vibes.

## Searching: the first duel

You have a list of a million names, sorted or not, and you want to know if "Zoe Alvarez" is in it.

**Linear search** walks the list front to back, comparing each name. Worst case — Zoe is last, or absent — that's n comparisons: **O(n)**. For n = 1,000,000, that's 1,000,000 checks. Simple, honest, and it doesn't care whether the list is sorted.

**Binary search** requires a sorted list, and it exploits that. Look at the middle name. If it's Zoe, done. If "Zoe Alvarez" comes after the middle alphabetically, throw away the entire left half; otherwise throw away the right half. Repeat on the half that remains. Every comparison discards *half* the remaining list.

How many times can you halve a million before one item remains? That's log₂(1,000,000), and 2²⁰ = 1,048,576, so the answer is about **20**. Twenty comparisons instead of a million — a 50,000× difference — bought with nothing but sortedness and a smarter procedure.

Here's the whole thing:

```python
def binary_search(items, target):
    """Return the index of target in the SORTED list items, or -1."""
    lo, hi = 0, len(items) - 1
    while lo <= hi:
        mid = (lo + hi) // 2      # middle of the remaining range
        if items[mid] == target:
            return mid
        elif items[mid] < target:
            lo = mid + 1          # target is in the right half
        else:
            hi = mid - 1          # target is in the left half
    return -1
```

Walk it mentally on `[2, 5, 9, 14, 21]` looking for 14: `lo=0, hi=4`, `mid=2`, `items[2]=9 < 14`, so `lo=3`. Now `mid=3`, `items[3]=14` — found. Two comparisons. Linear search would have needed four.

Now the honesty clause, because Big-O is about truth-telling: binary search is O(log n) **only if the list is already sorted**. Sorting costs something — we'll see it's O(n log n) — so binary search wins when you search many times after sorting once, not when you sort to search a single item. An O(log n) claim that hides an O(n log n) setup is a half-truth, and this book doesn't do those.

## Sorting: where the n² goes to die

Sorting a million items with a naive method is where beginners first watch a program visibly give up.

**Insertion sort** builds the sorted list one card at a time, like sorting a hand of playing cards: take the next card, slide it left until it sits in the right spot. The k-th card compares against up to k cards already placed. Total comparisons: 1 + 2 + 3 + … + n, which is n(n+1)/2 — that's **O(n²)**. For n = 1,000,000, that's about 5 × 10¹¹ comparisons. A modern CPU does on the order of 3 × 10⁹ simple operations per second, so you're waiting on the order of three minutes — for one sort. At n = 10 million, O(n²) says: go get lunch, then dinner. This is the scaling wall. Insertion sort is fine for a hand of cards and fatal for a database.

The escape is **divide and conquer**: split the problem into halves, solve each half, and combine. Sorting splits beautifully:

1. Split the list into two halves.
2. Sort each half (by doing exactly this procedure again — recursion, from Chapter 5).
3. **Merge** the two sorted halves into one sorted list by walking both with a finger, always taking the smaller front card. Merging n items takes O(n) — each item is touched once.

The recurrence is T(n) = 2T(n/2) + n: two half-sized sorts plus a linear merge. Proof sketch via the recursion tree: there are log₂n levels of halving (level 0 is one problem of size n, level 1 is two of size n/2, and so on down to n problems of size 1), and each level does n total work across all its subproblems. Levels × work per level = **O(n log n)**.

For our million items: n log₂n ≈ 20,000,000 operations — about 7 milliseconds against insertion sort's three minutes. Not 10% faster. Not twice as fast. Roughly *twenty-five thousand times* faster. That is what a better growth rate buys, and no amount of hardware tuning will ever close that gap: a faster machine multiplies both times by the same constant, and the n² still wins the race to unusable.

```python
def merge(left, right):
    """Merge two SORTED lists into one sorted list. O(len(left)+len(right))."""
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    out.extend(left[i:])   # one side is exhausted; take the rest
    out.extend(right[j:])
    return out

def mergesort(items):
    if len(items) <= 1:
        return items                     # a list of 0 or 1 is already sorted
    mid = len(items) // 2
    return merge(mergesort(items[:mid]),  # sort the left half
                 mergesort(items[mid:])) # sort the right half
```

Trace it on `[7, 3, 9, 1]`: split into `[7, 3]` and `[9, 1]`; each splits again into singletons; merging `[7]` and `[3]` gives `[3, 7]`, merging `[9]` and `[1]` gives `[1, 9]`; the final merge walks `[3, 7]` and `[1, 9]` to produce `[1, 3, 7, 9]`. The recursion does the splitting; `merge` does the only real work, and it does it in one linear pass. That linear merge is the whole reason the recurrence solves to n log n instead of n².

## Efficiency is a form of honesty

Here's the opinion I promised. An honest program admits what it costs. When you ship code without knowing its growth rate, you're signing a contract you haven't read — and the bill arrives when the data grows. Every production outage I've ever seen that was "mysterious" turned out, on inspection, to be an O(n²) that met an n nobody tested with.

Big-O is how programs tell the truth about themselves. It's the label on the box: *this sort costs n log n; this lookup costs log n after a one-time sort; this nested loop over all pairs costs n², and you'd better know why you're paying it.* Sometimes n² is the honest answer and you pay it anyway, because n is small and the code is clearer — that's a legitimate engineering trade, made with eyes open. The sin isn't slowness. The sin is not knowing.

Two canonical names, because credit matters. **Donald Knuth** essentially invented the rigorous analysis of algorithms — his *The Art of Computer Programming* is where this way of thinking grew up. **CLRS** (*Introduction to Algorithms*, by Cormen, Leiserson, Rivest, and Stein) is the standard text: the one algorithms course you take in a serious program is taught from it. You don't need either book yet. You need the habit: before you celebrate that it works, ask what it costs at ten times the size.

## Build it

1. **Feel the wall.** Time insertion sort versus mergesort on lists of 1,000, 2,000, 4,000, and 8,000 random integers (use `time.perf_counter()` around each). Write down the ratios as n doubles. Insertion sort's times should roughly *quadruple* each doubling; mergesort's should a bit more than *double*. When your stopwatch agrees with the theory, you've verified a Big-O claim empirically — that's the falsifiability loop working.
2. **Break binary search on purpose.** Feed the binary search above an *unsorted* list and a target you know is present. Watch it return -1 or the wrong index. Then write a three-line comment above the function documenting the precondition ("items must be sorted ascending") — you've just practiced honesty in code, the habit this chapter preaches.
3. **Find the hidden n².** Write a function that finds duplicate names in a list by comparing every pair (two nested loops). Measure it on 500, 1,000, and 2,000 names and confirm the quadrupling. Then rewrite it using a Python `set` — each lookup is O(1) *amortized* (average case; more on that word in a data-structures course) — and watch the same task go linear. Same problem, two growth rates, and now you can tell them apart before they bill you.
