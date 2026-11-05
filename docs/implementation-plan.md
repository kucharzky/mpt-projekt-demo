> Aktualizacja UI i produkcji: wspólne komponenty shadcn/ui + Radix, PL/EN (także walidacja i dostępność), zwijany panel boczny, stylowany wybór daty oraz Docker Compose z Caddy, prywatną bazą, kodem rejestracji i szyfrowanymi kopiami. Wyniki i granice odbioru: `docs/verification.md`, `docs/security-audit.md`, `docs/deployment.md`.

> Stan wdrożenia: aplikacja została przeniesiona z demo do modularnego monolitu opisanego poniżej. API, trwałe dane, kalendarz, zadania, parser ICS, propozycje planu i współpraca zespołowa są zaimplementowane. Instrukcja uruchomienia jest w README. Integracje z zewnętrznym kalendarzem zostały odłożone decyzją użytkownika. Bezpośredni dostęp do API USOS AGH nie jest skonfigurowany; podstawą importu pozostaje plik ICS. Poniższy plan opisuje kolejność i kryteria prac, a nie deklarację przetestowania każdej pozycji. Faktyczne wyniki zapisujemy w raporcie weryfikacji.

# SmartUniPlanner — plan implementacji

Data: 2026-11-04. Status: plan realizowany; aktualne funkcje i instrukcje są opisane w README. Sekcja „Punkt wyjścia” dokumentuje stan demo sprzed implementacji.

## 1. Punkt wyjścia

Plan dotyczy implementacji aplikacji. Opiera się na kodzie `mpt-projekt-demo`, `GLOSSARY.md`, ADR-0001–0007 oraz wymaganiach produktu.

| Obszar          | Stan w demo                                                                                                   | Praca do wykonania                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Kalendarz       | Widok tygodniowy, nawigacja, wydarzenia i podświetlanie free slots                                            | Widok dzienny, trwałe dane, API, dopracowanie kolizji i dostępności UI                     |
| Aktywności      | Permanent/soft, cykliczność, wyjątki, edycja wystąpienia lub serii                                            | Persystencja serii i wyjątków, walidacja po stronie serwera                                |
| Zadania         | Tworzenie, statusy, budżet czasu, sesje i postęp                                                              | Pełna edycja/usuwanie zadania, sortowanie, filtry, zapis i izolacja danych                 |
| Import ICS      | Prosty parser i zastępowanie wydarzeń USOS przy imporcie                                                      | Stabilna identyfikacja, strefy czasowe, raport błędów, deduplikacja i aktualizacja         |
| Scheduler       | Dwie propozycje, podział na sesje, partial placement, konflikt wspólnego deadline’u, bufory i recovery breaks | Przeniesienie na serwer, kompletna dynamic preemption, spójne przeplanowanie i testy reguł |
| Backend / konta | Brak API i bazy; dane w `useState`                                                                            | NestJS, Prisma, PostgreSQL, auth, autoryzacja, migracje                                    |
| Dostarczanie    | Skrypty dev/build/preview                                                                                     | Lint, testy, CI, Compose, staging, procedura wdrożenia i odtworzenia danych                |

Główne źródła: `src/App.tsx`, `src/types.ts`, `src/lib/{scheduler,freeSlots,recurrence,time,ics}.ts`, `src/components/` i `package.json`.

Ważne: obecność funkcji w demo nie oznacza ukończenia wymagania produkcyjnego. Na przykład tworzenie zadania wywołuje `buildProposals`, które traktuje pozostałe sesje i soft events jako zajęte; kompletnej dynamic preemption nie można uznać za gotową. Orkiestracja zmian pozostaje częściowo w `App.tsx`.

## 2. Zakres kolejnych wydań

| Wydanie                  | Rezultat dla użytkownika                                                                                                       | Zakres                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| R1 — MVP podstawowe      | Student zakłada konto, importuje zajęcia, zarządza kalendarzem i ręcznie planuje zadania; dane pozostają po ponownym logowaniu | Cały punkt 1 wymagań: dzień/tydzień, CRUD, cykliczność aktywności, kolizje, zadania/statusy/filtry, import i aktualizacja ICS, prywatne dane |
| R2 — inteligentny planer | Student otrzymuje propozycje sesji i bezpiecznie akceptuje przeplanowanie                                                      | Cały punkt 2: deadline-driven priority, podział na sesje, dynamic preemption, przerwy, niedostępność, przeciążenie, niezrealizowane sesje    |
| R3 — praca zespołowa     | Zespół prowadzi projekt i znajduje wspólne terminy, następnie planuje przydziały pracy                                         | Punkty 3.1–3.4, realizowane w tej kolejności                                                                                                 |
| R4 — rozszerzenia        | Powiadomienia, materiały i integracje                                                                                          | Punkt 4; funkcje wybierane pojedynczo według potrzeb i dostępności integracji                                                                |

Kod schedulera z demo wykorzystujemy w R2; jego ekstrakcję i testy można zacząć podczas R1. Jeżeli automatyczne planowanie ma być warunkiem pierwszego publicznego wydania, bramka wydania obejmuje R1 + R2. Samo zachowanie podglądu demo nie spełnia tej bramki.

### Wymaganie przekrojowe: dopracowany wygląd i wygodny UX

**Cała aplikacja ma wyglądać jak spójny, gotowy produkt i umożliwiać wygodną codzienną pracę.** Jakość UI/UX jest częścią każdego wydania i kryteriów odbioru funkcji, od MVP. Projektowanie interfejsu zaczyna się razem z pierwszym przepływem użytkownika.

