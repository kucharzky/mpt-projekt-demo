# Trwałe dane, jawne wykonanie i potwierdzane propozycje

Zastępuje sprzeczne fragmenty ADR 0001–0007 dotyczące zachowania prototypu. W aplikacji z persystencją upływ czasu nie stanowi dowodu wykonania sesji: użytkownik oznacza ją jako COMPLETED lub MISSED. Sesje PLANNED z przeszłości pozostają zarezerwowane do rozstrzygnięcia, aby planer nie dublował niepotwierdzonej pracy.

Import ICS domyślnie aktualizuje stabilny klucz użytkownik/źródło/UID/wystąpienie; RRULE i wyjątki rozwijamy tylko w wybranym, ograniczonym zakresie. Zastąpienie importu jest osobną opcją podglądu. Aktywności zachowują strefę serii po zmianie strefy wyświetlania użytkownika. Zadania, sesje i własne aktywności są usuwane do kosza.

Planer przechowuje dwie propozycje bez zmieniania kalendarza. Zapis wymaga zgodnej rewizji stanu i atomowo utrwala dokładnie zaakceptowaną propozycję; po innych zmianach nie można jej potwierdzić ani cofnąć. Bufor, regeneracja i limit dzienny są konfigurowalne. Deadline pozostaje głównym priorytetem, a ręczna kolejność i ważność rozstrzygają remisy. Potwierdzone przez wszystkich spotkania zespołu są hard-locked.
