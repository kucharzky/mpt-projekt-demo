# SmartUniPlanner

Domain vocabulary for the student calendar, task planner and project collaboration. Current persistent behavior is recorded in ADR-0009; older ADRs retain the prototype decisions for context.

## Calendar and availability

**Calendar event**: A timed block representing a USOS class, custom activity, task session, recovery break or confirmed team meeting.
_Avoid_: booking, appointment when referring to every event category.

**Hard-locked event**: An event the planner cannot move: a USOS class, permanent activity or confirmed team meeting.
_Avoid_: immutable event, because a source update or explicit user action can still change it.

**Permanent activity**: A custom commitment whose time the planner must preserve.
_Avoid_: pinned activity; pinning refers to task sessions.

**Soft event**: A custom activity whose future occurrence may move to make room for deadline work. An occurrence that has already started stays in place.
_Avoid_: disposable event; a move must preserve the occurrence.

**Activity recurrence**: The pattern defining one-time, weekly, biweekly or monthly occurrences, starting at the chosen anchor date. Monthly recurrence uses the last day of shorter months when needed.

**Occurrence**: One dated instance of an activity series. Its individual title or time can differ from the series, and it can be cancelled separately.

**Series edit scope**: The distinction between changing one occurrence and changing the whole activity series. A whole-series edit replaces its pattern and clears individual exceptions.

**USOS import**: A previewed import of classes from an ICS file, with bounded recurrence expansion and stable occurrence identity. Re-import updates matching occurrences; replacing missing classes in a range requires an explicit choice.

**Free slot**: An interval within configured working hours with no hard-locked event, at least 30 minutes long. It describes time without fixed commitments; soft events and planned work can still occupy it.
_Avoid_: shared availability, which also accounts for movable commitments.

**Shared availability**: Common free intervals of team members who opted in, accounting for all their occupied sessions and activities. It reveals times, never private event titles; missed sessions do not occupy it.

**Transition buffer**: A configurable protected gap the planner preserves between work and neighboring commitments. It is not a separate event.
_Avoid_: recovery break.

**Recovery break**: A configurable visible rest interval after every second same-task session on the same day. It is omitted when it cannot fit that day.

**Scheduling horizon**: The interval from now through the end of the relevant deadline dates, in the user's timezone, across all affected weeks.
_Avoid_: visible week; the displayed week does not limit placement.

## Tasks and effort

**Standard task**: A small piece of work that can fit in a single session. It uses the same deadline and placement rules as a larger task.

**Large iterative task**: Work with a total required effort split into shorter sessions before its deadline.
_Avoid_: weekly task budget, unless the task itself repeats weekly.

**Required effort / hours required**: The estimated total work needed to finish one task before its deadline, across the full scheduling horizon.
_Avoid_: total weekly hours.

**Task session / task chunk**: One calendar block assigned to a task. It can be planned, explicitly completed or marked missed.
_Avoid_: automatically completed block; elapsed time is not proof of completion.

**Pinned session**: A planned task session whose time the planner preserves. Marking it missed releases its reserved capacity.

**Completed session / session done**: Work explicitly confirmed as performed; its duration counts toward task progress.

**Missed session**: Work not performed in its planned slot. Its duration remains to be planned and does not count toward progress or occupied capacity.

**Task budget reconciliation**: Comparing completed and planned work with required effort. A shortfall remains visible; extra work can raise the estimate to the next half-hour without implying completion.

**Deadline date**: The last calendar day for the task, with no time-of-day component. It is the primary source of urgency.
_Avoid_: due timestamp.

**Task status**: TODO, IN_PROGRESS or DONE. Completing a task keeps its history and clears future planned work; completed session effort can also finish the task.

**Recurring task**: A task that creates one next occurrence when completed, with a deadline advanced by its recurrence interval.

## Planning decisions

**Priority score**: Days remaining to the deadline; fewer days means greater urgency. Explicit ordering and importance resolve equal deadlines.
_Avoid_: importance when referring to urgency alone.

**Dynamic preemption**: Replacing movable future work with a new deadline-ordered layout. Hard-locked events, completed work, pinned sessions and already-started commitments remain protected.

**Placement proposal**: A complete suggested layout of sessions, recovery breaks and soft-event moves awaiting acceptance. The two strategies favor earliest slots or a balanced spread across days.
_Avoid_: saved schedule before acceptance.

**Partial placement**: A proposal that places the work that fits and states the remaining effort that cannot fit before the deadline.
_Avoid_: silent truncation.

**Same-date deadline conflict**: Two or more active tasks sharing a deadline and competing for time. The user can order them or choose alternating allocation.

**Tie-breaker order**: The user's ordering of tasks with the same deadline.

**Allocation mode**: Sequential completion of competing task budgets, or an even split that alternates sessions among them.

**Conflict-resolution UI**: The controls for ordering same-deadline tasks and choosing their allocation before accepting a proposal.

**Planner revision**: The version of a user's planning state against which a proposal was prepared. A changed revision makes an old proposal unsafe to accept or undo.

## Collaboration and recovery

**Team**: A group sharing projects, with an owner, administrators and members. Private calendars remain individually owned.

**Project task**: A task visible to project members, with one responsible person. That person plans its work in their own calendar.

**Team meeting**: A proposed shared event that blocks no calendar until all participants accept the current availability. After confirmation it is hard-locked.

**Assignment proposal**: A suggested distribution of project tasks across opted-in members, considering remaining effort, deadlines and available capacity. Each responsible person can then plan their sessions.

**Trash**: Recoverable removal of tasks, sessions, activities or cancelled occurrences. Restoring an occurrence preserves its earlier individual title and time.
