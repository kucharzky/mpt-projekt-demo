# Glossary

Domain vocabulary for the Student Smart Timetable & Auto-Scheduler MVP. Prefer these terms in issues, specs, and code names; avoid the synonyms marked as preferred-not.

## Calendar & events

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Hard-locked event** | A calendar event that the auto-scheduler must never move or overwrite. All imported USOS `.ics` events are hard-locked; custom activities may be hard-locked when `is_permanent = true`. | immutable event, locked block |
| **Permanent activity** | A custom extracurricular event with `is_permanent = true`. Treated identically to USOS classes by the scheduler. | fixed event, pinned event |
| **Soft event** | A custom activity with `is_permanent = false`. Visible on the calendar but does not carve free slots; may be shifted when a higher-priority deadline task needs the time. | flexible event, movable event |
| **Activity recurrence** | How a custom activity repeats: `ONE_TIME` (specific calendar date + time range), `WEEKLY` or `BIWEEKLY` (weekday + time range; biweekly anchored to the creation week, then every 14 days), or `MONTHLY` (same calendar date each month; clamp to last day when the month is shorter). | repeat rule, RRULE (for custom activities) |
| **Series edit scope** | When changing a recurring custom activity (manual edit/delete or after a soft-event move): apply to **this occurrence only** or the **entire series**. Manual **Edit** and **Delete** from Event details ask for scope **before** the form or destructive action (not only on save). Soft-move toasts still commit occurrence-only first, with optional “Apply to entire series.” | edit mode, split series |
| **Event edit / delete** | From Event details: change title/time or remove a **custom activity** (soft or permanent) or a **scheduled task session**. USOS classes and recovery breaks are read-only here. Manual edits do not enforce the transition buffer; overlapping a hard-locked event shows a warning but is allowed. | mutate event, remove block |
| **Task budget reconciliation** | After a session edit/delete, if placed session hours ≠ `hours_required`: **Propose** fill-in sessions for the shortfall (normal placement path) or **Reduce** `hours_required` to match placed hours (0 → parent **DONE**). If placed hours exceed required, silently raise `hours_required`. | hours adjust, backfill sessions |
| **USOS import** | Ingesting a standard `.ics` (iCalendar) file exported from USOS via drag-and-drop or file picker. Parsed `VEVENT` fields for the prototype: `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION` (and `DESCRIPTION` when present). Discrete instances only (`RRULE` out of scope). A new import or sample load **replaces** existing `USOS_ICS` events and leaves custom activities and scheduled sessions untouched. All resulting events are hard-locked. | calendar upload (when meaning USOS specifically) |
| **Calendar event** | A timed block on the calendar. Sources: `USOS_ICS`, `CUSTOM_ACTIVITY`, `SCHEDULED_TASK`, or `RECOVERY_BREAK`. Fields include `id`, `title`, `start`, `end`, `is_permanent`, and optional `parent_task_id`. | appointment, booking |
| **Transition buffer** | A 15-minute protected gap the auto-scheduler keeps between a newly placed session and any neighboring occupied block (USOS, activities, other sessions). Implemented by inflating busy time; not shown as its own calendar event; never used to move USOS. | reset gap, micro-break |
| **Recovery break** | A 1-hour protected, visible calendar block (`RECOVERY_BREAK`) inserted after every second same-task session **on the same calendar day**. Placed on that day only; omitted if a full hour does not fit (never spilled alone onto the next day). No extra transition buffer around it. Blocks later algorithm placements; rebuilt when sessions are rescheduled. | rest block, regenerate hour |
| **Weekly grid view** | The primary calendar UI: one Monday–Sunday page at a time, 07:00–22:00, 30-minute granularity, with prev/next controls to move across weeks. | week planner, timetable view |
| **Scheduling horizon** | The open interval from today through the task’s deadline date (inclusive of days before the deadline) across navigable weeks. Session placement and partial-placement capacity are computed over this horizon, not only the currently viewed week. | visible week only, current week pool |

