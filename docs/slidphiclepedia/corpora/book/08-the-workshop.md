# Chapter 8: The Workshop

Up to now you've been programming like a cook in a home kitchen: one recipe, one sitting, the whole thing in your head. That stops working around a few hundred lines. Real software is built the way furniture is built — in a workshop, with tools, over time, usually with other people, and with the constant risk of cutting the wrong board.

This chapter is the workshop tour: **version control** (so you can never truly lose work), **debugging** (so you can find out why it's wrong), **testing** (so you can prove it stays right), and **reading other people's code** (because most of your career will be spent in workshops other people built). None of this is glamorous. All of it is the difference between a hobbyist and a professional.

## Git: a time machine for your code

A **repository** is a folder that remembers. Ordinary folders only know the present; a repository knows every past state of every file, who changed what, when, and why. The tool that manages this memory is called **git**, and it is the single most important tool in the workshop. Learn it before you need it, because you will need it the day something breaks and you can't remember what you changed.

Three definitions, then the workflow:

- A **commit** is a snapshot of your whole project at one moment, plus a message describing what changed and why. Think of it as a save point in a video game — you can always return to one. Each commit points to its parent, forming a history.
- A **branch** is a parallel timeline. You're building a feature but the main line needs to keep working? Branch off, experiment freely, and later fold your work back in. Branches make "what if" cheap.
- A **merge** folds one timeline back into another — git combines the two histories, and if both changed the same lines, it asks you to resolve the conflict by hand.

The minimal workflow — six commands that cover 90% of real use:

```bash
git init                    # turn this folder into a repository (once)
git add .                   # stage all changes: "these go in the next snapshot"
git commit -m "Add binary search from Ch 7"
                            # take the snapshot, with a message
git log --oneline           # read the history: one line per commit

git switch -c experiment    # create branch "experiment" and move to it
# ... do risky work ...
git switch main             # go back to the safe timeline
git merge experiment        # fold the experiment back in
```

Two pieces of opinionated advice, earned the hard way. First: **commit messages are letters to your future self.** "Fix stuff" is a letter that says nothing; "Fix off-by-one in binary_search hi bound" is a letter you'll be grateful for at 2 a.m. Second: **commit small and often.** A commit should be one idea. When a commit contains one idea, reverting it is surgery; when it contains twelve, reverting it is amputation. The professionals you admire aren't smarter than you — they just have smaller, better-labeled save points.

## Debugging as a science

Debugging is not a talent. It is the scientific method with the lab coat off, and once you see it that way, the panic goes away. The steps are the same ones you learned in school:

1. **Observe.** Reproduce the bug reliably. "It crashes sometimes" is not an observation; "it crashes when the input list is empty" is. If you can't reproduce it, you can't verify the fix — you're guessing.
2. **Hypothesize.** Propose a cause. *One* cause. "I think `hi` starts one too high" beats "something's wrong with the indexes" the way a scalpel beats a hammer.
3. **Predict.** This is the step everyone skips, and it's the step that makes it science. Before touching the code, state what you expect to see *if your hypothesis is true*: "If `hi` is one too high, then printing `items[hi]` on an empty list should throw an IndexError."
4. **Test.** Run the experiment. Print the value. Check.
5. **Falsify.** If the prediction fails, your hypothesis is wrong — *discard it cheerfully* and form a new one. The bug is not insulting you. The fastest debuggers I know are the fastest abandoners of wrong theories.

Now, the tools. **Print-debugging** — inserting `print()` statements to watch values flow — is the oldest tool in the shop, and don't let anyone shame you out of it. It works everywhere, requires no setup, and for a confusing value in a confusing loop it is often the fastest path to an observation. Its weakness is that it's manual: you edit, run, read, delete, repeat.

A **debugger** lets you pause the program mid-run and inspect everything — variables, the call stack, the exact line you're on — without editing the code. In Python, you get one free:

```python
def binary_search(items, target):
    lo, hi = 0, len(items) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        breakpoint()          # pause here; inspect lo, hi, mid, then continue
        if items[mid] == target:
            return mid
        ...
```

Run it, and the program stops at `breakpoint()`, handing you an interactive prompt where you can type `lo`, `mid`, `items[mid]` — anything. Type `c` to continue, `q` to quit. Use print-debugging for quick questions ("what is this value right here?") and the debugger for structural confusion ("how did execution *get* here?"). Knowing both, and knowing which question you're asking, is the whole skill.

One more discipline: **read error messages precisely, and read tracebacks bottom-up.** A Python traceback prints the call chain top-down but the actual error — the line that failed and why — is at the *bottom*. Beginners read the top, panic at the library internals, and miss the last three lines where Python is plainly telling them: `IndexError: list index out of range`, on *your* line 14. The error message is the program's hypothesis about what went wrong. It is sometimes wrong, but it is always evidence. Start there, every time.

## Testing: proving it stays right

A **unit test** is a small program that checks one small unit of behavior: does this function do what it claims, on inputs I chose? The unit is usually a single function. The test feeds it known inputs and asserts known outputs.

```python
def add(a, b):
    return a + b

def test_add():
    assert add(2, 3) == 5       # the obvious case
    assert add(-1, 1) == 0      # the boundary case: negatives
    assert add(0, 0) == 0       # the edge case: zeros

test_add()
print("all tests passed")
```

That is a complete, real test. Run the file; silence (plus the confirmation print) means the contract holds. The `assert` is the whole mechanism: if the condition is false, Python raises an error and the test fails loudly. When your test suite grows past a handful of functions, reach for a test runner — `pytest` is the standard — which discovers your `test_*` functions and reports them all at once instead of you wiring prints by hand.

Why bother? Three reasons, in increasing order of importance. First, tests catch regressions: six months from now you'll "improve" `add` and the test will catch you breaking it. Second, tests let you refactor fearlessly — change the internals, rerun the tests, and *know* nothing broke. Third, and most underrated: **tests are documentation of intent.** A function's test says what the author meant it to do, in executable form, including the edge cases. When you inherit someone's code, read their tests first — they're the specification the code was written against.

The honest caveat: tests prove the presence of checked behavior, not the absence of bugs. A test suite is a net, not a proof. Write the tests for the cases you'd be embarrassed to get wrong, keep them fast enough that you actually run them, and never trust a test you haven't seen fail — a test that can't fail can't protect you. (Deliberately break the function once, watch the test go red, then fix it. That red moment is the test earning its keep.)

## Reading other people's code

You will spend more of your career reading code than writing it. Most programmers are never taught how, so here's the method:

**Start from the entry points, not the first file.** Find `main`, or the README's "quickstart," or the script the tests import. A codebase is a machine; you learn a machine by watching what it does when switched on, not by cataloging its screws.

**Follow the data, not the control flow.** Pick one concrete input and trace what happens to it, function to function, the way you'd follow a river. Data has a shape and a destination; control flow has branches and loops that multiply in your head. The river is easier to hold.

**Don't read top to bottom.** Nobody reads a city by walking every street. Skim for structure — file names, function names, module boundaries — then zoom into the one neighborhood your question lives in. Names are the map legend; if the names are bad, that's information too (about the codebase, sympathetically).

**Run it, then change one thing.** Reading is passive; the code becomes yours when you perturb it. Change one constant, one string, one branch — predict what will happen (there's the scientific method again), run it, and check. Five minutes of this teaches more than an hour of staring.

And the opinion: **reading good code is the fastest way to become a good programmer.** Find a small, well-regarded open-source project in a language you know — the kind with clear names and tests — and read it like literature. You'll absorb patterns no tutorial teaches: how errors are handled, how modules are divided, what "clean" actually looks like when it's working for a living.

## Build it

1. **Build the habit.** Take any program you've written for this book, run `git init` in its folder, and make three commits with real messages — one per logical change, not one per file. Then create a branch, deliberately break something on it, and switch back to `main` to confirm your working code is untouched. That feeling of safety is the entire point of the tool.
2. **Debug scientifically.** Take the binary search from Chapter 7 and introduce a bug: change `hi = mid - 1` to `hi = mid`. Write down your hypothesis about what will go wrong *before* running it, predict a specific failing input, then test with a `breakpoint()` inside the loop. Infinite loops are the best teachers — watch `lo` and `hi` refuse to converge and you'll understand the invariant the correct version maintains.
3. **Write tests that earn their keep.** Write unit tests for the `mergesort` from Chapter 7 covering: an empty list, a single element, an already-sorted list, a reverse-sorted list, and a list with duplicates. Run them, watch them pass — then deliberately break `merge` (swap `<=` for `<`... actually no, that still sorts; instead, drop one of the `out.extend` lines) and confirm at least one test goes red. A test you've seen fail is a test you can trust.
