# `plan/` - the task ledger

Every piece of work in this repo gets a markdown file in here **before** the work starts.

This exists because of one specific, repeated failure: something gets asked for, something gets
built, and then nobody can tell whether it was actually finished, whether it was tested, or which
part of it silently got dropped. A chat scrollback is not a record. A file in the repo is.

---

## Where a doc goes

```
plan/<app>/<module>/<slug>.md
```

| Segment | Values |
|---|---|
| `<app>` | `main`, `admin`, `packages`, `repo` (add one per new app) |
| `<module>` | the folder inside that app - `plan/main/examinations`, `plan/web/hero-images`, ... |
| `<slug>` | short kebab-case name of the job - `marks-grid-responsiveness.md` |

Use `repo/` for anything that is not one app: tooling, CI, deployment, conventions.

If a job genuinely spans several modules, put the doc in the module that owns the **outcome** and
link the others from it. Do not write the same doc twice - a duplicated plan is how two half-done
versions of one job appear.

If the module folder does not exist yet, create it. The folder list mirrors the app's real route
structure, so if the app grew a module, the plan tree should grow one too.

---

## The rules

1. **A doc is written before the work, not after.** Writing it after is a changelog, and a changelog
   cannot be used to check whether anything was missed.
2. **Check `plan/` first, every time.** If a doc already covers this - the same feature, or a bug in
   something already planned - **append to that doc**; do not open a new one. New docs are for new
   jobs only.
3. **A task is `[x]` only when its Verified line is filled in with what was actually run and what it
   actually printed.** "Looks right" is not verification. An unverified task stays `[ ]` and says why.
4. **Nothing gets silently dropped.** If a task turns out to be wrong, blocked or out of scope, it
   stays in the list and is marked `[-]` with the reason. Deleting a task hides the decision.
5. **Update the doc as you go, not at the end.** A doc that only ever gets written once, at the
   finish, is the same as no doc.
6. `INDEX.md` gets one row per doc. Keep it current - it is the only place that answers "what is
   open right now" across every app.

## When a doc is NOT needed

Only these:

- The request explicitly says **"no plan"** / **"don't create a plan"**.
- It is a pure question - "what does this function do", "which file handles X". Nothing changes.
- It is a follow-up on a doc that already exists. That is a note appended to that doc, per rule 2.

Everything else gets a doc, including small things. Small things are exactly what goes missing.

---

## Status vocabulary

Used in the doc header and in `INDEX.md`. One of:

| Status | Means |
|---|---|
| `Planned` | Written down, not started. |
| `In progress` | Some tasks done, doc is being updated as it goes. |
| `Blocked` | Cannot proceed. The blocker is named in the doc. |
| `Done` | Every task is `[x]` or `[-]`, and every `[x]` has a filled Verified line. |
| `Superseded` | Replaced by another doc. Links to it. |

Task marks inside a doc:

- `[ ]` not done
- `[x]` done **and** verified (Verified line filled)
- `[-]` dropped or out of scope, with the reason on the line

---

## Starting a doc

Copy `plan/TEMPLATE.md`, fill the header, add the row to `INDEX.md`.
