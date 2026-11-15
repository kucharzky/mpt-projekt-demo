import { Button } from "./components/controls";
import { t as tr } from "./i18n";
import { useEffect, useRef } from "react";
import { LockKeyhole, Check, Coffee, Users, AlertTriangle } from "lucide-react";
import type { CalendarEvent, Slot } from "./api/client";
import { addDays, clock, dateKey, displayDate, duration, Empty } from "./ui";

function layout(events: { id: string; start: number; end: number }[]) {
  const result = new Map<string, { column: number; columns: number }>(),
    sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  let cluster: typeof sorted = [],
    end = 0;
  function flush() {
    const ends: number[] = [],
      placements = new Map<string, number>();
    for (const e of cluster) {
      let c = 0;
      while (c < ends.length && ends[c] > e.start) c++;
      ends[c] = e.end;
      placements.set(e.id, c);
    }
    for (const e of cluster)
      result.set(e.id, { column: placements.get(e.id)!, columns: ends.length });
  }
  for (const e of sorted) {
    if (cluster.length && e.start >= end) {
      flush();
      cluster = [];
      end = 0;
    }
    cluster.push(e);
    end = Math.max(end, e.end);
  }
  if (cluster.length) flush();
  return result;
}
export function Calendar({
  from,
  view,
  events,
  free,
  highlight,
  zone,
  conflicts,
  onEvent,
  onSlot,
}: {
  from: string;
  view: string;
  events: CalendarEvent[];
  free: Slot[];
  highlight: boolean;
  zone: string;
  conflicts: string[];
  onEvent: (event: CalendarEvent) => void;
  onSlot: (date: string, start: string) => void;
}) {
  events = events.map((event) =>
    event.source === "RECOVERY_BREAK"
      ? { ...event, title: tr("Przerwa regeneracyjna") }
      : event,
  );
  const scroll = useRef<HTMLDivElement>(null);
  const days = Array.from({ length: view === "day" ? 1 : 7 }, (_, i) =>
      addDays(from, i),
    ),
    today = dateKey(new Date(), zone);
  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 7 * 52;
  }, [from, view]);
  const color = (event: CalendarEvent) =>
    event.source === "USOS_ICS"
      ? "class"
      : event.source === "RECOVERY_BREAK"
        ? "break"
        : event.source === "CUSTOM_ACTIVITY"
          ? "activity"
          : event.source === "TEAM_MEETING"
            ? "meeting"
            : "task";
  if (view === "agenda")
    return (
      <div className="agenda">
        {days.map((day) => {
          const list = events
            .filter(
              (e) =>
                dateKey(new Date(e.start), zone) <= day &&
                dateKey(new Date(+new Date(e.end) - 1), zone) >= day,
            )
            .sort((a, b) => +new Date(a.start) - +new Date(b.start));
          return (
            <section className="agenda-day" key={day}>
              <h3>
                <span className={day === today ? "today-pill" : ""}>
                  {displayDate(day, { weekday: "short", day: "numeric" })}
                </span>
                <small>{displayDate(day, { month: "long" })}</small>
              </h3>
              <div>
                {list.length ? (
                  list.map((e) => (
                    <Button
                      key={e.id}
                      className={`agenda-event event-${color(e)} ${e.status === "MISSED" ? "event-missed" : e.status === "COMPLETED" ? "event-done" : ""}`}
                      onClick={() => onEvent(e)}
                    >
                      <span className="agenda-time">
                        {clock(e.start, zone)} – {clock(e.end, zone)}
                      </span>
                      <span>
                        <strong>{e.title}</strong>
                        <small>
                          {e.status === "MISSED"
                            ? tr("Sesja pominięta")
                            : e.status === "COMPLETED"
                              ? tr("Sesja wykonana")
                              : e.location ||
                                {
                                  USOS_ICS: tr("Zajęcia USOS"),
                                  SCHEDULED_TASK: tr("Sesja pracy"),
                                  CUSTOM_ACTIVITY: e.isPermanent
                                    ? tr("Stała aktywność")
                                    : tr("Elastyczna aktywność"),
                                  RECOVERY_BREAK: tr("Odpoczynek"),
                                  TEAM_MEETING: tr("Spotkanie zespołu"),
                                }[e.source]}
                        </small>
                      </span>
                      {e.isPermanent && <LockKeyhole size={15} />}{" "}
                      {conflicts.includes(e.id) && <AlertTriangle size={16} />}
                    </Button>
                  ))
                ) : (
                  <div className="agenda-empty">
                    {tr("Brak wydarzeń")}{" "}
                    <Button
                      className="text-button"
                      onClick={() => onSlot(day, "09:00")}
                    >
                      {tr("Dodaj aktywność")}{" "}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  const coords = (event: { start: string; end: string }, day: string) => {
    const startKey = dateKey(new Date(event.start), zone),
      endKey = dateKey(new Date(+new Date(event.end) - 1), zone);
    if (startKey > day || endKey < day) return null;
    const minute = (iso: string) => {
      const [h, m] = clock(iso, zone).split(":").map(Number);
      return h * 60 + m;
    };
    return {
      start: startKey < day ? 0 : minute(event.start),
      end:
        endKey > day
          ? 1440
          : dateKey(new Date(event.end), zone) > day
            ? 1440
            : minute(event.end),
    };
  };
  return (
    <div className="calendar-shell">
      <div className="calendar-scroll" ref={scroll}>
        <div
          className="calendar-canvas"
          style={{
            minWidth: view === "day" ? 0 : 840,
            gridTemplateColumns: `52px repeat(${days.length},minmax(0,1fr))`,
          }}
        >
          <div className="calendar-corner" />
          {days.map((day) => (
            <div
              className={`calendar-day-head ${day === today ? "is-today" : ""}`}
              key={day}
            >
              <span>{displayDate(day, { weekday: "short" })}</span>
              <strong>{displayDate(day, { day: "numeric" })}</strong>
            </div>
          ))}
          <div className="time-ruler">
            {Array.from({ length: 24 }, (_, h) => (
              <span style={{ top: h * 52 }} key={h}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const list = events
              .map((e) => ({ event: e, position: coords(e, day) }))
              .filter(
                (
                  x,
                ): x is {
                  event: CalendarEvent;
                  position: { start: number; end: number };
                } => !!x.position,
              );
            const positions = layout(
              list.map(({ event, position }) => ({
                id: event.id,
                ...position,
              })),
            );
            return (
              <div
                key={day}
                className={`calendar-day-body ${day === today ? "is-today" : ""}`}
                style={{ height: 24 * 52 }}
              >
                {highlight &&
                  free.map((slot, i) => {
                    const pos = coords(slot, day);
                    return (
                      pos && (
                        <Button
                          key={i}
                          className="free-slot"
                          style={{
                            top: (pos.start / 60) * 52,
                            height: ((pos.end - pos.start) / 60) * 52,
                          }}
                          onClick={() => onSlot(day, clock(slot.start, zone))}
                          aria-label={tr(
                            "Dodaj aktywność {{value0}} o {{value1}}",
                            {
                              value0: displayDate(day),
                              value1: clock(slot.start, zone),
                            },
                          )}
                        >
                          <span>
                            {duration(
                              (+new Date(slot.end) - +new Date(slot.start)) /
                                60000,
                            )}{" "}
                            {tr("bez stałych zajęć")}{" "}
                          </span>
                        </Button>
                      )
                    );
                  })}
                {list.map(({ event: e, position: p }) => {
                  const place = positions.get(e.id)!;
                  return (
                    <Button
                      key={e.id}
                      className={`calendar-event event-${color(e)} ${e.status === "COMPLETED" ? "event-done" : ""} ${e.status === "MISSED" ? "event-missed" : ""} ${e.source === "PREVIEW" ? "event-preview" : ""} ${conflicts.includes(e.id) ? "event-conflict" : ""}`}
                      style={{
                        top: (p.start / 60) * 52,
                        height: Math.max(22, ((p.end - p.start) / 60) * 52 - 2),
                        left: `calc(${(place.column / place.columns) * 100}% + 3px)`,
                        width: `calc(${100 / place.columns}% - 6px)`,
                      }}
                      onClick={() => onEvent(e)}
                      title={`${e.title} · ${clock(e.start, zone)}–${clock(e.end, zone)}`}
                      aria-label={tr(
                        "{{value0}}, {{value1}} do {{value2}}{{value3}}{{value4}}",
                        {
                          value0: e.title,
                          value1: clock(e.start, zone),
                          value2: clock(e.end, zone),
                          value3:
                            e.status === "MISSED"
                              ? tr(", pominięta")
                              : e.status === "COMPLETED"
                                ? tr(", wykonana")
                                : "",
                          value4: conflicts.includes(e.id)
                            ? tr(", kolizja")
                            : "",
                        },
                      )}
                    >
                      <span className="event-name">
                        {e.status === "COMPLETED" ? (
                          <Check size={12} />
                        ) : e.isPermanent ? (
                          <LockKeyhole size={11} />
                        ) : e.source === "RECOVERY_BREAK" ? (
                          <Coffee size={12} />
                        ) : e.source === "TEAM_MEETING" ? (
                          <Users size={12} />
                        ) : null}
                        {e.title}
                      </span>
                      {e.status === "MISSED" && p.end - p.start >= 45 && (
                        <small>{tr("Pominięta")}</small>
                      )}
                      {p.end - p.start >= 45 && (
                        <span>
                          {clock(e.start, zone)} – {clock(e.end, zone)}
                        </span>
                      )}
                      {p.end - p.start >= 90 && e.location && (
                        <small>{e.location}</small>
                      )}
                    </Button>
                  );
                })}
                {day === today && (
                  <div
                    className="now-line"
                    style={{
                      top:
                        ((Number(
                          clock(new Date().toISOString(), zone).slice(0, 2),
                        ) *
                          60 +
                          Number(
                            clock(new Date().toISOString(), zone).slice(3),
                          )) /
                          60) *
                        52,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {!events.length && (
        <div className="calendar-empty-note">
          <Empty title={tr("Miejsce na Twój plan")}>
            {tr("Dodaj aktywność lub zaimportuj zajęcia z USOS.")}{" "}
          </Empty>
        </div>
      )}
    </div>
  );
}
