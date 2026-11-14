import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import pl from "./pl.json";
import en from "./en.json";

const saved = localStorage.getItem("smartuni-language");
void i18next.use(initReactI18next).init({
  resources: { pl: { translation: pl }, en: { translation: en } },
  lng:
    saved === "en" || saved === "pl"
      ? saved
      : navigator.language.startsWith("pl")
        ? "pl"
        : "en",
  fallbackLng: "pl",
  supportedLngs: ["pl", "en"],
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
});
function applyLanguage() {
  document.documentElement.lang = i18next.language;
  document.title = "SmartUniPlanner";
  localStorage.setItem("smartuni-language", i18next.language);
}
i18next.on("languageChanged", applyLanguage);
applyLanguage();
export const t = (key: string, values?: Record<string, unknown>): string =>
  i18next.t(key, values ?? {});
export const locale = () => (i18next.language === "en" ? "en-GB" : "pl-PL");
export default i18next;
