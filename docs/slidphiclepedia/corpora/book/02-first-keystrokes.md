# Chapter 2: First Keystrokes

In chapter 1 you met the universal machine. Now you get to drive it.

There are two ways to talk to a computer. The first is the one you know: pointing, clicking, dragging — the **graphical user interface**, or GUI. The second is older, stranger, and far more powerful: *typing*. You type a sentence, the machine reads it, and it does exactly what the sentence says. No menus to hunt through, no buttons hiding what you want. Just language.

This chapter teaches you to type to your machine. It is the single highest-leverage skill in this book, and by the end of it you will have touched every major idea a professional programmer uses daily.

## The operating system: the machine's manager

Before the typing, one definition — the most important program on your computer, and the only one you'll never replace.

The **operating system (OS)** is the program that manages the machine's resources: it decides which programs get CPU time, which get memory, who may read which files, and how the hardware's raw pieces get shared among competing programs. Windows, macOS, and Linux are all operating systems. Your phone runs one too (iOS, Android).

At the heart of every OS is the **kernel**: the core program that runs with total authority over the hardware. When your music player asks to read a file, it doesn't touch the disk itself — it asks the kernel, and the kernel does it, because only the kernel is trusted with the hardware. This division — kernel with full power, programs with limited power, talking through requests — is the entire security architecture of modern computing in one sentence. A virus is, at bottom, a program trying to trick the kernel into granting power it shouldn't have.

You will issue your first commands to the shell, which is a program that talks to the kernel on your behalf. But the shell needs an address system for the machine's data first. That address system is the filesystem.

## Files and folders: a tree of everything

Every piece of data on your computer — every photo, program, and document — lives in a **file**: a named collection of bytes on storage. Files live inside **folders** (also called **directories**; the terms are interchangeable), and folders can live inside other folders, forming a **tree**.

Picture it:

```
/home/corey/
├── documents/
│   ├── novel.txt
│   └── budget.csv
├── photos/
│   └── birthday.jpg
└── code/
    └── hello.py
```

**Define before using:** a *tree* in computing means a hierarchy with one root and branches that never loop back. At the very top is the **root**, written `/`. Everything hangs below it. `/home/corey/documents/novel.txt` is a **path**: directions from the root down to the file, each folder separated by `/`. Reading a path left to right is like reading a postal address from country to street.

Two special folders worth memorizing: your **home folder** (`/home/yourname` on Linux, `/Users/yourname` on macOS, `C:\Users\yourname` on Windows) is where your personal files live — it's your private plot of the tree. And the **current directory** is wherever you happen to be standing right now; many commands act on it by default, which is exactly why precision matters later.

The tree is the same on every operating system. Different roots, different folder names, identical idea. This is our second lesson in "few deep ideas, repeated at scale."

## The terminal: a conversation in text

The **terminal** is a program that shows you a text window into the machine. Inside it runs a **shell**: a program that reads lines you type, interprets them as commands, runs them, and prints the results. (Bash, zsh, and PowerShell are all shells.) The shell is the oldest interface computers have, and still the most precise one — because natural language is ambiguous, but a command line says *exactly one thing*.

Why does typing beat clicking? Three reasons, each compounding:

