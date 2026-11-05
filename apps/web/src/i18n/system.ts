import { t } from "./index";
import pl from "./pl.json";
import en from "./en.json";

const catalogs: Record<string, string>[] = [pl, en];
const known = new Map<string, string>();
const patterns: { expression: RegExp; key: string; names: string[] }[] = [];
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const key of Object.keys(pl)) {
  for (const value of new Set([
    key,
    ...catalogs.map((catalog) => catalog[key]),
  ])) {
    known.set(value, key);
    const names = [...value.matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
    if (names.length)
      patterns.push({
        key,
        names,
        expression: new RegExp(
          "^" +
            value
              .split(/{{\w+}}/)
              .map(escape)
              .join("(.*?)") +
            "$",
          "s",
        ),
      });
  }
}
/** Only system errors, toasts and parser warnings enter here. User content stays intact. */
export function systemMessage(message: string) {
  const key = known.get(message);
  if (key) return t(key);
  for (const pattern of patterns) {
    const match = message.match(pattern.expression);
    if (match)
      return t(
        pattern.key,
        Object.fromEntries(
          pattern.names.map((name, index) => [name, match[index + 1]]),
        ),
      );
  }
  return message;
}
