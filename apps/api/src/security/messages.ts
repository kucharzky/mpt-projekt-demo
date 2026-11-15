import catalog from "./en.json";
const messages: Record<string, string> = catalog;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(messages)
  .filter(([key]) => key.includes("{{"))
  .map(([key, value]) => ({
    expression: new RegExp(
      "^" +
        key
          .split(/{{value\d+}}/)
          .map(escape)
          .join("(.*?)") +
        "$",
      "s",
    ),
    value,
  }));
/** Only known system message fields enter this function; user content is never traversed. */
export function english(message: string): string {
  if (messages[message]) return messages[message];
  for (const pattern of patterns) {
    const match = message.match(pattern.expression);
    if (match)
      return pattern.value.replace(/{{value(\d+)}}/g, (_, index) =>
        message.startsWith("Sprawdź pole")
          ? english(match[Number(index) + 1])
          : match[Number(index) + 1],
      );
  }
  return message;
}
