# Chapter 14: Intelligence, Artificial

The phrase "artificial intelligence" arrives carrying a fog of marketing, movies, and metaphysics. Let's clear it, the way this book clears everything: define the terms, show the mechanism, quantify the claims. Underneath the fog there is a genuinely beautiful idea — a machine that improves itself by walking downhill — and it is *not* magic. That's what makes it powerful. Magic can't be debugged.

## A function with knobs

Four definitions. Everything in machine learning is built from these.

A **model** is a function with knobs: it takes an input, produces an output, and has adjustable numbers inside that change what it computes. Our running example: the model is a line, `y = m·x + b`. Input `x`, output a prediction of `y`.

The **parameters** are the knobs — the numbers the model stores. Here: `m` (slope) and `b` (intercept). A model with two parameters is a toy; the models in the news have hundreds of billions. But the *idea* of a parameter never changes: it's a number the machine is allowed to adjust.

The **training data** is a collection of examples of right answers: input/output pairs the model should have gotten right. Ours:

```python
points = [(1, 2.1), (2, 4.0), (3, 5.9), (4, 8.2)]
```

Four points, hovering near the line `y = 2x`. The machine's job: find `m` and `b` that fit them.

The **loss** is a single number measuring wrongness. Lower is better; zero is perfect. The classic choice for fitting numbers is the **mean squared error**: for each point, take the model's error, square it, and average:

```python
loss = sum(((m * x + b) - y) ** 2 for x, y in points) / len(points)
```

Why square the error instead of just taking its size? Two reasons, both load-bearing. First, squaring punishes big misses disproportionately — being off by 2 costs four times being off by 1, which matches how wrongness usually feels. Second, the squared error is *smooth*: it has no kinks, so calculus can get a grip on it. That smoothness is what makes the next section possible.

Note the philosophical move hidden in the loss function: "learn the right line" — a vague wish — has been converted into "minimize this number" — a precise task. All of machine learning is this move, repeated at scale. **Learning is optimization**: turn "be good" into a number, then make the number go down.

## Learning is walking downhill

Picture the loss as a landscape over the `(m, b)` plane: at each choice of knobs, the ground's height is the wrongness. For fitting a line, this landscape is a smooth bowl — one lowest point, no traps. (For neural networks it is a rugged mountain range, and much of the field's craft is about not getting stuck. Mark that as a real complication, not today's problem.)

**Gradient descent** is the algorithm that walks the landscape downhill:

1. Stand at the current `(m, b)`.
2. Compute the **gradient**: the direction in which the loss increases *most steeply*. This is just derivatives — calculus, applied mechanically.
3. Take a small step in the *opposite* direction.
4. Repeat.

The step size is called the **learning rate**, and it is the algorithm's one great temperament setting. Too small, and you crawl — ten thousand steps to cross the bowl. Too large, and you overshoot the bottom, land higher on the far slope, oscillate wider each time, and explode. (You will watch this happen in the exercises. It is spectacular.)

Here it is, complete, in about fifteen lines. Read it slowly — this is the most important program in the chapter:

```python
points = [(1, 2.1), (2, 4.0), (3, 5.9), (4, 8.2)]  # (x, y) examples

m, b = 0.0, 0.0          # the knobs, starting at zero: we know nothing
lr = 0.01                # learning rate: how big each downhill step is
n = len(points)

for step in range(1000):
    # gradient of the mean squared error with respect to each knob
    dm = sum(2 * ((m * x + b) - y) * x for x, y in points) / n
    db = sum(2 * ((m * x + b) - y)     for x, y in points) / n
    m -= lr * dm           # step downhill
    b -= lr * db

loss = sum(((m * x + b) - y) ** 2 for x, y in points) / n
print(f"m = {m:.4f}, b = {b:.4f}, loss = {loss:.6f}")
```

Run it. The output:

```
m = 2.0096, b = 0.0307, loss = 0.012157
```

