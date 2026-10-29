# No RRULE expansion in the prototype

USOS import places only discrete `VEVENT` instances that fall in the visible week (`SUMMARY`, `DTSTART`, `DTEND`, `LOCATION`). Expanding `RRULE` is deferred. Sample schedules and typical one-week USOS exports are already instance-based; recurrence parsing would widen scope without changing the scheduling demo.