1. **Precision.** A click means "do the thing under the cursor." A command says `rename every file ending in .txt to end in .md` — a sentence no button could ever express.
2. **Repeatability.** Commands can be saved into a **script** — a text file of commands the shell runs in order. Clicks can't be saved. Anything you type twice, you can automate forever.
3. **Composability.** Commands can be chained: take the *output* of one as the *input* of the next. Each command is a small tool; the shell is a workbench where tools snap together into machines of arbitrary power. (We'll do this for real in later chapters.)

Professionals live in the terminal not out of nostalgia but because it's the highest-bandwidth interface to the machine ever built: your thoughts, in text, executed in milliseconds.

## Your first commands

Open a terminal now. (Windows: search "Terminal" or "PowerShell". macOS: search "Terminal". Linux: you know where it is.) You'll see a **prompt** — something like `corey@laptop:~$` — the machine saying *I'm listening*.

Type these exactly. Press Enter after each. The `$` below is the prompt; don't type it.

```bash
$ pwd
/home/corey
```

**`pwd`** — *print working directory*. It answers: *where am I standing in the tree?* The machine replies with your current path. This is the command you run whenever you're lost. Get in the habit: *pwd first, always.*

```bash
$ ls
documents  photos  code
```

**`ls`** — *list*. It shows what's in the current directory. No path given, so it lists where you're standing.

```bash
$ cd documents
$ pwd
/home/corey/documents
$ ls
novel.txt  budget.csv
```

**`cd`** — *change directory*. It moves you. `cd documents` steps into the folder; `cd ..` steps back up one level (`..` always means "the parent folder"); `cd` alone returns you home. Note the rhythm: `cd`, then `pwd` to confirm, then `ls` to look around. That three-step is the explorer's gait — you'll do it ten thousand times.

Now make something:

```bash
$ cd
$ mkdir lab
$ ls
documents  photos  code  lab
```

**`mkdir`** — *make directory*. You just created a folder called `lab` in your home directory. It didn't exist a second ago; now it does, permanently, on storage. You have already altered the machine's state with four keystrokes. This is what "commanding the machine" feels like. Get used to it.

```bash
$ echo "hello, machine"
hello, machine
```

**`echo`** — it prints its arguments back. Trivial? Watch: `echo` is how programs *speak*. And combined with `>` (redirect output into a file), it becomes creation:

```bash
$ echo "my first file" > lab/note.txt
$ cat lab/note.txt
my first file
```

**`cat`** — *concatenate*, though everyone uses it to mean *print this file's contents*. `cat` reads the file and shows you what's inside. Between `mkdir`, `echo >`, and `cat`, you can now create folders, write files, and read them back. That is — no exaggeration — the daily core of a programmer's craft.

One more, because you'll need it constantly:

```bash
$ cd lab
$ pwd
/home/corey/lab
```

Filenames with spaces work but make life harder; professionals use dashes or underscores (`my-notes.txt`, not `my notes.txt`). This is a convention, not a law — but conventions that save you keystrokes thousands of times are worth adopting early.

## Typing with intent: precision as a discipline

Here is the discipline that separates people who command machines from people who fight them: **the machine does exactly what you say. So say exactly what you mean.**

The shell does not guess. `cd documnets` doesn't take you to `documents` with a sympathetic smile — it fails, because `documnets` doesn't exist. This feels hostile until you realize it's a feature: *predictability*. A machine that guesses is a machine you can't trust. The shell's refusal to guess is what makes scripts reliable, what makes automation possible, what lets a command you wrote three years ago still do exactly the same thing today.

Precision has two practices:

1. **Read before you run.** Read the command aloud. `rm -rf old-backup` — do I mean *that* folder? Am I *in* the right directory (`pwd`)? The five seconds of reading replace hours of recovery.
2. **Verify after you run.** `ls` after `mkdir`. `cat` after `echo >`. `pwd` after `cd`. Trust, but check — the machine is happy to show its work.

This is not paranoia; it's the scientific method applied to typing. Hypothesis (this command does X), experiment (run it), observation (check the result). Every professional works this way. Beginners who skip the checking step are the ones who learn the hard lesson — which brings us to the honest warning.

## The honest warning about `rm -rf`

**`rm`** deletes files. **`rm -rf`** deletes folders and everything inside them, recursively (`-r`) and without asking (`-f`, *force*). There is no trash can, no undo, no "are you sure." It is the correct tool for deleting a folder you genuinely want gone — and it will delete a folder you genuinely wanted to keep with exactly the same cheerful efficiency, the moment you point it at the wrong path.

One vivid sentence, as promised: `rm -rf /` pointed at the root would erase the entire machine, and the only thing standing between you and that sentence is typing the path correctly.

So the rule is simple and absolute: **never run `rm -rf` on a path you haven't verified with `pwd` and `ls` first, and never run a deletion command you copied from the internet without reading every character.** This isn't fear — it's respect for a tool that does exactly what you say. The machine keeps its promises. Make sure you mean them.

## What you've earned

Count what you can now do: navigate any computer's filesystem (`pwd`, `ls`, `cd`), create structure (`mkdir`), write data (`echo >`), read it back (`cat`), and — most importantly — think in the discipline the machine rewards: say exactly what you mean, then verify.

In chapter 1 the machine was a marvel you owned. Now it's a marvel that *listens*. Next, we go deeper than the shell — beneath files and folders, beneath programs entirely — to the atoms everything is made of: bits, and the strange, beautiful algebra that turns two symbols into certainty.

## Build it

1. **Map your own tree.** In the terminal, start at home (`cd`), then explore three levels down using only `pwd`, `ls`, and `cd`. Draw the part you explored on paper as a tree, with the root at top. Mark where you are right now with an X. Then get back home with a single command — and prove it with `pwd`.
2. **Leave a trail.** Create a folder called `first-lab` in your home directory. Inside it, create three text files using only `echo` and `>` — a file with your name, a file with today's date, and a file with one sentence about what you want to build by the end of this book. Read all three back with `cat`. Then list the folder with `ls` to confirm the world matches your intention.
3. **Break it safely, then fix it.** Inside `first-lab`, create a folder called `scratch`, put a file in it, then delete the whole `scratch` folder with `rm -r` (no `-f` — let it ask you questions; watch what it asks and why). Verify with `ls` that it's gone and everything else survived. Write down, in one sentence, the rule you'll follow before ever typing `-f`.
