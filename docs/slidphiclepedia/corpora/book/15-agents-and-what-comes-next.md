# Chapter 15: Agents and What Comes Next

Chapter 14 ended with a question: what happens when you bolt goals and actions onto the machinery of prediction? This chapter answers it — and then this book ends, because there is nothing left to teach you that building won't teach you better.

## The loop: perceive, decide, act

An **agent** is software that **perceives** its environment, **decides** what to do, and **acts** — in a loop, toward a goal. Three verbs, one loop. Everything else is scaffolding.

Distinguish this carefully from a chatbot, because the industry will try to blur it. A **chatbot** maps text to text: input in, output out, one shot, no consequences. An **agent** takes actions that *change the world* — files edited, orders placed, messages sent, machines provisioned — then **observes the results** and adjusts. The chatbot's output ends the interaction; the agent's output begins the next iteration. The loop is the thing.

The simplest agent ever built is the **thermostat**: it perceives (reads the temperature), decides (too cold?), acts (heater on), and loops — forever, toward the goal of 21 degrees. Now scale the verbs up. A coding agent perceives (reads your code, runs your tests), decides (what to change), acts (edits files), and loops until the tests pass. A trading agent perceives prices, decides positions, acts by placing orders, and loops until the market closes or the money runs out. Thermostat to trading bot: same shape, different stakes.

Here is that shape, in code. It is pseudocode — the function names are yours to fill in — but treat it as load-bearing, because every agent you ever build or meet will be this loop wearing a costume:

```python
while not goal_reached(state):
    observation = perceive(state)      # read the world
    action = decide(observation, goal)  # choose what to do
    state = act(action)                 # change the world, observe the result
```

Three lines inside a loop. The thermostat's `decide` is an if-statement; the coding agent's `decide` might be a hundred-billion-parameter model from Chapter 14. The loop doesn't care. What matters is that the agent's actions have *effects* and its perceptions *register* them — that is what makes it an agent rather than a very talkative function.

Watch the thermostat run, because the numbers make it concrete. Goal: 21°C. Perceive: 19.4°C. Decide: below goal, heater on. Act: relay closes. Loop. Perceive: 20.8°C. Decide: still below, stay on. Loop. Perceive: 21.2°C. Decide: above goal, heater off. That is agency in miniature — no intelligence required, just the loop. Now the coding agent, one rung up: perceive — the test suite reports three failures; decide — the stack trace points at the parser; act — edit the parser, rerun the tests; perceive — one failure left; decide, act; perceive — all green; goal reached; stop. Notice the beat the chatbot lacks: the agent was *wrong* in the middle and *found out*. The world pushed back, and the loop absorbed it. Act, observe, adjust — that feedback is the entire difference between performing competence and having it.

## Who acts, and what they're allowed to do

The moment software starts *doing* things, two ideas become load-bearing that a chatbot never needed. Define both, because confusing them causes real incidents.

**Identity** is *who acts*: which agent is this, and on whose behalf does it operate? When your agent sends an email, the recipient needs to know it came from your agent, not from you directly — and your systems need to know which of your three agents did it.

**Authorization** — or **permission** — is *what it's allowed to do*: read your calendar, yes; delete your files, no; spend up to ten dollars, yes; spend a thousand, absolutely not.

Both must be explicit, and here is why: a chatbot's worst failure is a wrong sentence. An agent's worst failure is a wrong *action* — money moved, data deleted, an email sent to your boss that you cannot unsend. You can apologize for a sentence. You cannot apologize a wire transfer back into existence. When software touches the real world, "who" and "may it" are not paperwork; they are the guardrails between a useful tool and an incident.

Make it concrete. You build an inbox agent. Its identity: your assistant, acting on your behalf — every message it drafts is labeled agent-drafted, so no human mistakes it for you. Its permissions, written down *before* it ever runs: read inbox, yes; draft replies, yes; send replies, no — drafts wait for your approval; delete anything, no; spend money, $0. Now the failure modes are bounded by construction: the worst bug in the agent cannot send an email, because "send" was never granted. Contrast the alternative — one big permission called "manage my email" — and you've felt, in your gut, why least privilege isn't bureaucracy. It's the difference between a bug and a catastrophe.

The crisp statement of the principle is the **principle of least privilege**: every agent gets the *minimum* capability it needs to do its job, and nothing more. The agent that reads your calendar should not be able to delete your files. The agent that drafts emails should not be able to send them — drafting and sending are *different permissions*, and the distance between them is the distance between a suggestion and a commitment.

Enforce permissions at the **point of action**, not inside the agent's head — because the agent's head is the part you don't fully control. Chapter 14 taught you why: a next-token predictor has no native notion of "should." So the check lives in *your* code, wrapped around the dangerous operation:

```python
class PermissionDenied(Exception):
    pass

def send_email(draft, *, agent, policy):
    if not policy.may_send(agent):          # the check, at the point of action
        raise PermissionDenied(f"{agent.name} may draft, not send")
    return mail_server.send(draft)
```

And give every agent a **budget** — actions, money, time — past which it stops, no matter what it believes:

```python
MAX_ACTIONS = 10   # the agent stops here, even mid-plan
```

Budgets are least privilege quantified. An agent that can act ten times can cause one-tenth the damage of an agent that can act a hundred times, and it forces the most valuable engineering discipline in the field: making each action count.

## What comes next

