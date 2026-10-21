### 1. System Specification & Architectural Breakdown

# Student Smart Timetable & Auto-Scheduler – MVP Specification

## 1. System Overview

A web-based scheduling and task management application designed for university students. The system ingests academic schedules via `.ics` files (exported from USOS), allows users to define fixed extra-curricular commitments, highlights available time slots, and dynamically schedules one-off or large iterative tasks based on deadline-driven priority and interactive conflict resolution.

---

## 2. Core Functional Modules

### 2.1. `.ics` Calendar Import & Parsing Module (USOS Integration)

- **Input:** Standard `.ics` (iCalendar) file upload via drag-and-drop or file picker.
- **Parsing Logic:**
- Extract `VEVENT` blocks (`SUMMARY`, `DTSTART`, `DTEND`, `LOCATION`, `DESCRIPTION`, `RRULE`).
- Automatically classify all imported `.ics` entries as **Hard-Locked / Immutable Events (**`is_permanent = true`**)**.
- **Visual Representation:** Rendered in a distinct muted color (e.g., Slate Blue) with a lock icon indicating the auto-scheduler cannot move or overwrite them.



### 2.2. Custom Extracurricular Activities Module

- **Purpose:** Allow students to add non-university events (e.g., gym, part-time work, language courses).
- **Creation Parameters:**
- `Title` (String)
- `Day(s) & Time Range` (Start Time, End Time, Recurrence)
- `Permanent Toggle` (`is_permanent`: Boolean checkbox — **"Lock this activity (Permanent)"**)
- **Behavior:**
- If `is_permanent = true`: Treated identically to USOS classes; the scheduling algorithm cannot displace it.
- If `is_permanent = false`: Treated as a soft event that can be shifted if a high-priority deadline task requires the slot.



### 2.3. Interactive Calendar View & "Free Slot" Highlighter

- **Views:** Weekly Grid View (07:00 – 22:00, Monday – Sunday) with 30-minute granularity.
- **"Highlight Free Slots" Toggle Button:**
- Located in the top calendar toolbar.
- **Active State:** Computes all time windows between `08:00` and `21:00` not occupied by USOS classes or permanent activities (minimum contiguous duration: 30 minutes).
- **Visual Effect:** Renders pulsing green/emerald translucent overlays (`rgba(16, 185, 129, 0.18)`) with dashed borders in empty calendar gaps, displaying the exact available duration (e.g., *"Free Slot: 2h 30m"*) and a quick `+ Schedule Here` action button.



### 2.4. Task Management & To-Do Status System

- **Task Types:**

1. **Standard Task:** Quick action item or single-block task.
2. **Large Iterative Task (Chunked):** A task requiring a specific total weekly time investment (e.g., *"Telecom Project – 8 hours this week"*).

- **Task Attributes:**
- `id`, `title`, `description`
- `status`: `TODO` | `IN_PROGRESS` | `DONE`
- `deadline_date`: Date only (`YYYY-MM-DD`, no hours/minutes).
- `total_weekly_hours`: Float (Required for Large Iterative Tasks).
- `min_session_length`: Default `1h`, max `2h` per chunk.
- **To-Do Sidebar Panel:**
- Displays tasks grouped or filtered by status (`To-Do`, `In Progress`, `Done`).
- Marking a task or sub-chunk as `DONE` updates the progress bar on the parent task and visually strikes through the block on the calendar.

---



## 3. Priority Engine, Auto-Scheduling & Conflict Resolution



### 3.1. Deadline-Driven Priority Calculation (Date-Only)

- Priority is strictly derived from `deadline_date` (`YYYY-MM-DD`):

$$
\text{Priority Score} = (\text{Deadline Date} - \text{Current Date in Days})
$$

- Lower score = Higher urgency (Tasks due earlier receive higher priority).
- **Dynamic Preemption (Rescheduling Existing Tasks):**
- When a new task is created with an **earlier deadline** than already scheduled non-permanent tasks, the algorithm automatically preempts (pushes back) lower-priority scheduled task chunks to later available free slots in the week, placing the urgent task in the earliest available slots.
- Permanent events (`USOS` and `is_permanent = true` activities) are never moved.



### 3.2. Large Task Distribution Algorithm

- When a user inputs a Large Task with `total_weekly_hours` (e.g., 6 hours):

1. The algorithm scans all available free slots prior to `deadline_date`.
2. Splits the total duration into manageable sessions (e.g., `3 x 2h` or `4 x 1.5h`).
3. Generates **2–3 placement proposals** (e.g., *"Morning Focus"*, *"Balanced EvenSplit"*, *"Compact Blocks"*) that the user can preview on the calendar before confirming.



### 3.3. Same-Date Deadline Conflict Resolution UI (Hover-Preview Modal)

- **Trigger Condition:** User creates or updates a task whose `deadline_date` is identical (`Task_A.deadline_date == Task_B.deadline_date`) to an existing active task, and both compete for prime early free slots.
- **Interactive Resolution Menu:** A modal/popover appears presenting three choices with **real-time calendar hover previews**:

1. **Prioritize [Task A] over [Task B]:**

- *On Hover:* Immediately renders phantom preview blocks on the main calendar showing `[Task A]` occupying the earliest free slots in the week, followed by `[Task B]` in subsequent slots.

1. **Prioritize [Task B] over [Task A]:**

- *On Hover:* Previews `[Task B]` in the earliest slots and shifts `[Task A]` to later slots.

1. **Split Evenly (Alternating / 50-50 Interleaved):**

- *On Hover:* Previews both tasks alternating across available free slots or splitting daily free windows equally (e.g., 1h Task A, 1h Task B) so both progress simultaneously.
- **Confirmation:** Clicking an option commits the previewed layout to the calendar state.

---



## 4. Data Models

```json
{
  "CalendarEvent": {
    "id": "string",
    "title": "string",
    "start": "ISO-8601 DateTime",
    "end": "ISO-8601 DateTime",
    "source": "USOS_ICS | CUSTOM_ACTIVITY | SCHEDULED_TASK",
    "is_permanent": "boolean",
    "parent_task_id": "string | null"
  },
  "Task": {
    "id": "string",
    "title": "string",
    "status": "TODO | IN_PROGRESS | DONE",
    "is_large_task": "boolean",
    "weekly_hours_required": "number",
    "deadline_date": "YYYY-MM-DD",
    "tie_breaker_order": "number",
    "allocation_mode": "SEQUENTIAL | EVEN_SPLIT"
  }
}

```

