# Occurrence vs series when changing recurring activities

Edits, deletes, and soft-event moves on recurring custom activities always expose series edit scope: this occurrence only, or the entire series. Auto-choosing “occurrence only” would silently diverge instances; auto-choosing “series” would let one preemption permanently relocate gym night. The user picks the blast radius.

## Manual Edit / Delete timing

From Event details, **Edit** and **Delete** ask for series edit scope **immediately after the action is chosen** (before the edit form or destructive confirm). Soft-preemption toasts remain occurrence-only on commit, with an optional “Apply to entire series” follow-up.

## Series-wide time change

Choosing the entire series and saving new times updates the series template and **clears all occurrence exceptions** so one-off moves do not linger against the new template. Occurrence-only edits may override title and/or times on that date’s exception record.