Agents are about to do something no previous software did at scale: talk to *each other*. Your agent will negotiate with a vendor's agent, book with an airline's agent, haggle over compute with a marketplace of machine-agents. The moment two agents transact, the questions from the last section get harder: how does your agent *prove* who it is to a stranger's server? How does that server check what your agent may spend — not its word, but something verifiable? Identity and permission stop being features of your program and become *infrastructure*: signed identities, spend mandates, receipts. The web needed HTTPS before anyone would type a credit card into it; the agent economy will need its own trust layer before anyone lets agents spend freely in it.

The honest list of what's unsolved: agents that reliably know their limits (Chapter 14's calibration problem, now with a credit card attached); permission systems ordinary people can actually configure instead of experts; the economic question of who pays per action and how; and the security question of what happens when someone else's agent lies to yours. These are open problems, which is another way of saying *openings*. The trust layer for agents is roughly where the web was in 1994: the protocols aren't settled, the winners aren't chosen, and the field is taking builders.

## The builder's ethos

This is the moral core of the book, and it is short enough to fit on an index card. Four lines:

**Ship working things.** Every chapter ended with "build it" because reading about building isn't building. The web chapter's ugly deployed page beats the beautiful localhost architecture. The ML chapter's thousand downhill steps beat the elegant theory of optimization. Working means: it runs, it survives contact with reality, a stranger could use it.

**Verify against reality.** Tests: does it do what you claim? Measurements: how fast, how much, how often? Production URLs: does it work for someone who isn't you, on a machine that isn't yours? Not vibes. Vibes are how demos pass and products fail.

**Prove it or it didn't happen.** A claim without a reproducible demonstration is a rumor. And *reproducible* has a crisp definition: someone else, following your steps, gets your result. Your benchmark, your "it works," your "the model learned" — each is either reproducible or it is storytelling. The field is full of demos that worked once, on the presenter's machine, with the wifi gods smiling. Be the person whose things work twice.

An example from two chapters ago: the line-fitter's loss landed at 0.0122 against an exact answer of 0.0120, and you got the code to reproduce it. If I had written "it converges beautifully" without the number, that would have been a rumor. The number is what makes it a fact you can check — and checking it is a fifteen-second run. Apply that standard everywhere and watch how much fog burns off.

**Check it against the world.** This is the one sentence the whole book has been repeating in different costumes. Chapter 11: measure the network, don't assume it. Chapter 12: the database either persisted or it didn't — check. Chapter 13: ship it and watch strangers use it. Chapter 14: the loss either went down or it didn't — the number does not care about your intentions. The ethos is not a mood; it is a procedure. Run it on everything, especially your own best ideas.

Notice what this ethos does to hype: it dissolves it. Not by cynicism — cynicism is just hype with a frown — but by *measurement*. "Our model understands" becomes "show me the falsifiable test." "Our agent is autonomous" becomes "show me the permission boundary and the budget." The person who verifies is never the sucker in the room.

## Build it

1. **Build a real agent — thirty lines.** Write the loop from this chapter around a `tasks.txt` file, one task per line. Perceive: read the file. Decide: pick the first line not marked done. Act: print what you're doing, then rewrite the file with that line marked `[done]`. Stop when every line is marked. Run it. You have built a genuine agent: it perceives, decides, acts, loops toward a goal, and terminates. The thermostat would be proud.
2. **Give it least privilege.** Add `MAX_ACTIONS = 5`: the loop must stop after five actions even with tasks remaining — the budget, enforced in the loop condition, not in the agent's "judgment." Add a `DRY_RUN = True` flag: when true, the agent may print its plan but must not rewrite the file. Two permissions, both enforced at the point of action. Now break it on purpose: try to make the agent exceed its budget by wishing harder in a comment. It can't. That's the point.
3. **Prove one thing.** Take one claim you've made about any program — yours or anyone's: "it handles bad input," "it's fast enough," "the agent always stops." Write the single test or measurement that would falsify it. Run it. Write down the result — especially if it embarrassed you. That embarrassment is the tuition; the habit is the degree.

## The send-off

You started at keystrokes. Literally: what happens, electrically and logically, when a finger meets a key. Then the long climb — how machines represent everything as numbers, how they follow instructions, how they remember, how they talk to each other across oceans, how they learn by walking downhill, and now how they act in loops toward goals.

Look at what you can build from here. A *world* is just a system with rules that other people can enter: a website, a game, a tool, a marketplace, an agent that does useful work while you sleep. You have every piece. The languages, the protocols, the data structures, the math of learning, the loop of agency, and — most importantly — the habit: define the terms, show the mechanism, measure the claim, ship the thing.

The field is wide open. That is not encouragement; it is a demographic fact. Most of what will exist in twenty years — the services, the agents, the worlds — has not been built yet, and the people who will build it are, right now, roughly where you are: holding the tools, deciding what deserves to exist. The tools are in your hands. A laptop, an internet connection, and everything in these fifteen chapters are sufficient to build things that matter. The incumbents have more money; you have the advantage of not yet knowing what's "impossible," which is historically where the good stuff comes from.

And one last build — not an exercise, a beginning: build something — small, working, yours — and show it to someone. A page. A tool. An agent with a budget and a permission boundary. Put it where a stranger can touch it. Watch what they do with it. Then build the next thing.

The next chapter is yours to write. Go write it well.
