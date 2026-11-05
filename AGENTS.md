# AGENTS.md

Guidance for coding agents working in this repository.

## Project

**Student Smart Timetable & Auto-Scheduler** — MVP web app for university students. Imports USOS schedules via `.ics`, manages permanent/soft extracurriculars, highlights free slots, and auto-schedules standard and large iterative tasks using deadline-driven priority and interactive conflict resolution.

Primary domain vocabulary lives in `GLOSSARY.md`. The application implementation plan lives in `docs/implementation-plan.md`.

This repository focuses on the application. Keep application code and useful technical documentation; do not add course presentations, slide-generation scripts, or SCRUM assignment deliverables.

Node.js and application npm dependencies (`node_modules`) may run locally on the host. Use Docker Compose for PostgreSQL and future infrastructure services; do not install infrastructure daemons on the host. An optional Compose `app` profile also runs the frontend in Docker. See `README.md` for setup.

## Agent skills

### UI and UX

Application UI must be polished, coherent, responsive, accessible, and easy to use. Treat visual quality and interaction design as acceptance criteria for every user-facing feature, starting with the MVP.

Agents designing, implementing, or reviewing UI must use the **apple-design** skill from https://github.com/dickwu/apple-design-skill. Read its `SKILL.md` and the relevant reference files before making design decisions. Use an installed copy when available; otherwise read the upstream skill and its references. This applies both before implementation and when reviewing the running result.

SmartUniPlanner is a React web app. Apply the skill's principles for clarity, typography, color, spacing, accessibility, and feedback in web terms, following its web-app scope. Use semantic HTML and WCAG 2.2 AA as the accessibility target; do not impose native Apple navigation, branding, fonts, or platform-only APIs.

Use the shared shadcn/ui + Radix controls in `apps/web/src/components`; do not introduce new native date pickers or independent modal implementations. Every system label, validation message, and accessibility label must have PL/EN translations. Preserve user-entered content when changing language.

For UI work, check the actual rendered interface at desktop and mobile widths, keyboard navigation, light/dark themes, and loading/empty/error states. Do not claim visual verification from a build alone. Keep reusable design tokens and components in the web app; verify calendar changes with realistic, densely populated schedules and long event titles.

### Issue tracker

Issues and specs live in GitHub Issues for `kucharzky/mpt-projekt-demo` (via `gh`). See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the repo root and ADRs under `docs/adr/`. See `docs/agents/domain.md`.