Now, the honest comparison: the exact least-squares answer — computable with pencil, statistics, and patience — is `m = 2.02, b = 0.00`, with loss `0.0120`. Our machine, starting from total ignorance and taking a thousand dumb downhill steps, landed at `m ≈ 2.01, b ≈ 0.03` — within a whisker of optimal, and it derived nothing. It *walked* there.

State the falsifier, because this book always does: if the loss had *not* decreased — if it bounced around or exploded — the claim "this learns" would be wrong, and the bug would be real. That failure mode exists and has a name: divergence. The gradient is a local guide; follow it too eagerly and you fly off the landscape entirely.

## Neurons: dumb parts, smart piles

A **neuron** — the atom of neural networks — does exactly three things, and you should insist on seeing all three whenever anyone waves the word around. It takes numbers `x₁ … xₙ`; it computes a **weighted sum**, `w₁·x₁ + … + wₙ·xₙ + b` (each input gets its own knob `wᵢ`, plus one shared knob `b`); and then it passes the result through a **nonlinearity** — a fixed squashing function like `max(0, z)`, which keeps positives and zeroes negatives, or a smooth S-shaped curve. Multiply, add, squash. That is the whole neuron. Frank Rosenblatt's **perceptron** (1958) — the seed the entire field grew from — was essentially this, plus a learning rule.

A **neural network** stacks neurons in **layers**: the outputs of one layer become the inputs of the next. "Deep learning" just means many layers. Why layers, and why the nonlinearity? Here is the one-sentence proof sketch that justifies the entire architecture: *without* the nonlinearity, every layer is just a linear map, and a composition of linear maps is still a single linear map — `(Ax + b)` followed by `(Cx + d)` is just `(Ex + f)` with different letters — so a hundred linear layers would be no more expressive than one neuron, and lines cannot fit curves. The nonlinearity is what buys expressive power; depth is what buys *efficiency* — there are genuine theorems (depth-separation results) showing that deep networks can represent certain functions with exponentially fewer neurons than shallow ones. Intuition only beyond this sentence; the full statements need a semester.

One more canonical result, stated honestly: the **universal approximation theorem** (Cybenko, 1989) says a network with one hidden layer and *enough* neurons can approximate any continuous function on a bounded region, as closely as you like. The weasel word is "enough" — it can mean absurdly, impractically many. The theorem says expressive power is never the problem; *finding* the right knobs — optimization, data, compute — is.

## Backpropagation, honestly

If gradient descent is walking downhill, **backpropagation** is how a network with millions of knobs figures out which way is downhill for *each* knob. Named honestly: Rumelhart, Hinton & Williams, 1986.

Proof sketch — and I am marking it as a sketch, because the full derivation is a chapter of its own (any deep learning textbook, e.g. Goodfellow, Bengio & Courville, 2016, will give it to you straight): backpropagation is the **chain rule from calculus, applied at scale**. The loss depends on the network's output; the output depends on the last layer's knobs; the last layer's inputs depend on the layer before it. So the blame flows *backward*: each layer computes how much each of its knobs contributed to the error, adjusts them, and passes the remaining blame back to the layer behind it. That is the entire idea — credit assignment by chain rule, mechanized.

The practical footnote that changed the world: modern frameworks (PyTorch, JAX) **automate** the chain rule. You write the forward computation — the model — and the software derives the backward pass for you, exactly. This turned "implement backprop by hand" (a rite of passage, and a rich source of bugs) into "describe the function, get the gradients free." A staggering amount of modern AI progress is downstream of this one piece of infrastructure.

## Hype removal

Required section. Read it twice.

**What large language models actually do:** they predict the next token. A **token** is a chunk of text — roughly a word piece. Training feeds the model most of the public internet and adjusts its hundreds of billions of knobs until, given the tokens so far, its predicted next token matches the actual next token. At use time, it predicts a token, appends it, predicts the next, appends it — sampling one token at a time, thousands of times per answer. That is the whole trick, all the way down: *next-token prediction*. The fluency is real, the capabilities are real, and the mechanism never changes. A model writing a sonnet, a proof, or a recipe is doing the same thing in each case: guessing what comes next, extremely well.

