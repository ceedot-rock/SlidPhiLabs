# Chapter 5: Your First Programs

Chapter 4 ended with an invitation: the machine is waiting, obedient, fetching and decoding — and now *you* get to supply the instructions. This is the chapter where you stop reading about programs and start writing them. Everything from here on is learned by doing, so before you read further: you need Python installed and a way to run it. If you don't have it, install it from python.org, open a terminal, type `python3`, and you should see a `>>>` prompt. That prompt is Chapter 4's interpreter, ready to run your words line by line.

## Why Python

A first language should be three things: readable enough that your programs look like your thoughts, real enough that the skills transfer to everything else, and used enough that help is one search away. Python is all three. Its syntax was deliberately designed to resemble plain English — compare `if age >= 18:` with the equivalent ceremony in older languages and you'll feel the difference. It is also not a toy: it runs Instagram's backend, much of modern AI research, scientific computing, and automation at thousands of companies. And it is the most-taught first language in universities on earth, which means every error message you will ever see has been seen, solved, and explained by someone before you.

Python is interpreted, so the feedback loop is instant: type a line, press enter, see what happened. That tight loop is how programming is actually learned — not by memorizing, but by trying, breaking, and reading the wreckage. The wreckage, by the way, has a name: a **bug**. The term predates computers (engineers used it for mechanical defects in the 1800s), but it stuck because on one famous 1947 occasion the defect in Harvard's Mark II computer was a literal moth. Your bugs will be less photogenic. They will also be your best teachers.

One more thing before we begin: every snippet in this chapter is real, tested code. Type it exactly — indentation included, because in Python indentation is not decoration, it's structure — and you will get exactly the output shown. If you don't, the difference between what you typed and what's printed here is itself the lesson.

## Variables and types: named boxes and their rules

A **variable** is a name you attach to a value, so you can refer to the value later without repeating it. Think of it as a labeled box: you put something in, and from then on the label gets you the thing. In Python you create one with a single `=`, which means *assignment* — "take the value on the right and store it under the name on the left":

```python
name = "Maya"
episodes = 12
pi = 3.14159
awake = True
```

A **type** is the answer to two questions: *what kind of thing is this value?* and *what am I allowed to do with it?* The type is a contract. Python's four basic types:

