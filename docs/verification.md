# Weryfikacja SmartUniPlanner

Weryfikacja: 2026-11-04–2026-11-05. Środowisko: macOS, lokalny Node.js 24, PostgreSQL 18 w Dockerze, Google Chrome. Dane w scenariuszach są syntetyczne. Dokument opisuje wykonane kontrole, nie gwarantuje braku wszystkich możliwych błędów.

## Testy automatyczne

`npm test`: **45/45 przechodzi** — 18 scenariuszy integracyjnych API, 18 testów domeny, 2 testy ograniczonej rejestracji i 7 testów bezpieczeństwa/lokalizacji. Testy korzystają z odizolowanej bazy `_test`, wykonują migracje i sprzątają własne rekordy.

Sprawdzono między innymi:

- rejestrację, sesję po logowaniu, wylogowanie unieważniające cookie, CSRF (także nieprawidłowy nagłówek wielobajtowy), walidację i izolację danych użytkowników;
- CRUD zadań, odrzucanie nieaktualnych wersji i nieuprawnionych zapisów, komentarze i bezpieczne linki do materiałów;
- cykliczne aktywności, wyjątki, zakres edycji serii, kontrolę kolizji, kosz i przywracanie zachowujące indywidualne zmiany wystąpienia;
- DST, koniec miesiąca i zachowanie bezwzględnych terminów istniejącej serii po zmianie strefy wyświetlania;
- ręczne sesje, jawne wykonanie, pominięcie, przypięcie, rozliczenie nakładu i kwadransowe długości sesji zgodne z edytowalnym oszacowaniem;
- dwa warianty planu, deadline, bufory, limit dzienny, regenerację, częściowe rozmieszczenie, remisy trzech zadań i naprzemienne przydziały;
- ochronę wykonanych i przypiętych sesji oraz rozpoczętych aktywności; pominięta sesja zwalnia pojemność nawet jeśli wcześniej była przypięta;
- ręczną edycję propozycji, w tym odrzucenie kolizji z aktywnością przesuniętą z innego terminu, zapis dokładnie zaakceptowanego układu, współbieżne idempotentne potwierdzenie, nieaktualne rewizje i cofnięcie zmian;
- zachowanie indywidualnej nazwy elastycznej aktywności podczas przesunięcia oraz przywrócenie jej wcześniejszej daty i godziny przez Undo;
- ICS: strefy, składanie linii, Unicode, RRULE i wyjątki, błędne pliki, aktualizację po UID, deduplikację i round-trip eksportu;
- zaproszenia przypisane do adresu, role, brak dostępu osób spoza zespołu, wspólne terminy bez ujawniania prywatnych tytułów, wymaganie wszystkich zgód na spotkanie, atomowe przydziały i odrzucanie nieaktualnych propozycji;
- odebranie dostępu po usunięciu członka, przejęcie jego zadań przez właściciela i anulowanie wspólnych przyszłych spotkań.

## Rzeczywiste scenariusze w Chrome

Operacje wykonywano w natywnym Google Chrome, na dwóch kontach testowych. Oceniano wynik widoczny w interfejsie, a nie sam fakt kliknięcia.