**What they don't do:** they don't *understand* the way people do — and since "understand" is doing heavy lifting in that sentence, here are my terms. By understanding I mean at least three things: (1) a causal model of the world you can run counterfactuals on — "what if I hadn't done that?"; (2) grounding in consequences — the ability to act, observe the result, and be wrong in a way that *costs* you something; (3) knowing what you don't know. A language model has none of these structurally: no body, no persistent goals, no access to ground truth beyond correlations in text. So it can be brilliantly fluent about things that aren't true. **Hallucination is not a malfunction of the mechanism; it is the mechanism operating without grounding.** A next-token predictor has no notion of truth — only of plausibility.

What would prove me wrong? A model that reliably says "I don't know" exactly when it doesn't — calibrated uncertainty, not performed humility — or one that corrects its beliefs from real-world feedback without being retrained. Those would be evidence of something beyond prediction. (The philosophical half of this section is my position, stated as such; the mechanism half is settled fact.)

**Quantify honestly** — orders of magnitude, all approximate, all marked: frontier models carry **hundreds of billions of parameters**; training one costs on the order of **tens of millions of GPU-hours** and ingests **trillions of tokens** — a sizable fraction of the crawlable public web. Answering your question burns real compute too: roughly cents per long answer, order of magnitude. These numbers move every year; the shape doesn't: intelligence, artificial, is *expensive* in a way intelligence, biological, is not. Your brain runs on about 20 watts.

And the seed, because credit matters: **Rosenblatt's perceptron, 1958** — one neuron, one learning rule, enormous optimism. Then Minsky and Papert (1969) proved a perceptron couldn't even learn XOR — a two-bit function — and the field froze for a decade: the first AI winter. The lesson of that winter, and of every hype cycle since: the math was never magic. It was always optimization. We got better at the optimization, gathered more data, and threw *vastly* more compute at it. The current spring is the perceptron's spring, seventy years later, with better hardware.

## Close: machinery, not magic

So here is machine learning, defogged: a **model** (function with knobs), **parameters** (the knobs), **training data** (right answers), **loss** (wrongness as a number), and **gradient descent** (walking downhill), stacked into layers of multiply-add-squash and trained by the chain rule at planetary scale. Powerful machinery. Not magic — no understanding, no intent, no goals of its own. It minimizes the number you gave it, brilliantly and blindly.

Now the question that ends this chapter and opens the next: what happens when you bolt *goals* and *actions* onto this machinery? What happens when the program doesn't just predict — but *does*? That is where we're going. And it's where the stakes get real.

## Build it

1. **Watch learning fail.** Run the line-fitter, then change `lr` to `0.5` and run it again. Python raises `OverflowError` — the parameters blow past the largest representable number. Write down in one sentence *why*: each step overshoots the minimum, lands higher on the opposite slope, and oscillates wider every time. Then find the largest learning rate that still converges. You now understand hyperparameter tuning, which is half of applied ML.
2. **Feel the leverage of outliers.** Add a fifth point, `(5, 0.0)` — far off the line — and refit. Notice how one bad point drags the whole line toward itself: squared error gives outliers leverage. Now replace it with `(5, 10.1)`, which sits near the true line, and compare. Real datasets are full of `(5, 0.0)`s. Data cleaning is not janitorial work; it *is* the model.
3. **Fit a parabola.** Model `y = a·x² + b·x + c` — three knobs now — fit by the same gradient descent to the points `(1,1), (2,4), (3,9), (4,16)`. Use `lr = 0.01`, 2000 steps. Checkable prediction: you should land near `a ≈ 0.99, b ≈ 0.04, c ≈ −0.05` — within a few percent of the obvious truth `y = x²`. Notice what didn't change: the algorithm is identical. Only the model — the function with knobs — got richer. That separation, model versus optimizer, is the whole game.