- **int** — whole numbers: `12`, `-3`, `0`. You can add, subtract, multiply, and divide them exactly (well — division produces a float; integer division `//` stays whole).
- **float** — numbers with a fractional part: `3.14159`, `-0.5`. The name is historical: the decimal point *floats*. Warning, filed for later: floats are approximations, not exact decimals. `0.1 + 0.2` in Python gives `0.30000000000000004`, not `0.3`. This is not a Python bug; it's how binary floating-point works everywhere (IEEE 754, since 1985). Never compare floats with `==` for money or exactness — that road ends in tears.
- **str** — text, short for "string" (a string of characters): `"Maya"`, `'hello'`. You can glue strings together with `+` and repeat them with `*`.
- **bool** — truth values, named for George Boole (Chapter 3's algebra): exactly `True` or `False`, nothing else, capital T and F. They are the entire basis of every decision a program makes.

Try this:

```python
episodes = 12
title = "Slid Pod"
hours = episodes * 0.5
long_running = episodes > 10
print(title, "has run", episodes, "episodes,", hours, "hours total.")
print("Long running?", long_running)
```

Output:

```
Slid Pod has run 12 episodes, 6.0 hours total.
Long running? True
```

Notice what happened: `episodes * 0.5` multiplied an int by a float and produced a float (`6.0`) — Python promotes the result to the more general type. And `episodes > 10` is a *comparison*: it evaluates to a bool. Comparisons (`>`, `<`, `==`, `!=`, `>=`, `<=`) are how programs ask questions, and bools are how they hear the answers. Every `if` in every program ever written is, underneath, a bool being consulted.

A discipline to adopt now: **name things for what they mean**, not what they are. `episodes` beats `x`. `hours` beats `h2`. You will read your code ten times more often than you write it, and future-you is a stranger — be kind to them. This is the beginning of typing with intent from Chapter 2: the name is a promise about meaning.

## Control flow: decisions and repetition

So far our programs run top to bottom, once, like a recipe with no choices. Real programs *decide* and *repeat*. That is what **control flow** means: statements that control which instructions run and how many times. Underneath, remember, these are the jumps from Chapter 4 — the program counter being redirected. Python gives you civilized versions.

**If/else: the decision.** The program asks a question (an expression that yields a bool) and runs one block or another:

```python
hour = 14

if hour < 12:
    print("morning")
elif hour < 18:
    print("afternoon")
else:
    print("evening")
```

Output:

```
afternoon
```

Read it aloud: "if hour is less than 12, print morning; else-if hour is less than 18, print afternoon; else print evening." `elif` is just "else if" with the vowels squeezed out. The machine evaluates the conditions top to bottom and runs the *first* block whose condition is true, then skips the rest. With `hour = 14`: `14 < 12` is False, `14 < 18` is True — so it prints `afternoon` and never looks at the `else`. The indentation (four spaces, consistently) is what tells Python which lines belong to which block. In most languages braces do this job; Python uses whitespace, which forces your code to *look* like its structure. This is a feature, not an aesthetic choice: structure you can see is structure you can trust.

**For: repetition over a collection.** When you want to do something once per item:

```python
for day in ["Mon", "Tue", "Wed"]:
    print("day:", day)
```

Output:

```
day: Mon
day: Tue
day: Wed
```

The `for` loop takes each element of the list in turn, assigns it to `day`, and runs the block. Three items, three runs, `day` a different value each time. This is the workhorse of programming: most of what programs do is "for each thing in some collection, do something." The list `["Mon", "Tue", "Wed"]` is our first glimpse of Chapter 6's territory — a sequence of values held together.

Need to count? `range()` generates sequences of numbers: `range(5)` gives 0, 1, 2, 3, 4 (it starts at 0 and stops *before* 5 — this trips up everyone exactly once, and then never again):

```python
for i in range(5):
    print("round", i)
```

Output:

```
round 0
round 1
round 2
round 3
round 4
```

**While: repetition until a condition changes.** A `for` loop knows its items up front; a `while` loop keeps going *while* something stays true, checking before each round:

```python
n = 5
while n > 0:
    print(n)
    n = n - 1
print("liftoff")
```

Output:

```
5
4
3
2
1
liftoff
```

Trace it: `n` starts at 5. Is `5 > 0`? Yes — print 5, then `n = n - 1` makes `n` 4. Is `4 > 0`? Yes — print 4, `n` becomes 3... down to `n = 1`: print 1, `n` becomes 0. Is `0 > 0`? No — the loop ends, and execution continues after it: `liftoff`.

Memorize this pattern, because it contains the most common beginner bug in existence: the **infinite loop**. If you forget `n = n - 1`, the condition never becomes false and the loop runs forever (until you interrupt it with Ctrl+C). Every `while` loop needs something inside it that moves the condition toward false — *progress toward termination*. When your program hangs, this is the first suspect. Always.

## Functions: naming a reusable computation

You'll quickly notice yourself writing the same logic twice. The fix is a **function**: a named, reusable computation that takes **parameters** (inputs) and produces a **return value** (the output). Define it once with `def`, call it by name whenever you need it:

```python
def fahrenheit_to_celsius(f):
    return (f - 32) * 5 / 9

print(fahrenheit_to_celsius(212))
print(fahrenheit_to_celsius(32))
```

Output:

```
100.0
0.0
```

Dissect it: `def fahrenheit_to_celsius(f):` declares a function named `fahrenheit_to_celsius` with one parameter, `f`. The indented body computes `(f - 32) * 5 / 9` and `return`s it — `return` means "this is the value the function call becomes; hand it back to whoever asked." Then `fahrenheit_to_celsius(212)` *calls* it with the argument `212`, and the call evaluates to `100.0`, which `print` displays. Two calls, one definition. The body was written once and executed twice, with different values flowing through `f` each time.

This is abstraction at its smallest scale. The caller doesn't need to know *how* the conversion works, only what it promises: Fahrenheit in, Celsius out. Good functions are promises kept: a clear name, one job.

A function without `return` still runs — it just returns the special value `None` (Python's way of saying "nothing here"). And parameters are just variables that get their values from the caller: inside the function, `f` is a box; the call puts the argument in the box.

## Precision as a discipline

Here is the deep lesson of this chapter, the one that separates people who fight the machine from people who command it: **the machine executes exactly what you wrote, not what you meant.** It has no common sense, no charitable interpretation, no ability to notice you "obviously" meant the other thing. Vagueness is not a style choice; it is a bug.

This shows up in small, sharp ways. `=` assigns; `==` compares — and `if x = 5:` is a syntax error in Python precisely because confusing them is so easy that the language refuses to let you. Indentation changes meaning: a line indented one extra space belongs to a different block and runs at a different time, or never. `True` is a bool; `"True"` is a string; `true` is a NameError. The machine distinguishes all three instantly and mercilessly.

Connect this back to Chapter 2's "typing with intent." Every keystroke is a decision with consequences downstream. The discipline is: say exactly what you mean, in the machine's terms, and verify rather than assume — run the snippet, read the output, compare with what you expected. When they differ, the machine is right about what you *wrote*; you are right about what you *wanted*; the gap between those is the entire job. Debugging is not a separate skill from programming. Debugging *is* programming, with the lights on.

The good news: precision is a muscle, and it compounds. Every error message read carefully, every off-by-one caught by tracing — programmers who seem to "just see" bugs are programmers who have been wrong ten thousand times and paid attention each time.

## A complete program: the guessing game

Time to put it all together. Here is a complete program — variables, a function-free loop, decisions, input and output, all working as one:

```python
import random

secret = random.randint(1, 20)
tries = 0

print("I'm thinking of a number between 1 and 20.")

while True:
    guess = int(input("Your guess: "))
    tries = tries + 1

    if guess < secret:
        print("Higher.")
    elif guess > secret:
        print("Lower.")
    else:
        print("Got it in", tries, "tries!")
        break
```

`import random` loads Python's random-number module (a library: other people's functions, free to use). `random.randint(1, 20)` picks a secret integer from 1 to 20. Then the `while True:` loop — `True` is always true, so this loop runs until something inside stops it. Each round: `input("Your guess: ")` prints the prompt and *waits for you to type*; `int(...)` converts your text to a number (input always arrives as a string — types matter). Then the decisions: too low, "Higher."; too high, "Lower."; exactly right — congratulations, and `break`, which exits the loop immediately.

A sample session (the secret happened to be 13 this time — yours will differ):

```
I'm thinking of a number between 1 and 20.
Your guess: 10
Higher.
Your guess: 15
Lower.
Your guess: 13
Got it in 3 tries!
```

Fourteen lines, ten concepts — and two chapters ago you knew none of them. Read the program again: you know what every line does. That's the whole trick of this book. The machine that has been fetching, decoding, and executing since 1945 is now running *your* decisions. It's a small game. It's also the first world you ever built — a tiny universe with rules you invented and a machine that enforces them perfectly.

Next, we give your programs memory that lasts longer than a single run of a loop: data structures — ways of organizing information so your programs can find it, keep it, and grow it.

## Build it

1. **FizzBuzz, the rite of passage.** Write a program that prints the numbers 1 through 20, but for multiples of 3 prints `fizz`, for multiples of 5 prints `buzz`, and for multiples of both prints `fizzbuzz`. (Hint: check the both-case *first* — `n % 15 == 0` — because `if`/`elif` runs the first true branch and skips the rest. The `%` operator gives remainders.) Run it and verify the output line by line: 1, 2, fizz, 4, buzz, fizz, 7, 8, fizz, buzz, 11, fizz, 13, 14, fizzbuzz, 16, 17, fizz, 19, buzz. If any line is wrong, trace your conditions by hand before changing code.

2. **Break the guessing game, then fix it.** Run the guessing game and type something that isn't a number — watch it crash with a `ValueError`. Read the error message carefully: it tells you the exact line and what went wrong. Now improve the program: wrap the input in a check that prints "That's not a number — try again." and asks again without counting the try. (Hint: `guess_text.isdigit()` tells you whether a string looks like a whole number; only call `int()` when it does.) This is your first encounter with *defensive programming*: never trust input.

3. **A function with a contract.** Write a function `is_prime(n)` that returns `True` if `n` is a prime number and `False` otherwise. (Hint: a number greater than 1 is prime if no integer from 2 up to its square root divides it evenly; `n % d == 0` tests divisibility, and `int(n ** 0.5)` gives the square root rounded down.) Then write a loop that prints all primes below 50 using your function: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47. Verify against that list. You just built a reusable mathematical tool — that's what functions are for.
