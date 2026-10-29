# Multi-way same-date deadline conflict UI

When three or more active tasks share a deadline, the conflict-resolution UI is a full multi-way priority list (reorder all tied tasks) plus even-split, not pairwise “new vs group” dialogs. Pairwise collapses poorly as N grows and hides the real tie-breaker order; a single list keeps `tie_breaker_order` and hover previews honest for any N.