| Obszar                  | Przeklikany rezultat                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konta                   | Rejestracja obu osób, natychmiastowe wejście do aplikacji, wylogowanie, ponowne logowanie, zachowanie danych i rozdzielenie prywatnych kalendarzy                                                                                   |
| Zadania                 | Dodanie zadania na 6 h, edycja tytułu i ważności, zmiana statusu, lista/Kanban, wyszukiwanie z pustym wynikiem, filtr ukończonych, sortowanie alfabetyczne                                                                          |
| Cykliczne zadanie       | Utworzenie zadania tygodniowego, ukończenie i pojawienie się kolejnego terminu po 7 dniach                                                                                                                                          |
| Szczegóły               | Dodanie notatki, komentarza i linku do materiału; ponowny odczyt zapisanych danych                                                                                                                                                  |
| Kalendarz               | Dzień/tydzień/agenda, przechodzenie między tygodniami, wolne okna i formularz aktywności otwierany z okna                                                                                                                           |
| Aktywności              | Utworzenie tygodniowej serii, wybór zakresu przed edycją, zmiana pojedynczego wystąpienia, jawne potwierdzenie kolizji, usunięcie i odtworzenie wyjątku, zachowanie pozostałych tygodni, edycja całej serii i wyczyszczenie wyjątku |
| Sesje                   | Ręczne dodanie do kalendarza, przypięcie, jawne wykonanie i aktualizacja postępu, oznaczenie jako pominięta i pokazanie czasu do ponownego zaplanowania, usunięcie i przywrócenie                                                   |
| Planowanie              | Porównanie obu wariantów, naprzemienny podział i zmiana kolejności, podgląd wszystkich sesji, ręczna korekta daty przed akceptacją, zapis, dokładne cofnięcie poprzedniego układu                                                   |
| Przeciążenie            | Zadanie na 100 h z ograniczoną dostępnością: propozycja 21 h i komunikat o brakujących 79 h; zamknięcie podglądu nie zmieniło kalendarza                                                                                            |
| Import                  | Przykład w aplikacji, ponowny identyczny import bez duplikatów, systemowy wybór pliku z dysku; RRULE COUNT=3 i EXDATE dały właściwe dwa wystąpienia; uszkodzony plik odrzucony bez zapisu                                           |
| Eksport                 | Pobrany `smartuniplanner.ics`, status „Gotowe” w Chrome; pobrany plik odczytany parserem zawierał wszystkie 10 wydarzeń z ówczesnego zakresu                                                                                        |
| Zespoły                 | Utworzenie zespołu i projektu, edycja projektu, zadanie projektowe na tablicy, kod zaproszenia i dołączenie drugiego konta; członek miał zablokowane akcje edycji cudzego zadania                                                   |
| Dostępność i spotkania  | Dobrowolne udostępnienie przez obie osoby, wspólne terminy, propozycja, jedna zgoda bez rezerwacji, dwie zgody z rezerwacją w kalendarzu, anulowanie potwierdzonego spotkania                                                       |
| Obciążenie i role       | Wyliczenie propozycji przydziału Bartkowi, akceptacja i nowy właściciel na karcie zadania; zmiana roli członka na administratora                                                                                                    |
| Kosz                    | Odtwarzanie zadania cyklicznego, sesji i anulowanego wystąpienia, z weryfikacją ponownej obecności w liście lub kalendarzu                                                                                                          |
| Ustawienia i komunikaty | Zapis limitu 4 h/dzień i ponowne otwarcie formularza z tą wartością; powiadomienie o spotkaniu i oznaczenie przeczytanego                                                                                                           |
| Wygląd i klawiatura     | Jasny/ciemny motyw, desktop, agenda przy 360 px, formularze przy 320 px, projekty przy 768 px, Escape anulujący dialog i powrót fokusu do przycisku otwierającego                                                                   |

## UI i dostępność

