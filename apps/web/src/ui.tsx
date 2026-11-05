import { systemMessage } from "./i18n/system";
import {
  Dialog as DialogRoot,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./components/ui/dialog";
import { Button, DateField } from "./components/controls";
import { t as tr, locale } from "./i18n";
import {
  cloneElement,
  isValidElement,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { X, LoaderCircle, ArrowRight, CalendarDays } from "lucide-react";

export const statusNames: Record<string, string> = {
  get TODO() {
    return tr("Do zrobienia");
  },
  get IN_PROGRESS() {
    return tr("W trakcie");
  },
  get DONE() {
    return tr("Ukończone");
  },
};
export const recurrenceNames: Record<string, string> = {
  get NONE() {
    return tr("Bez powtarzania");
  },
  get ONE_TIME() {
    return tr("Jednorazowo");
  },
  get WEEKLY() {
    return tr("Co tydzień");
  },
  get BIWEEKLY() {
    return tr("Co dwa tygodnie");
  },
  get MONTHLY() {
    return tr("Co miesiąc");
  },
};
export const importanceNames = () => [tr("Niski"), tr("Zwykły"), tr("Wysoki")];
export function dateKey(date = new Date(), zone?: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function addDays(key: string, days: number) {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function monday(key: string) {
  const d = new Date(key + "T12:00:00Z").getUTCDay();
  return addDays(key, -((d + 6) % 7));
}
export function displayDate(
  key: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  return new Date(key.slice(0, 10) + "T12:00:00Z").toLocaleDateString(
    locale(),
    {
      timeZone: "UTC",
      ...options,
    },
  );
}
export function clock(iso: string, zone: string) {
  return new Date(iso).toLocaleTimeString(locale(), {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60),
    m = Math.round(minutes % 60);
  return (
    [
      h ? tr("{{value0}} godz.", { value0: h }) : "",
      m ? tr("{{value0}} min", { value0: m }) : "",
    ]
      .filter(Boolean)
      .join(" ") || tr("0 min")
  );
}
export function timeValue(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function minutesValue(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function IconButton({
  label,
  onClick,
  children,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      className="icon-button"
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
    >
      {children}
    </Button>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CalendarDays size={24} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId(),
    hintId = `${id}-hint`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{
        id?: string;
        "aria-label"?: string;
        "aria-describedby"?: string;
      }>(children)
        ? cloneElement(children, {
            id,
            ...(children.type === DateField ? { "aria-label": label } : {}),
            "aria-describedby": hint ? hintId : undefined,
          })
        : children}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const opener = useRef(document.activeElement);
  return (
    <DialogRoot
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={`dialog product-dialog ${wide ? "dialog-wide" : ""}`}
        showCloseButton={false}
        {...(!subtitle ? { "aria-describedby": undefined } : {})}
        onOpenAutoFocus={(event) => {
          const first = (
            event.currentTarget as HTMLElement
          ).querySelector<HTMLInputElement>(
            'input:not([type="hidden"]):not([type="checkbox"]),textarea',
          );
          if (first) {
            event.preventDefault();
            first.focus();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = opener.current;
          if (target instanceof HTMLElement && target.isConnected)
            target.focus();
        }}
      >
        <header className="dialog-header">
          <div>
            <DialogTitle>{title}</DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </div>
          <IconButton label={tr("Zamknij")} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        <div className="dialog-content">{children}</div>
      </DialogContent>
    </DialogRoot>
  );
}
export function Form({
  onSubmit,
  children,
  label = tr("Zapisz"),
  cancel,
  onError,
  disabled = false,
}: {
  onSubmit: (form: FormData) => Promise<void>;
  children: ReactNode;
  label?: string;
  cancel: () => void;
  onError?: (error: unknown) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    for (const input of Array.from(form.elements)) {
      if (!(
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement
      ))
        continue;
      if (input.disabled || input.validity.valid) continue;
      const label =
        input.labels?.[0]?.textContent?.trim() ||
        input.getAttribute("aria-label") ||
        tr("Ustawienie");
      setError(
        input.validity.valueMissing
          ? tr("Uzupełnij pole „{{label}}”.", { label })
          : input.validity.typeMismatch && input.type === "email"
            ? tr("Podaj poprawny adres e-mail.")
            : tr(
                "Sprawdź pole „{{value0}}”. Podana wartość jest nieprawidłowa.",
                { value0: label },
              ),
      );
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    form
      .querySelectorAll('[aria-invalid="true"]')
      .forEach((input) => input.removeAttribute("aria-invalid"));
    const missing = form.querySelector<HTMLInputElement>(
      'input[data-date-required="true"][value=""]',
    );
    if (missing) {
      setError(tr("Wybierz datę."));
      document.getElementById(missing.dataset.triggerId ?? "")?.focus();
      return;
    }
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await onSubmit(data);
      if (form.isConnected) form.reset();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : tr("Nie udało się zapisać danych."),
      );
      onError?.(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      noValidate
      onSubmit={submit}
      className="form-stack"
      onInput={(event) => {
        (event.target as HTMLElement).removeAttribute("aria-invalid");
      }}
    >
      {children}
      {error && (
        <p role="alert" className="inline-error">
          {systemMessage(error)}
        </p>
      )}
      <footer className="form-actions">
        <Button type="button" className="button secondary" onClick={cancel}>
          {tr("Anuluj")}{" "}
        </Button>
        <Button className="button primary" disabled={busy || disabled}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <ArrowRight size={17} />
          )}{" "}
          {busy ? tr("Zapisywanie…") : label}
        </Button>
      </footer>
    </form>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