Agenci projektujący, implementujący lub oceniający interfejs mają korzystać ze skilla [apple-design](https://github.com/dickwu/apple-design-skill). Przed pracą czytają jego `SKILL.md` i referencje dobrane do danego ekranu, a po implementacji oceniają rzeczywisty widok i cały przepływ. Dla tej aplikacji webowej stosujemy zasady czytelności, kompozycji, dostępności i interakcji, zgodnie z zakresem webowym skilla. Rozwiązania dopasowujemy do Reacta, HTML i przeglądarki.

| Obszar             | Wymagania i kryteria odbioru                                                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spójny wygląd      | Wspólne tokeny kolorów, typografii, odstępów, zaokrągleń i stanów; jedna rodzina ikon; konsekwentne przyciski, pola i okna. Kierunek wizualny wynika z produktu: kalendarz i plan dnia mają być główną treścią                                                                                                      |
| Kalendarz          | Czytelna hierarchia dat, godzin i wydarzeń; wyraźne „dzisiaj”; rozróżnialne zajęcia, aktywności, sesje, przerwy i propozycje. Długie tytuły, duża liczba wydarzeń i kolizje nie zasłaniają akcji ani informacji o czasie                                                                                            |
| Główne działania   | Import planu, dodanie zadania i zaplanowanie sesji są łatwe do znalezienia. Formularze mają rozsądne wartości domyślne, jasne jednostki czasu i błędy przy polach, zachowują wpisane dane po błędzie                                                                                                                |
| Propozycje planu   | Wyraźne oddzielenie podglądu od zapisanego stanu, lista przesunięć i brakujących godzin, czytelne akceptowanie/odrzucanie. Zmiana serii pokazuje zakres skutków. Informacje potrzebne do decyzji nie są dostępne wyłącznie po najechaniu myszą                                                                      |
| Responsywność      | Sprawdzenie przy szerokościach 360, 768 i 1440 CSS px oraz układu formularzy przy 320 CSS px i powiększeniu tekstu. Na telefonie wygodny dzień/agenda zamiast ściskania siedmiu kolumn; ewentualne przewijanie siatki jest ograniczone do kalendarza                                                                |
| Dostępność         | Cel: WCAG 2.2 AA. Obsługa klawiaturą, widoczny fokus, etykiety, poprawny fokus w dialogach i po ich zamknięciu, statusy zrozumiałe bez samego koloru. Brak funkcji wymagających wyłącznie drag-and-drop. Kontrast zwykłego tekstu ≥ 4,5:1, dużego ≥ 3:1; przyciski dotykowe projektujemy docelowo na 44 × 44 CSS px |
| Informacja zwrotna | Dopracowane stany ładowania, zapisu, sukcesu, błędu i pustego ekranu; brak podwójnego wysłania; po błędzie wiadomo, jak kontynuować. Potwierdzenia/Undo adekwatne do skutków działania; animacje krótkie i respektujące ograniczenie ruchu                                                                          |
| Motywy i treść     | Spójny motyw jasny i ciemny z preferencją systemową; krótki, konsekwentny język interfejsu; brak technicznych nazw algorytmu lub bazy w komunikatach dla studenta                                                                                                                                                   |

Odbiór UI obejmuje obejrzenie działających ekranów z realistycznymi danymi, przegląd `apple-design` i przejście podstawowych scenariuszy samą klawiaturą. W kluczowych przepływach sprawdzamy aktualne Chrome, Firefox i Safari/WebKit. Przed publicznym MVP przeprowadzamy krótką próbę użyteczności ze studentami: import zajęć, dodanie zadania i zrozumienie propozycji planu bez prowadzenia przez autora aplikacji.

Wskazane liczby kontrastu pochodzą z [WCAG — kontrast tekstu](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Cel 44 CSS px dla dotyku jest założeniem projektowym produktu; [WCAG 2.2 AA dla rozmiaru celu](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) określa minimum 24 CSS px z wyjątkami. [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) rozróżnia zwykłą treść od obszarów wymagających układu dwuwymiarowego.

## 3. Decyzje do zamknięcia przed odpowiednimi etapami

Poniższe propozycje są założeniami planu, nie zmianami już zaakceptowanych reguł. W przypadku ich przyjęcia należy zaktualizować właściwe ADR-y i dopiero wtedy kontrakty oraz testy.

| Temat                          | Stan / rozbieżność                                                                                  | Proponowana decyzja i termin                                                                                                                                                                                                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Priorytet zadania              | Wymagania mówią o ustawianiu priorytetu; glossary definiuje Priority score wyłącznie przez deadline | Przed CRUD zadań potwierdzić, czy priorytet jest wyliczany. Plan zakłada pilność z deadline’u i ręczny tie-breaker przy tej samej dacie. Ręczne HIGH/MEDIUM/LOW zmieniałoby model i wymaga ustalenia wpływu na kolejność                                                                             |
| Import aktualizujący           | Glossary: nowy import zastępuje wszystkie wydarzenia USOS                                           | Przed importem produkcyjnym przyjąć upsert w obrębie konkretnego źródła. Brak wydarzenia w pliku nie usuwa go automatycznie; usuwanie tylko dla jawnie wskazanego pełnego zakresu zastępowania                                                                                                       |
| Cykliczność USOS               | ADR-0003 wyłącza ekspansję RRULE w prototypie                                                       | R1: cykliczność własnych aktywności + jawne wystąpienia z ICS. Niewspierane RRULE zgłaszać i blokować zatwierdzenie niepełnego importu. Jeśli rzeczywiste eksporty wymagają RRULE, zastąpić ADR-0003 i dodać ograniczoną do zakresu ekspansję RRULE/RDATE/EXDATE oraz wyjątki przed odbiorem importu |
| Wykonana sesja                 | Demo automatycznie liczy sesję jako wykonaną, kiedy jej czas minął                                  | Przed R2 rozstrzygnąć, jak wykryć sesję niezrealizowaną. Propozycja: jawne potwierdzenie wykonania, zakończona niepotwierdzona sesja czeka na ocenę; dopiero oznaczenie pominięcia kieruje czas do przeplanowania. Wymaga aktualizacji definicji Session done                                        |
| Nakładanie wydarzeń            | Glossary dopuszcza ręczną kolizję z ostrzeżeniem                                                    | Zachować ostrzeżenie i świadome zatwierdzenie ręcznej kolizji. Automatyczny planer nigdy nie tworzy kolizji z hard-locked event ani między sesjami. Konflikt deadline’ów jest osobnym mechanizmem                                                                                                    |
| Czas i długość sesji           | Standard task ma 1h, duże zadanie ma budżet do deadline’u; kod zaokrągla chunk do 30 min            | R1 zachowuje standard 1h i budżet w krokach 30 min. Przed R2 ustalić minimalną/maksymalną sesję i zachowanie przy krótszej reszcie; nie zaokrąglać po cichu budżetu użytkownika                                                                                                                      |
| Ruch ręcznie ustawionych sesji | Docelowe przeplanowanie może zaskoczyć użytkownika po ręcznej edycji                                | Przed R2 ustalić ochronę ręcznej lokalizacji. Propozycja: jawna blokada sesji, którą scheduler respektuje                                                                                                                                                                                            |

Pozostałe reguły zachowujemy: free slots ignorują soft events i sesje (ADR-0001), partial placement pokazuje brakujące godziny (ADR-0002), konflikt obejmuje wszystkie aktywne zadania z tą samą datą (ADR-0004), horyzont sięga deadline’u (ADR-0005), zakres zmian serii jest jawny (ADR-0006), a bufory i recovery breaks działają według ADR-0007.

## 4. Architektura implementacji

Wybór: **React/Vite + NestJS + Prisma/PostgreSQL**, jedno repozytorium i jeden backend z modułami. Ten stack jest odpowiedni dla aplikacji; zmiana na framework full-stack wymagałaby przebudowy istniejącego frontendu bez wyraźnej korzyści dla planowania.

Monorepo oznacza wspólne repozytorium frontendu i backendu. Modularny monolit oznacza jeden uruchomiony backend, którego kod ma wyraźne granice odpowiedzialności. Moduł nie potrzebuje osobnego pakietu npm ani procesu, żeby dało się go niezależnie testować. Decyzję i kompromisy zapisuje [ADR-0008](adr/0008-modular-monolith.md).

### Struktura i narzędzia

```text
mpt-projekt/
├── apps/
│   ├── web/                         # React, Vite, Tailwind, TypeScript
│   │   └── src/
│   │       ├── features/            # calendar, tasks, auth
│   │       ├── api/generated/       # typy wygenerowane z OpenAPI
│   │       └── components/          # wspólne elementy UI
│   └── api/
│       ├── src/
│       │   ├── auth/               # konta i sesje logowania
│       │   ├── planner/            # kalendarz, zadania, propozycje
│       │   │   ├── domain/         # czas, cykliczność, czysty scheduler
│       │   │   ├── application/    # przypadki użycia i transakcje
│       │   │   └── http/           # kontrolery i DTO
│       │   ├── imports/            # adapter ical.js, diagnostyka ICS
│       │   └── database/           # połączenie i Prisma
│       └── prisma/                  # schema i migracje
├── package.json                     # npm workspaces: apps/*
├── package-lock.json                # jeden lockfile
├── docs/adr/
├── docker-compose.yml
└── .github/workflows/
```

Pozostajemy przy **npm workspaces**, bo demo już używa npm. Root odpowiada za wspólne polecenia dev/lint/typecheck/test/build, a każde `apps/*` deklaruje własne zależności. Nie dodajemy Nx/Turborepo ani `packages/shared`, dopóki rzeczywista potrzeba tego nie uzasadni. Osobny pakiet dla schedulera lub parsera wydzielamy, gdy pojawi się drugi konsument, np. osobny worker.

Web i API mają osobne konfiguracje TypeScript. Ustawienia Vite (`moduleResolution: bundler`, `noEmit`, `erasableSyntaxOnly`) nie są konfiguracją serwera Nest z dekoratorami. API kompilujemy i sprawdzamy w środowisku Node. Ścieżki `paths` TypeScript nie zastępują rzeczywistych zależności ani konfiguracji uruchomieniowej.

### Granice backendu

- `auth` odpowiada za tożsamość i logowanie. `AuthSession` oznacza sesję logowania; `TaskSession` oznacza sesję pracy nad zadaniem.
- `planner` jest właścicielem zadań, aktywności, wystąpień, sesji pracy, przerw, ustawień planowania i propozycji. Kalendarz i zadania pozostają razem, ponieważ edycja sesji i rozliczenie budżetu są jedną operacją. Podfoldery nie są osobnymi serwisami HTTP.
- `imports` tłumaczy ICS na znormalizowane dane i raport błędów. Zatwierdzenie zmian zleca publicznemu przypadkowi użycia `planner`; nie zmienia jego tabel bezpośrednio. `planner` nie importuje `imports`.
- Scheduler w `planner/domain` jest czystą funkcją wejście → propozycje. Nie importuje Reacta, NestJS ani Prisma, nie pobiera danych i nie czyta globalnego zegara. Reguły kalendarza rozwijają serie dla pełnego horyzontu przed wywołaniem algorytmu.
- Prisma obsługuje zapis na granicy przypadku użycia. Nie tworzymy generycznego repozytorium dla każdej tabeli ani własnego frameworka CQRS/event sourcing. Interfejsy wydzielamy tam, gdzie rozdzielają rzeczywiste zależności, np. zegar i parser.

Granice eksportów modułów i reguły importów sprawdzamy lintem. Powtarzające się cykle zależności oznaczają konieczność poprawy granic; `forwardRef` nie jest domyślnym sposobem ich rozwiązywania.

### Kontrakt API i frontend

**Źródłem kontraktu HTTP jest API:** jawne DTO wejścia/wyjścia w Nest → OpenAPI → wygenerowane typy dla web, np. przez `openapi-typescript`. Nie utrzymujemy jednocześnie ręcznych DTO w backendzie, `shared` i frontendzie. Dokument OpenAPI generujemy skryptem bez wymagania działającej bazy; CI weryfikuje, że wygenerowane typy odpowiadają aktualnemu kontraktowi.

Typy TypeScript znikają podczas uruchamiania, więc API osobno waliduje rzeczywiste żądania przez `ValidationPipe` i `class-validator`, odrzucając nieznane pola. Walidacja formularza daje szybką informację użytkownikowi, ale nie zastępuje walidacji serwera. Modele Prisma i wewnętrzne obiekty `Date` nie trafiają wprost do kontraktu HTTP.

Web wywołuje API przez jedną warstwę klienta i korzysta z TanStack Query do pobierania/cache/inwalidacji danych. Stan formularzy, wyboru tygodnia i podglądu pozostaje lokalny w React. Po zatwierdzeniu planu odświeżamy razem kalendarz i zadania; propozycja nie jest traktowana jako już zapisany kalendarz. Na początek nie dodajemy drugiego globalnego magazynu tych samych danych.

### Uruchamianie i wdrożenie

Domyślnie **Node i zależności npm działają lokalnie**, a PostgreSQL i przyszłe usługi infrastrukturalne w Dockerze. Vite i przyszłe API mają odświeżanie po zmianach. Compose zawiera bazę developerską, opcjonalną bazę testową i dodatkowy profil `app` dla uruchomienia web w kontenerze. W tym profilu źródła są montowane tylko do odczytu, a zależności pozostają w obrazie. Nie wymagamy lokalnej instalacji PostgreSQL, Redis ani innych serwerów.

Docelowo przeglądarka używa jednego origin: `/` obsługuje web, `/api/*` obsługuje API. W development Vite przekazuje `/api` do lokalnego Nest; jeśli oba procesy uruchomimy w kontenerach, adresem proxy będzie usługa `api`. W pierwszym wdrożeniu Nest może podawać zbudowane pliki SPA; jego fallback nie może przechwytywać błędów 404 z `/api`. Wystarcza jeden obraz aplikacji i PostgreSQL, bez osobnego serwera frontendu. HTTPS kończy platforma hostingowa lub proxy.

Sesje logowania zapisujemy w PostgreSQL przez utrzymywaną bibliotekę sesyjną, np. `express-session` z adapterem PostgreSQL. Cookie zawiera identyfikator sesji, nie dane użytkownika. Po logowaniu regenerujemy identyfikator, a przy wylogowaniu unieważniamy sesję. Nie używamy produkcyjnie pamięciowego session store ani JWT w localStorage. Ochrona CSRF jest potrzebna także przy jednym origin; SameSite nie zastępuje całej ochrony.

Wersje Node i bibliotek przypinamy oraz weryfikujemy przy inicjalizacji API. Migracje uruchamiamy jawnie przed startem nowej wersji aplikacji, nie w każdym procesie API. Dane developerskie i migracje nie mieszają się z bazą testową. PostgreSQL w lokalnym Compose ma trwały wolumen; baza testowa jest jednorazowa. Konfiguracja developerska nie jest konfiguracją produkcyjną.

### Dane i czas

| Encja                                           | Odpowiedzialność                                                                                                       |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| User / AuthSession                              | Konto, uwierzytelnienie, unieważnianie sesji logowania                                                                 |
| UserPreferences                                 | Strefa IANA, okna pracy w tygodniu/weekend, ustawienia planowania                                                      |
| CalendarEvent                                   | Wspólny model odczytu UI, składany z zajęć, aktywności, sesji pracy i przerw; nie osobna kopia każdego obiektu w bazie |
| ActivitySeries / OccurrenceException            | Wzorzec własnej aktywności, zakotwiczenie, zmienione i anulowane wystąpienia                                           |
| Task                                            | Deadline jako data, budżet pracy, status, tie-breaker i allocation mode                                                |
| TaskSession / RecoveryBreak                     | Jedyny zapis sesji pracy i przerw; relacja z zadaniem, czasy i potwierdzenie wykonania sesji                           |
| ImportSource / ImportBatch / Imported component | Źródło USOS, historia importów, stabilne identyfikatory i raport zmian                                                 |
| SchedulingProposal                              | Dokładna propozycja, bazowa rewizja danych, termin ważności i wynik zatwierdzenia                                      |

Odpowiedź kalendarza jest sumą rozłącznych wariantów, a nie obiektem z dowolną kombinacją `source` i opcjonalnych pól. Zapis kierujemy do konkretnych zasobów: aktywności albo sesji zadania. Klient nie może stworzyć sobie zajęć USOS ani recovery break przez zmianę pola `source`.

Nie przechowywać osobnych, konkurencyjnych kopii tej samej sesji w tabelach zadań i kalendarza. Postęp i godziny zaplanowane wyliczać z sesji; ewentualne cache muszą mieć jeden mechanizm aktualizacji. Serie zapisujemy jako szablony i wyjątki, bez rozwijania nieskończonej liczby wystąpień do tabeli.

Klucze obce, unikalność identyfikatorów importu i ograniczenia takie jak dodatni budżet oraz `end > start` egzekwujemy również w bazie. Brak kolizji nie jest globalnym zakazem w tabeli: ręcznie zaakceptowane kolizje pozostają dozwolone. Algorytm i transakcja zatwierdzająca mają egzekwować reguły automatycznego planu.

Znaczniki czasu zapisujemy jako chwile UTC, a strefę użytkownika/serii jako identyfikator IANA, np. `Europe/Warsaw`. Powtarzalne zajęcia o 09:00 zachowują lokalną godzinę po zmianie czasu. Deadline pozostaje `DATE`; obliczanie liczby dni nie może opierać się na dzieleniu milisekund przez 24h w pobliżu DST. Przedziały są półotwarte `[start, end)`, więc sąsiadujące wydarzenia nie kolidują.

W kontraktach REST chwile są tekstem ISO, daty — `YYYY-MM-DD`, a czas pracy — całkowitą liczbą minut. UI może prezentować godziny. Wszystkie operacje walidują `end > start`, zakresy, relacje i właściciela; klient nie wybiera `ownerId`.

### API — proponowane kontrakty

| Obszar               | Operacje                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                 | `POST /auth/register`, `/auth/login`, `/auth/logout`; `GET /me`                                                                                 |
| Preferencje          | `GET/PATCH /me/preferences`                                                                                                                     |
| Kalendarz            | `GET /calendar/events?from=&to=` — wspólny odczyt wydarzeń, bez generycznego zapisu dowolnego źródła                                            |
| Aktywności i serie   | `POST /activities`; `PATCH/DELETE /activities/:id` dla aktywności/całej serii; `PATCH/DELETE /activities/:id/occurrences/:date` dla wystąpienia |
| Kolizje / free slots | `GET /calendar/conflicts`, `GET /calendar/free-slots` dla ograniczonego zakresu                                                                 |
| Zadania              | `GET/POST /tasks`; `GET/PATCH/DELETE /tasks/:id`; filtry statusu i deadline’u, sortowanie i paginacja                                           |
| Ręczne sesje         | `POST /tasks/:id/sessions`; `PATCH/DELETE /task-sessions/:id`; jawne rozliczenie zmiany budżetu                                                 |
| Import               | `POST /imports/usos/preview`; `POST /imports/:id/commit`; wynik: dodane/zmienione/pominięte/konflikty/błędy                                     |
| Scheduler            | `POST /scheduler/proposals`; `POST /scheduler/proposals/:id/confirm`; odrzucenie/wygaśnięcie propozycji                                         |

Ścieżki w tabeli są względem prefiksu `/api`. API opisane przez OpenAPI i jawne DTO. Błędy mają stabilny kod, opis i ewentualne błędy pól. Ograniczamy zakres pobieranego kalendarza, horyzont planowania, wielkość pliku i liczbę rozwijanych wystąpień.

## 5. Kolejność implementacji i kryteria odbioru

### Etap 0 — ustalenie reguł aplikacji

- Potwierdzić granicę R1/R2 i decyzje potrzebne do kalendarza, zadań oraz importu.
- Zachować aktualne glossary i ADR-y przy przenoszeniu kodu do docelowej struktury.
- Przygotować przykładowe, zanonimizowane pliki ICS z rzeczywistych eksportów USOS i scenariusze odbioru.
- Z `apple-design` określić kierunek wizualny i przepływy: import, kalendarz, zadanie, podgląd propozycji. Przygotować prosty układ desktop/mobile i tokeny, zanim powstaną kolejne warianty komponentów.

**Odbiór:** określony zakres pierwszej wersji, lista reguł do zachowania/zmiany i pliki do testowania importu.

### Etap 1 — monorepo, środowisko i CI

- Przenieść obecny frontend do `apps/web`, zachowując uruchamialny demo-flow.
- Utworzyć dwa npm workspaces, `apps/web` i `apps/api`, oraz szkielet modułów backendu; nie wydzielać jeszcze pakietów bibliotecznych.
- Wykorzystać przygotowany Compose dla PostgreSQL; API domyślnie uruchamiać lokalnym Node. Dodać migrację początkową i jawne ładowanie konfiguracji z repozytorium. Opcjonalny obraz API przygotować po utworzeniu backendu.
- Dodać generowanie OpenAPI → typy klienta oraz lokalny proxy Vite `/api`.
- Uporządkować tokeny Tailwind i podstawowe komponenty web: przyciski, pola, dialogi, komunikaty i stany ładowania. Wykorzystać je w pierwszym działającym przepływie zamiast budować osobną aplikację katalogu komponentów.
- Dodać lint, typecheck, test i build do CI; migracje weryfikować na tymczasowej bazie.
- Dodać README, `.env.example`, health/readiness API i konfigurację środowisk. Obecny `.gitignore` ignoruje `.env.*`; dopuścić śledzenie bezpiecznego pliku przykładowego.

**Odbiór:** nowy developer uruchamia web/API lokalnym Node i bazę przez Compose według README; czysty checkout przechodzi CI. Zmiana układu plików nie zmienia reguł schedulera.

### Etap 2 — konta i prywatne dane

- Zbudować rejestrację, logowanie, wylogowanie i pobieranie użytkownika.
- Sesja serwerowa w PostgreSQL i cookie HttpOnly/Secure z odpowiednim SameSite, ochroną CSRF dla mutacji; web/API pod jednym origin.
- Dodać bezpieczne haszowanie haseł, limity prób logowania, walidację, wygasanie i unieważnianie sesji.
- Wprowadzić identyfikację właściciela we wszystkich zapytaniach domenowych, także dla zagnieżdżonych identyfikatorów i propozycji.
- Podłączyć chroniony frontend i obsługę wygaśnięcia sesji.

**Odbiór:** użytkownicy A i B nie odczytują ani nie zmieniają wzajemnie danych; wylogowanie unieważnia sesję; dane użytkownika pozostają po odświeżeniu i restarcie API.

### Etap 3 — trwały kalendarz, serie i zadania

- Wprowadzić model kalendarza, wydarzeń, serii, wyjątków, zadań i sesji oraz walidację po stronie API.
- Przenieść operacje domenowe z `App.tsx` do przypadków użycia w `planner`; dane serwerowe obsługiwać przez REST/TanStack Query, pozostawiając lokalny stan UI.
- Dodać widok dzienny przy wspólnym modelu prezentacji z widokiem tygodniowym.
- Domknąć CRUD aktywności i zadań, statusy, sortowanie i filtry; umożliwić ręczne przypisanie zadania do sesji.
- Odtwarzać wystąpienia tylko dla żądanego zakresu; zachować zakres edycji/usuwania serii z ADR-0006.
- Dodać wykrywanie kolizji i prezentację nakładających się wydarzeń. Zachować rozróżnienie free slots od faktycznej pojemności dla schedulera.
- Po zmianie/usunięciu sesji rozliczać budżet zadania; zachować zachowanie DONE i historii zgodnie z przyjętymi regułami.
- Obsłużyć ładowanie, błędy, puste listy i klawiaturę/fokus formularzy; nie uzależniać akceptacji podglądu wyłącznie od hover.
- Przeprowadzić przegląd `apple-design` na działającym kalendarzu i formularzach, w obu motywach i na wąskim ekranie; uwzględnić poprawki przed odbiorem etapu.

**Odbiór:** student tworzy i edytuje zadanie oraz cykliczną aktywność, planuje sesję ręcznie i widzi identyczny stan po ponownym logowaniu; edycja jednego wystąpienia nie zmienia reszty serii.

### Etap 4 — import USOS gotowy do codziennego użycia

- Zastąpić uproszczone parsowanie tekstu adapterem biblioteki `ical.js`; własny kod ma normalizować wynik, walidować zakres obsługi i tworzyć diagnostykę. Zweryfikować VCALENDAR/VEVENT, unfolding i escaping, UID, daty, TZID/VTIMEZONE, lokalizację i opis. Dla TZID sprawdzić również wymagane dane strefowe biblioteki; nie zakładać, że sam parser zna każdą strefę.
- Określić obsługę dat całodniowych, brakującego końca i floating time. Danych niejednoznacznych nie interpretować po cichu jako czasu serwera.
- Klucz tożsamości importowanego komponentu: właściciel/źródło + UID + znormalizowany RECURRENCE-ID, z odrębną obsługą komponentu głównego bez recurrence-id. Unikalność komponentu głównego wymaga jawnej reprezentacji lub indeksu, który uwzględnia brak wartości.
- Wersję komponentu rozpoznawać m.in. przez SEQUENCE/LAST-MODIFIED i zawartość; sprzecznych lub starszych zmian nie nadpisywać bez raportu.
- Dodać preview różnic i zatwierdzanie importu w transakcji; brak poprawnego importu nie usuwa poprzedniego planu.
- Ponowny import tego samego pliku jest idempotentny. Zmiana godziny aktualizuje istniejące zajęcia, zachowując stabilną tożsamość.
- Import nie modyfikuje własnych aktywności i sesji. Nowe kolizje z sesjami pokazuje jako ostrzeżenia/propozycję przeplanowania; nie przesuwa zadań bez akceptacji.
- RRULE obsłużyć zgodnie z decyzją z sekcji 3; nie tworzyć pozornie poprawnego planu zawierającego tylko pierwszy element serii.

**Odbiór:** import pliku, ponowny import bez duplikatów, aktualizacja zmienionych zajęć, poprawna strefa czasowa i bezpieczny błąd dla nieobsługiwanego/niepoprawnego pliku. Odbiór na rzeczywistych eksportach, obejmujących więcej niż widoczny tydzień.

**Bramka R1:** etapy 0–4 + warunki wydania z sekcji 8.

### Etap 5 — przeniesienie schedulera i propozycje planu

- Przenieść i scharakteryzować obecne `scheduler`, `freeSlots` i funkcje czasu; rozdzielić zaakceptowane reguły od przypadkowych ograniczeń demo.
- Wstrzykiwać `now`, strefę, preferencje i identyfikatory; algorytm ma być deterministyczny dla tych samych wejść.
- Pobierać wystąpienia wszystkich aktywności i istniejące sesje dla całego horyzontu, niezależnie od tygodnia aktualnie otwartego w UI. Obecne okno ekspansji wokół widocznego tygodnia nie może ograniczać algorytmu.
- Generować dokładnie dwie propozycje: Earliest Available Slots i Balanced Daily Spread.
- Zachować deadline-driven priority, konflikty wielu zadań, SEQUENTIAL/EVEN_SPLIT, partial placement, transition buffer i recovery breaks.
- Zapisywać propozycję i zestaw zmian wszystkich dotkniętych zadań/aktywności; UI pokazuje dodane, usunięte i przesunięte bloki oraz brakujące godziny.
- Zatwierdzenie zapisuje dokładnie zaakceptowaną propozycję, po sprawdzeniu rewizji i ważności; szczegóły w sekcji 6.

**Odbiór:** podgląd odpowiada zapisowi, odrzucenie nie zmienia kalendarza, powtórne zatwierdzenie nie duplikuje sesji. Testy potwierdzają brak planowania w przeszłości, po deadline i na hard-locked events.

### Etap 6 — przeplanowanie i przeciążenie

- Zaimplementować pełną dynamic preemption: wcześniejszy deadline może zmienić przyszłe sesje mniej pilnych zadań i wystąpienia soft events; hard-locked events pozostają na miejscu.
- Dodać niedostępność jednorazową i cykliczną oraz dzienne limity pracy; uwzględniać je w pojemności i propozycjach.
- Przeplanowywać tylko pozostały budżet pracy. Chronić sesje wykonane, przeszłe i jawnie zablokowane zgodnie z uzgodnioną polityką; przypadki sesji właśnie trwającej obsłużyć jawnie.
- Dodać obsługę sesji pominiętej i proponowanie przeniesienia niewykonanego czasu.
- Przeliczać przerwy dla zmienianego planu. Jeśli soft event nie ma bezpiecznego miejsca docelowego, pokazać nierozwiązany konflikt; nie usuwać go ani nie gubić po cichu.
- Po zmianie deadline’u, imporcie zajęć lub zwolnieniu czasu oferować aktualizację planu.
- Ostrzegać o przeciążeniu na podstawie pozostałych minut i rzeczywistej pojemności do deadline’u, po odjęciu ograniczeń i buforów. Pokazywać niedobór dla poszczególnych zadań.
- Dodać edycję propozycji przez serwerową walidację zmiany i ponowne wyliczenie, przed zatwierdzeniem.

**Odbiór:** pilne zadanie otrzymuje propozycję przesunięcia mniej pilnej pracy, żadna wykonana sesja nie znika, a brak miejsca pozostawia widoczny niedobór. Anulowanie propozycji zachowuje dotychczasowy harmonogram.

**Bramka R2:** etapy 5–6 + warunki wydania.

### Etap 7 — zespoły, projekty i Kanban

- Dodać moduł projektów z Team, Membership, Invitation, Project, Assignment i Comment. Zadanie projektu wykorzystuje istniejący Task z relacją do projektu i przypisanej osoby; nie tworzyć drugiego, niezależnego statusu tej samej pracy. Prywatny kalendarz pozostaje prywatny.
- Ustalić role owner/admin/member, uprawnienia projektu i zachowanie po odejściu członka.
- Zaproszenia mają termin ważności, jednorazowe przyjęcie i możliwość unieważnienia.
- Dodać CRUD projektów i zadań, terminy, przydziały, komentarze i tablicę Kanban z historią zmian.
- Rozdzielić zadanie projektu od sesji osobistej: przydział nie kopiuje automatycznie całej treści prywatnego kalendarza do zespołu.

**Odbiór:** członkowie prowadzą wspólny projekt, a osoba bez uprawnień nie może odczytać ani modyfikować zasobów zespołu.

### Etap 8 — wspólna dostępność i spotkania

- Udostępniać domyślnie busy/free, z jawnym zakresem zgody i możliwością wycofania; bez tytułów prywatnych zajęć.
- Wyznaczać przecięcie dostępności w strefach uczestników, z czasem trwania spotkania i preferowanymi godzinami.
- Dodać propozycję i akceptację terminu, ponownie weryfikowanego przy zapisie po zmianach kalendarzy.
- Pokazywać konflikty i wycofywać dostęp po usunięciu członkostwa.

**Odbiór:** zespół znajduje i potwierdza wspólny termin bez ujawnienia szczegółów prywatnych kalendarzy; nieaktualna propozycja nie zostaje zapisana jako bezkonfliktowa.

### Etap 9 — planowanie pracy zespołu

- Najpierw ustalić model: jedna czy wiele osób na zadanie, podzielność pracy, wymagane umiejętności, zależności i znaczenie deadline’u projektu. Sam termin zadania nie wystarcza do optymalizacji projektu.
- W pierwszej wersji przydzielać do jednej osoby spośród uprawnionych, według dostępności i pozostałego obciążenia; pokazywać powód propozycji.
- Nie zmieniać automatycznie prywatnych hard-locked events. Przydział i sesje stanowią propozycję do akceptacji przez właściwe osoby.
- Dodać wykrywanie ryzyka opóźnienia i porównanie wariantów; rozbudowaną optymalizację wdrażać dopiero po pomiarze jakości prostych heurystyk.
- Zatwierdzać wieloosobowy plan atomowo po sprawdzeniu rewizji wszystkich dotkniętych kalendarzy i zadań; wymaga to rozszerzenia mechanizmu z sekcji 6.

**Odbiór:** proponowany przydział ma uzasadnienie, nie przekracza dostępności bez widocznego ostrzeżenia, a zmiana planu jednej osoby nie zapisuje nieaktualnej propozycji całego zespołu.

**Bramka R3:** etapy 7–9 + warunki wydania.

### Etap 10 — dodatki jako osobne przyrosty

1. Notatki i linki do materiałów; załączniki dopiero po dodaniu przechowywania plików, limitów i kontroli dostępu.
2. Eksport ICS ze stabilnymi UID i poprawnym czasem, testowany ponownym importem do niezależnego kalendarza.
3. Powiadomienia: najpierw w aplikacji, później wybrane kanały; retry, deduplikacja, preferencje i anulowanie po zmianie sesji.
4. Zadania cykliczne: oddzielny wzorzec i instancje z własnym deadline’em/statusem; ukończenie instancji nie kończy serii.
5. API USOS: rozpoznanie wymagań konkretnej uczelni, dostępu i autoryzacji; adapter wykorzystujący ten sam proces normalizacji/importu.
6. Zewnętrzne kalendarze: najpierw jednokierunkowy odczyt, potem synchronizacja dwukierunkowa z jawną polityką konfliktów, usunięć i odnawiania dostępu.

Każdy przyrost ma własną bramkę odbioru. Integracje nie blokują R1–R3.

## 6. Spójność propozycji i importów

`planner` ma jeden protokół zapisu: każda mutacja najpierw blokuje wiersz stanu planowania użytkownika, sprawdza uprawnienia i oczekiwaną wersję, zapisuje zmiany i zwiększa rewizję w tej samej transakcji. Obejmuje to zadania, sesje, aktywności, serie, importy i preferencje. Sama obecność transakcji nie wystarcza, jeśli inne ścieżki omijają ten protokół.

1. API pobiera dane wejściowe i rewizję w jednej krótkiej transakcji odczytowej `REPEATABLE READ`. Zwykłe kolejne odczyty w `READ COMMITTED` mogą dać różne wersje danych. Obliczenia wykonujemy dopiero po zakończeniu odczytu.
2. Propozycja przechowuje snapshot wejścia lub jego identyfikowalny skrót, dokładny wynik, `baseRevision` i czas ważności.
3. Potwierdzenie stosuje ten sam protokół blokowania co każda inna mutacja. Atomowo sprawdza rewizję, własność, status propozycji i aktualne ograniczenia czasowe; samo sprawdzenie wersji przed transakcją byłoby podatne na wyścig.
4. Zmiana kalendarza po utworzeniu propozycji zwraca konflikt, np. HTTP 409; UI pobiera nowe propozycje. Upływ czasu nie pozwala potwierdzić sesji zaczynającej się już w przeszłości.
5. Zapis obejmuje wszystkie dodania, przesunięcia, usunięcia i przerwy; nie zostawia połowy zmienionego planu.
6. Idempotentne potwierdzenie powtórzone po timeout zwraca poprzedni wynik. Ponowienie z inną treścią pod tym samym kluczem jest odrzucane.

Ręczna edycja również podaje wersję zasobu: dwie karty przeglądarki nie nadpisują sobie zmian bez ostrzeżenia. Blokadę stanu planowania pobieramy przed zmianą zasobów. W operacjach wielu użytkowników pobieramy wszystkie blokady w stabilnej kolejności identyfikatorów, żeby ograniczyć deadlocki.

Propozycje mają ograniczony czas życia i rozmiar; po wygaśnięciu usuwamy duże payloady, pozostawiając tylko potrzebny wynik potwierdzenia. Importy przechowują znormalizowane dane i raport; surowych plików nie magazynujemy bez potrzeby.

Preview importu stosuje podobną kontrolę rewizji; dopiero zatwierdzenie zapisuje zmiany. Nie ufamy przesłanym przez klienta sesjom, właścicielom ani rzekomemu brakowi konfliktów.

Transakcyjny zapis wielu zmian jest wspieranym mechanizmem Prisma; dokładny interfejs implementacji zależy od przypiętej wersji. Zob. [dokumentacja transakcji Prisma](https://www.prisma.io/docs/orm/fundamentals/transactions).

Identyfikację komponentów i wyjątków ICS należy oprzeć na standardzie, w szczególności UID i RECURRENCE-ID zachowującym oryginalną tożsamość przesuniętego wystąpienia. Zob. [RFC 5545, sekcja 3.8.4.4](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.8.4.4).

## 7. Zależności implementacji

Ścieżka do R1: **0 → 1 → 2 → 3 → 4 → wydanie**. Parser można rozwijać równolegle do API na uzgodnionych kontraktach i przykładowych ICS; integracja i odbiór wymagają etapów 2–3.

Ścieżka do R2: **kontrakty czasu + testy reguł → 5 → 6 → wydanie**. Ekstrakcja algorytmu może ruszyć wcześniej, ale pełne planowanie serwerowe zależy od trwałego kalendarza i zadań.

Ścieżka zespołowa: **R2 → 7 → 8 → 9**. Zadania projektu/Kanban można udostępnić po etapie 7; automatyczny przydział wymaga modelu i dostępności z etapów 7–8.

Pierwszy działający przepływ: **konto → utworzenie aktywności → API → PostgreSQL → kalendarz po odświeżeniu**. Następnie rozszerzać go o zadania i import, a później planowanie. Oddzielić przenoszenie plików od zmiany modelu i algorytmu, żeby łatwiej wykrywać regresje.

## 8. Weryfikacja i bramki wydań

| Poziom           | Kluczowe scenariusze                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domena czasu     | DST w Europe/Warsaw, granica dnia, miesiąc krótszy od daty zakotwiczenia, wydarzenie przez północ, stykanie przedziałów                                                                                          |
| Parser           | Zawijane linie, escaped text, UID, UTC/TZID, błędne daty, brak końca, unsupported RRULE, reimport i zmieniona godzina                                                                                            |
| Scheduler        | Hard-lock, brak planowania w przeszłości/po deadline, partial placement, wiele tygodni, bufory, recovery breaks, konflikty 3+ zadań, SEQUENTIAL/EVEN_SPLIT                                                       |
| API + PostgreSQL | Dwie tożsamości użytkowników, migracje, rollback całej propozycji/importu, równoległy zapis, ponowione potwierdzenie, błędy własności relacji                                                                    |
| UI/E2E           | Rejestracja → import → zadanie → sesja/propozycja → zatwierdzenie → ponowne logowanie; odrzucenie podglądu, edycja serii, filtry, dostępność z klawiatury                                                        |
| Wygląd i UX      | Przegląd apple-design, realne ekrany desktop/mobile, jasny/ciemny motyw, długie tytuły i gęsty kalendarz, kontrast z wartości kolorów, stany puste/błędy/ładowanie; podstawowe przepływy w Chrome/Firefox/Safari |
| Zespoły          | Macierz ról, wygasłe zaproszenie, busy/free bez tytułów, cofnięcie dostępu, zmiana kalendarza podczas akceptacji spotkania                                                                                       |

Testy schedulera sprawdzają niezmienniki i uzgodnione scenariusze, zamiast utrwalać przypadkowe zachowanie implementacji demo. Testy integracyjne używają PostgreSQL; test autoryzacji nie kończy się na ukryciu przycisku w UI.

Każde wydanie wymaga:

- zielonych lint/typecheck/test/build i migracji zweryfikowanych na staging;
- przejścia scenariusza użytkownika dla danego wydania i braku otwartych błędów blokujących ten przepływ;
- spełnienia wymagań UI/UX z sekcji 2, wizualnej weryfikacji działającej aplikacji i poprawienia krytycznych problemów znalezionych przez `apple-design`; sam build nie potwierdza jakości interfejsu;
- sprawdzenia sesji/cookies/HTTPS w rzeczywistym środowisku wdrożenia;
- kopii bazy i próby odtworzenia oraz procedury wycofania aplikacji przy zmianach schematu;
- logowania błędów i metryk czasu importu/planowania bez treści prywatnych kalendarzy w logach;
- danych testowych o uzgodnionej wielkości i pomiarów czasu odpowiedzi. Na etapie 0 ustalić granice pliku, liczby wydarzeń, horyzontu i docelowego czasu planowania zamiast deklarować wydajność bez pomiarów.

Wydajność optymalizować na podstawie pomiarów. Na start synchroniczne, ograniczone rozmiarem obliczenia wystarczają. Gdy algorytm blokuje pętlę Node, przenieść go do worker thread; trwała kolejka to osobna potrzeba, np. ponawianie powiadomień. Redis, broker i niezależny mikroserwis nie są wymaganiami początkowymi. Gdy pojawi się dodatkowa usługa, uruchamiać ją w Dockerze.

## 9. Źródła techniczne

- [npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/) — zarządzanie aplikacjami z jednego root package.
- [Moduły NestJS](https://docs.nestjs.com/modules) i [serwowanie SPA](https://docs.nestjs.com/recipes/serve-static) — granice modułów i wspólne wdrożenie web/API.
- [Walidacja NestJS](https://docs.nestjs.com/techniques/validation), [OpenAPI w Nest](https://docs.nestjs.com/openapi/types-and-parameters) i [openapi-typescript](https://openapi-ts.dev/introduction) — walidacja runtime i typy klienta.
- [Sesje Express](https://expressjs.com/en/resources/middleware/session/) — sesja serwerowa i ograniczenia domyślnego magazynu pamięciowego.
- [Izolacja transakcji PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html) — spójność wielozapytaniowego odczytu.
- [ical.js](https://github.com/kewisch/ical.js) i [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) — parser standardu i obsługa danych serwerowych w web.
- [Apple Design Skill](https://github.com/dickwu/apple-design-skill) — obowiązkowe narzędzie pracy agentów nad interfejsem, stosowane w zakresie odpowiednim dla aplikacji webowej.