## Free slots

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Free slot** | A contiguous window between 08:00 and 21:00 not occupied by hard-locked events (USOS or permanent activities), at least 30 minutes long. Soft events and scheduled task sessions do not shrink free slots. Shown when "Highlight Free Slots" is active as emerald overlays with duration labels; `+ Schedule Here` opens a chooser to add a task or a custom activity pinned to that gap. | gap, hole, empty block |

## Tasks

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Standard task** | A single-block task requiring one 1h session. On create, the auto-scheduler places that session using the same priority, preemption, and conflict rules as a large iterative task. | todo, action item |
| **Large iterative task** | A task with a required `hours_required` (total hours to spend before the deadline), split into sessions by the distribution algorithm. Also called a **chunked task**. | big task, multi-hour task, weekly_hours_required, total_weekly_hours |
| **Hours required** | Task field `hours_required`: total hours to place before the deadline along the scheduling horizon. UI label: “Hours to spend before deadline.” | weekly_hours_required, total_weekly_hours, hours this week |
| **Task chunk** / **session** | One scheduled calendar block derived from a standard or large iterative task. For large tasks, bounded by `min_session_length` (default 1h, max 2h per chunk). May be marked done manually or automatically when its end time has passed. | fragment, piece |
| **Deadline date** | Task due date as date-only (`YYYY-MM-DD`), no time component. Sole input to priority scoring. | due datetime, deadline timestamp |
| **Task status** | Lifecycle of a task: `TODO` \| `IN_PROGRESS` \| `DONE`. Marking the parent `DONE` keeps past sessions (struck through), clears future sessions and recoveries, and may prompt rescheduling other tasks into freed gaps. | state, stage |
| **Session done** | Whether a task session counts toward progress: manual override in event details, otherwise automatic when `end ≤ now`. Progress bar uses done hours / `hours_required`. | session complete, chunk done |

## Scheduling & priority

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Priority score** | `(deadline_date − current_date)` in days. Lower score = higher urgency. | urgency rank, importance |
| **Dynamic preemption** | When a new task has an earlier deadline than already-scheduled soft/scheduled work, the algorithm pushes lower-priority chunks (and soft events) to later free slots and places the urgent task in the earliest available slots. Hard-locked events are never moved. Soft-event moves commit on **this occurrence** immediately, with a non-blocking toast (Undo · Apply to entire series). Manual edits still prompt for series edit scope before save. | reschedule cascade, bumping |
| **Placement proposal** | One of exactly two candidate layouts offered for preview before confirm (for standard and large tasks): *Earliest Available Slots* or *Balanced Daily Spread*. | schedule option, layout suggestion |
| **Partial placement** | When required hours exceed remaining schedulable time before the deadline, the algorithm places what fits and warns with the unplaced remainder (e.g. “Scheduled 5 of 8 hours”). | failed schedule, blocked create |
| **Same-date deadline conflict** | Two or more active (non-DONE) tasks share an exact `deadline_date`. Always opens the conflict-resolution UI before commit. | deadline tie, date clash |
| **Tie-breaker order** | Explicit total ordering (`tie_breaker_order`) among same-deadline tasks; drives sequential placement when allocation mode is `SEQUENTIAL`. | priority override, manual rank |
| **Allocation mode** | How competing same-deadline tasks share free slots: `SEQUENTIAL` (place in tie-breaker order, each task fully before the next) or `EVEN_SPLIT` (round-robin sessions across chronologically ordered free windows: A, B, C, A, B, C…). | split strategy, scheduling mode |
| **Conflict-resolution UI** | Modal for same-date deadline conflicts: a full multi-way priority list (reorder all tied tasks) plus an even-split option, with live calendar hover previews. Confirming commits the previewed layout. | conflict picker, tie UI |

## Product

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Student Smart Timetable & Auto-Scheduler** | The product: a web app for university students that imports USOS schedules, tracks extracurriculars, highlights free slots, and auto-schedules tasks by deadline-driven priority with interactive conflict resolution. | the scheduler (alone), the calendar app |
