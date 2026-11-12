import {
  Children,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { CalendarDays } from "lucide-react";
import { enGB, pl } from "react-day-picker/locale";
import { Button as ShadcnButton } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import i18n, { locale, t } from "../i18n";
export { Input, Textarea };

export function Button({
  className = "",
  ...props
}: ComponentProps<typeof ShadcnButton>) {
  return (
    <ShadcnButton
      variant="ghost"
      title={props["aria-label"]}
      className={`product-button ${className}`}
      {...props}
    />
  );
}
const EMPTY = "__smartuni_empty_option__";
type Option = { value: string; label: ReactNode; disabled?: boolean };
function optionsFrom(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child): Option[] => {
    if (
      !isValidElement<{
        children?: ReactNode;
        value?: string | number;
        disabled?: boolean;
      }>(child)
    )
      return [];
    if (child.type === "option")
      return [
        {
          value: String(child.props.value ?? child.props.children ?? ""),
          label: child.props.children,
          disabled: child.props.disabled,
        },
      ];
    return optionsFrom(child.props.children);
  });
}
type SelectProps = Omit<
  ComponentProps<"button">,
  "value" | "defaultValue" | "onChange"
> & { required?: boolean } & {
  value?: string | number;
  defaultValue?: string | number;
  onValueChange?: (value: string) => void;
};
export function SelectField({
  value,
  defaultValue,
  onValueChange,
  children,
  name,
  id,
  disabled,
  required,
  className,
  ...props
}: SelectProps) {
  const options = optionsFrom(children);
  const initial = String(defaultValue ?? options[0]?.value ?? "");
  const [selected, setSelected] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const current = String(value ?? selected);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setSelected(initial);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initial]);
  return (
    <>
      <input
        ref={input}
        type="hidden"
        name={name}
        value={current}
        disabled={disabled}
      />
      <Select
        value={current || EMPTY}
        disabled={disabled}
        onValueChange={(next) => {
          const actual = next === EMPTY ? "" : next;
          setSelected(actual);
          onValueChange?.(actual);
        }}
      >
        <SelectTrigger
          id={id}
          className={`control-select ${className ?? ""}`}
          aria-required={required}
          {...props}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="control-menu">
          {options.map((option) => (
            <SelectItem
              value={option.value || EMPTY}
              key={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

type DateProps = Omit<
  ComponentProps<"button">,
  "value" | "defaultValue" | "onChange"
> & { required?: boolean } & {
  value?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  onValueChange?: (value: string) => void;
};
const asDate = (value?: string) =>
  value ? new Date(value + "T12:00:00") : undefined;
const asKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function DateField({
  value,
  defaultValue = "",
  onValueChange,
  name,
  id,
  disabled,
  required,
  min,
  max,
  className,
  ...props
}: DateProps) {
  const [selected, setSelected] = useState(defaultValue),
    [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const current = value ?? selected;
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => setSelected(defaultValue);
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);
  return (
    <>
      <input
        type="hidden"
        ref={input}
        name={name}
        value={current}
        disabled={disabled}
        data-date-required={required ? "true" : undefined}
        data-trigger-id={id}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            disabled={disabled}
            className={`date-trigger ${className ?? ""}`}
            aria-required={required}
            {...props}
            aria-label={`${props["aria-label"] ?? t("Wybierz datę")}: ${current ? asDate(current)!.toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" }) : t("Nie wybrano daty")}`}
          >
            <CalendarDays size={17} />
            <span>
              {current
                ? asDate(current)!.toLocaleDateString(locale(), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : t("Wybierz datę")}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="date-popover"
          sideOffset={8}
          onOpenAutoFocus={(event) => {
            const day = (
              event.currentTarget as HTMLElement
            ).querySelector<HTMLButtonElement>(
              'button[data-selected-single="true"],button[data-day][tabindex="0"]',
            );
            if (day) {
              event.preventDefault();
              day.focus();
            }
          }}
        >
          <Calendar
            mode="single"
            selected={asDate(current)}
            defaultMonth={asDate(current)}
            locale={i18n.language === "en" ? enGB : pl}
            weekStartsOn={1}
            labels={{
              labelNav: () => t("Nawigacja miesięcy"),
              labelNext: () => t("Następny miesiąc"),
              labelPrevious: () => t("Poprzedni miesiąc"),
              labelDayButton: (date, modifiers) =>
                `${modifiers.today ? t("Dzisiaj") + ", " : ""}${date.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${modifiers.selected ? ", " + t("Wybrana data") : ""}`,
              labelGrid: (date) =>
                date.toLocaleDateString(locale(), {
                  month: "long",
                  year: "numeric",
                }),
              labelWeekday: (date) =>
                date.toLocaleDateString(locale(), { weekday: "long" }),
            }}
            autoFocus
            disabled={[
              ...(min ? [{ before: asDate(min)! }] : []),
              ...(max ? [{ after: asDate(max)! }] : []),
            ]}
            onSelect={(date) => {
              if (!date) return;
              const key = asKey(date);
              setSelected(key);
              onValueChange?.(key);
              setOpen(false);
            }}
          />
          <div className="date-actions">
            <Button
              type="button"
              className="text-button"
              onClick={() => {
                const key = asKey(new Date());
                if ((!min || key >= min) && (!max || key <= max)) {
                  setSelected(key);
                  onValueChange?.(key);
                  setOpen(false);
                }
              }}
            >
              {t("Dzisiaj")}
            </Button>
            {!required && (
              <Button
                type="button"
                className="text-button"
                onClick={() => {
                  setSelected("");
                  onValueChange?.("");
                  setOpen(false);
                }}
              >
                {t("Wyczyść")}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
