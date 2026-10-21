# Glossary

Domain vocabulary for the Student Smart Timetable & Auto-Scheduler MVP. Prefer these terms in issues, specs, and code names; avoid the synonyms marked as preferred-not.

## Calendar & events

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Hard-locked event** | A calendar event that the auto-scheduler must never move or overwrite. All imported USOS `.ics` events are hard-locked; custom activities may be hard-locked when `is_permanent = true`. | immutable event, locked block |
| **Permanent activity** | A custom extracurricular event with `is_permanent = true`. Treated identically to USOS classes by the scheduler. | fixed event, pinned event |
| **Soft event** | A custom activity with `is_permanent = false`. May be shifted when a higher-priority deadline task needs the slot. | flexible event, movable event |
| **USOS import** | Ingesting a standard `.ics` (iCalendar) file exported from USOS via drag-and-drop or file picker. Parsed `VEVENT` fields: `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION`, `DESCRIPTION`, `RRULE`. All resulting events are hard-locked. | calendar upload (when meaning USOS specifically) |
| **Calendar event** | A timed block on the calendar. Sources: `USOS_ICS`, `CUSTOM_ACTIVITY`, or `SCHEDULED_TASK`. Fields include `id`, `title`, `start`, `end`, `is_permanent`, and optional `parent_task_id`. | appointment, booking |
| **Weekly grid view** | The primary calendar UI: Monday–Sunday, 07:00–22:00, 30-minute granularity. | week planner, timetable view |

## Free slots

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Free slot** | A contiguous window between 08:00 and 21:00 not occupied by USOS classes or permanent activities, at least 30 minutes long. Shown when "Highlight Free Slots" is active as emerald overlays with duration labels and a `+ Schedule Here` action. | gap, hole, empty block |

## Tasks

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Standard task** | A quick action item or single-block task (not chunked across the week). | todo, action item |
| **Large iterative task** | A task with a required `weekly_hours_required` (total weekly time investment), split into sessions by the distribution algorithm. Also called a **chunked task**. | big task, multi-hour task |
| **Task chunk** / **session** | One scheduled block derived from a large iterative task. Bounded by `min_session_length` (default 1h, max 2h per chunk). | fragment, piece |
| **Deadline date** | Task due date as date-only (`YYYY-MM-DD`), no time component. Sole input to priority scoring. | due datetime, deadline timestamp |
| **Task status** | Lifecycle of a task: `TODO` \| `IN_PROGRESS` \| `DONE`. Shown in the to-do sidebar; marking a chunk `DONE` updates parent progress and strikes through the calendar block. | state, stage |

## Scheduling & priority

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Priority score** | `(deadline_date − current_date)` in days. Lower score = higher urgency. | urgency rank, importance |
| **Dynamic preemption** | When a new task has an earlier deadline than already-scheduled soft/scheduled work, the algorithm pushes lower-priority chunks to later free slots and places the urgent task in the earliest available slots. Hard-locked events are never moved. | reschedule cascade, bumping |
| **Placement proposal** | One of 2–3 candidate layouts the large-task distribution algorithm offers for preview (e.g. Morning Focus, Balanced EvenSplit, Compact Blocks) before the user confirms. | schedule option, layout suggestion |
| **Same-date deadline conflict** | Two active tasks share the same `deadline_date` and compete for early free slots. Resolved via the conflict-resolution UI. | deadline tie, date clash |
| **Tie-breaker order** | Explicit ordering (`tie_breaker_order`) used when priority scores are equal (same deadline). | priority override, manual rank |
| **Allocation mode** | How competing same-deadline tasks share free slots: `SEQUENTIAL` (one fully before the other) or `EVEN_SPLIT` (alternating / 50-50 interleaved). | split strategy, scheduling mode |
| **Conflict-resolution UI** | Modal/popover with three choices and real-time calendar hover previews: prioritize A over B, prioritize B over A, or split evenly. Confirming commits the previewed layout. | conflict picker, tie UI |

## Product

| Term | Definition | Prefer not |
| ---- | ---------- | ---------- |
| **Student Smart Timetable & Auto-Scheduler** | The product: a web app for university students that imports USOS schedules, tracks extracurriculars, highlights free slots, and auto-schedules tasks by deadline-driven priority with interactive conflict resolution. | the scheduler (alone), the calendar app |