Zastosowano [apple-design](https://github.com/dickwu/apple-design-skill) w zakresie zasad odpowiednich dla aplikacji webowej: hierarchia treści, semantyczne kolory, systemowa typografia, spójne ikony, fokus, dialogi i adaptacja do szerokości. Przegląd działającego UI doprowadził m.in. do wyśrodkowania dialogów po resecie stylów Tailwind, układu formularzy w jednej kolumnie na małych ekranach oraz etykiet przycisków ikonowych na mobilnym i tabletowym pasku.

Obliczony kontrast wybranych tokenów: tekst jasny 13,35:1, tekst pomocniczy 5,02:1, jasny przycisk główny 6,71:1; odpowiednio w ciemnym motywie 12,69:1, 6,47:1 i 8,65:1. To kontrola głównych tokenów, nie pełny audyt WCAG ani test z czytnikiem ekranu. Dla pominiętych sesji zastosowano czytelny tekst, obwódkę i etykietę zamiast samego zmniejszania przezroczystości.

## Uruchomienie i dane

- `npm run setup` działa na istniejącej konfiguracji, zachowuje sekrety, generuje Prisma i wykonuje migracje; na używanej bazie nie pozostają oczekujące migracje.
- Lokalny frontend i API działają na 5173/3001, PostgreSQL w Dockerze na 5432. Nie instalowano PostgreSQL na hoście.
- Pełny profil Compose: baza → kontener migracji → zdrowe API → zdrowy frontend. Sprawdzono na alternatywnych portach 5174/3002, w tym logowanie przez proxy i odczyt tych samych trwałych danych.
- Obraz produkcyjny buduje frontend i API w Linux/Node; uruchomiony kontener poprawnie serwuje SPA, zasób JS, healthcheck i odpowiedź 404 dla nieistniejącego endpointu API. Sprawdzono CSP oraz logowanie i flagi Secure/HttpOnly/SameSite cookie w lokalnej symulacji zaufanego reverse proxy. Nie był to test publicznej domeny ani rzeczywistego zakończenia TLS.
- Kopię `pg_dump -Fc` odtworzono przez `pg_restore --exit-on-error` do nowej, tymczasowej bazy. Liczby użytkowników, zadań i aktywności zgadzały się z oryginałem. Tymczasową bazę usunięto po kontroli; baza używana przez aplikację nie była nadpisywana.
- TypeScript, ESLint i build obu workspaces przechodzą. Generowanie OpenAPI i typów klienta jest powtarzalne. Audyt npm po poprawkach zależności: **0 zgłoszonych podatności**. Workflow GitHub Actions został przygotowany; jego wykonanie w usłudze GitHub wymaga wypchnięcia zmian.

## Granice weryfikacji i integracji

Google Calendar i inne zewnętrzne kalendarze są poza bieżącym zakresem na życzenie użytkownika. AGH USOS obsługujemy przez pliki ICS; nie skonfigurowano bezpośredniego API USOS ani uczelnianych kluczy aplikacji. Testy importu używały plików syntetycznych, a nie prywatnego eksportu rzeczywistego studenta AGH.

Powiadomienia działają w aplikacji. Zaproszenia przekazuje się kodem, bez wysyłki e-maili. Przydziały zespołu są heurystyką dostępności, bez modelu kompetencji lub zależności między zadaniami. Firefox i Safari nie zostały przeklikane w tym odbiorze. Nie wykonano badania ze studentami, testu obciążenia wielu równoczesnych użytkowników ani niezależnego pentestu. Przegląd bezpieczeństwa kodu i konfiguracji opisuje `docs/security-audit.md`.

## Dodatkowy odbiór UI, języków i wariantu VPS

- Komponenty przycisków, formularzy, list wyboru, dialogów i popovera daty współdzielą shadcn/ui + Radix oraz tokeny kolorów istniejącego projektu. Dodano animacje respektujące ograniczenie ruchu, spójne ustawienie ikon i fokus. Dostosowano pole nazwy marki oraz kartę informacyjną panelu.
- Chrome: rozwinięcie/zwinięcie nawigacji, zapamiętanie po odświeżeniu, PL/EN w nawigacji, datach, formularzach, rolach i powiadomieniach. Zachowano treści wpisane przez użytkownika. Błąd rejestracji zmienił język bez ponownego wysyłania formularza.
- Chrome: nowe zadanie „UI library verification”, zmiana terminu na 15 listopada w stylowanym kalendarzu, minimum sesji 30 min wybrane klawiaturą, zapis i obecność na liście. Zapis ustawień z prawidłową wartością Europe/Warsaw; sprawdzono listę wszystkich stref. Escape zamyka dialog i przywraca fokus otwierającemu przyciskowi.
- Chrome: walidacja pustego tytułu po angielsku, fokus na błędnym polu i zachowanie zawartości formularza. Podczas sprawdzania wykryto i naprawiono utratę domyślnej wartości opcji bez jawnego `value`.
- Chrome: interfejs angielski i polski, motywy jasny i ciemny, szerokości 320/360/768 px oraz desktop. Dodatkowa kontrola po migracji ujawniła i usunęła nakładanie mobilnych akcji nawigacji. Mobilne akcje znajdują się teraz we wspólnym pasku, a formularz przy 360 px ma jedną kolumnę. Wybór daty mieścił się w ekranie.
- Osobny podgląd na porcie 5175 i bazie `_test`: formularz wymagający kodu rejestracji, błędny kod odrzucony bez utworzenia konta, poprawny kod otworzył pusty planer. Nie zmieniano rejestracji ani konta użytkownika w zwykłym oknie Chrome.
- Końcowe odświeżenie konsoli deweloperskiej: brak błędów JavaScript; wcześniejsze błędy połączeń pochodziły z restartów lokalnego API podczas edycji.
- Produkcyjne obrazy API, migracji i backupu zostały zbudowane. Osobny projekt `smartuni-vps-smoke` używał portów 18080/18443 wyłącznie na localhost, prywatnej bazy i testowej domeny planner.localhost. To nie było publiczne wdrożenie.
- Caddy zakończył TLS. Klient testowy ufał wyłącznie publicznemu certyfikatowi tego CA w pamięci pojedynczego procesu. Sprawdzono przekierowanie HTTP, CSP, brak nagłówka Server, cookie `__Host-session` z Secure/HttpOnly/SameSite, logowanie, zapis zadania i odmowę CSRF. Publiczna ścieżka healthchecku była niedostępna.
- Konto runtime bazy miało brak prawa tworzenia tabel i modyfikowania historii migracji; proces API działał jako UID 1000. Backup Restic wykonał zrzut po zapisie zadania, kontrolę integralności i retencję. Po odszyfrowaniu odtworzono go do nowej bazy i znaleziono zapisane zadanie. Kopia poza VPS pozostaje do skonfigurowania przez operatora.

Końcowa kontrola klawiatury w wyborze daty: otwarcie ustawia fokus na wybranym dniu; strzałka w prawo i Enter zmieniły termin z 11 na 12 listopada. Produkcyjny test HTTPS po dodaniu kodu rejestracji potwierdził odrzucenie rejestracji bez kodu i sukces z prawidłowym kodem.
