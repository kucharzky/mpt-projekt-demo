# SmartUniPlanner

Działająca aplikacja studencka: prywatny kalendarz, zadania, import i eksport ICS, planer sesji oraz projekty zespołowe. Dane i sesje logowania są zapisywane w PostgreSQL. Interfejs ma wersje PL/EN, zwijany panel boczny, wspólne komponenty shadcn/ui oraz jasny i ciemny motyw. Działa na małych ekranach.

## Pierwsze uruchomienie

Wymagane: Node.js 24 LTS, npm i uruchomiony Docker z Compose. PostgreSQL działa wyłącznie w Dockerze. W katalogu repozytorium:

```sh
npm ci
npm run setup
npm run dev
```

`setup` tworzy lokalny `.env` z losowymi sekretami, uruchamia bazę, generuje klienta Prisma i wykonuje migracje. Zachowuje istniejącą konfigurację. Otwórz [localhost:5173](http://localhost:5173) i zarejestruj własne konto. Nie ma wspólnego konta demonstracyjnego ani domyślnego hasła użytkownika.

Frontend Vite przekazuje `/api` do NestJS na porcie 3001. Zmieniając porty, dostosuj `.env` (`WEB_PORT`, `API_PORT`, `APP_ORIGIN`, URL bazy) i konfigurację Vite. Sekrety są wykluczone z Git i kontekstu budowania obrazów.

## Funkcje

- Kalendarz dzienny, tygodniowy i agenda; wolne okna, kolizje, własne aktywności jednorazowe i cykliczne. Edycja pojedynczego wystąpienia lub całej serii.
- Zadania z terminem, priorytetem, szacowanym nakładem, długością sesji, notatkami, materiałami, komentarzami i cyklicznością. Lista i Kanban, wyszukiwanie, filtrowanie i sortowanie.
- Ręczne sesje z przypięciem i jawnym statusem wykonania. Sam upływ czasu nie oznacza wykonania pracy.
- Dwie propozycje planu: najbliższe terminy i równomierny rozkład. Deadline ma pierwszeństwo; można uporządkować zadania z tym samym terminem lub dzielić czas naprzemiennie. Podgląd, ręczna korekta, potwierdzenie i bezpieczne cofnięcie planu. Ostrzeżenia o brakującym czasie, limity dzienne, odstępy i przerwy.
- Import USOS z pliku ICS: podgląd przed zapisem, RRULE, wyjątki, strefy czasowe, stabilne identyfikatory i deduplikacja. Opcjonalne zastąpienie importowanych zajęć w wybranym zakresie. Eksport widocznego zakresu do ICS.
- Zespoły, projekty, role, zaproszenia kodem przypisanym do adresu e-mail, przydzielanie zadań i propozycje podziału według obciążenia. Wspólne terminy ujawniają wyłącznie dostępność po zgodzie członka. Spotkania trafiają do kalendarzy dopiero po akceptacji wszystkich.
- Powiadomienia w aplikacji, ustawienia czasu pracy i strefy, kosz z przywracaniem zadań, sesji oraz aktywności.

Integracje z zewnętrznymi kalendarzami są odłożone zgodnie z ustaleniem. Import AGH działa przez eksport pliku ICS z USOS; bezpośrednie API USOS wymaga osobnej konfiguracji uczelnianego dostępu i nie jest obecnie podłączone. Powiadomienia działają w aplikacji, bez wysyłki e-maili i systemowego push. Planowanie zespołu jest heurystyką opartą o terminy i dostępność; nie modeluje zależności między zadaniami ani kompetencji osób.

## Całość w Dockerze

Po `npm run setup` można uruchomić także API i frontend w kontenerach:

```sh
docker compose --profile app up -d --build --wait
docker compose --profile app logs -f api web
```

Porty 5173 i 3001 muszą być wolne (zatrzymaj wcześniej lokalne `npm run dev`). Migracje wykonuje osobny kontener przed startem API. Źródła aplikacji są podłączone do odczytu z automatycznym odświeżaniem. Po zmianie zależności przebuduj obrazy.

```sh
docker compose --profile app stop web api
docker compose down
```

Zwykłe `down` zachowuje dane. Nie używaj `down --volumes`, jeśli chcesz je zachować. Baza nasłuchuje tylko na interfejsie lokalnym.

## Testy i kontrole

```sh
docker compose --profile test up -d --wait postgres-test
npm run db:generate
npm run typecheck
npm run lint
npm test
npm run build
npm run api:types
```

Testy integracyjne używają wyłącznie `TEST_DATABASE_URL` z nazwą bazy kończącą się `_test`; odrzucają konfigurację wskazującą bazę developerską. Migracje testowe są automatyczne. Testowy PostgreSQL jest odizolowany, z danymi w pamięci kontenera. `npm run api:types` odtwarza OpenAPI i typy klienta, bez uruchamiania serwera i bez dostępu do danych. Kontrole CI wykonują lint, typowanie, testy, build i weryfikują aktualność kontraktu.

## Struktura i architektura

```text
apps/web/       React 19, Vite, TypeScript, React Query, shadcn/ui, i18next
apps/api/       NestJS: auth, planner, imports, projects, database
  prisma/       schemat i wersjonowane migracje PostgreSQL
  src/planner/domain/  czysty scheduler i reguły czasu
  src/imports/ics.ts   adapter iCalendar
tests/          testy domenowe i integracyjne API
scripts/        przygotowanie środowiska
docs/           plan, decyzje i raport weryfikacji
```

To modularny monolit w dwóch npm workspaces. Backend egzekwuje reguły i uprawnienia; frontend pokazuje propozycje. Zmiany harmonogramu są atomowe i chronione rewizją użytkownika oraz wersjami rekordów. Sesje są przechowywane po stronie serwera, hasła hashowane Argon2id, mutacje chronione CSRF. Typy HTTP generujemy z OpenAPI; Prisma nie trafia do frontendu.

## VPS z Caddy i HTTPS

Samodzielny wariant produkcyjny używa `compose.production.yml`. Node, API, PostgreSQL, Caddy i backupy działają w kontenerach; na VPS potrzebny jest Docker Compose. Nie używaj developerskiego Compose do publikacji aplikacji.

```sh
node scripts/production-setup.mjs planner.example.com admin@example.com
docker compose --env-file deploy/.env.production -f compose.production.yml up -d --build
```

Zastąp domenę i adres e-mail własnymi wartościami. Skrypt generuje oddzielne losowe hasła bazy, sekret sesji, kod rejestracji i klucz szyfrowania kopii w pliku z uprawnieniami `0600`; nigdy nie nadpisuje istniejącej konfiguracji. Wygenerowany lokalnie plik używa domeny przykładowej i nie stanowi publicznego wdrożenia. Przygotuj konfigurację z docelową domeną na VPS według instrukcji.

Rejestracja produkcyjna wymaga kodu od administratora; lokalna pozostaje otwarta. Caddy publikuje tylko porty 80/443, uzyskuje i odnawia certyfikat. API i baza nie mają portów hosta. Backend wymaga HTTPS i ufa wyłącznie adresowi Caddy w wydzielonej sieci. Aplikacja działa bez roota, z systemem plików do odczytu i ograniczeniami zasobów. Migracje wykonuje oddzielny proces z innym kontem bazy.

Usługa `backup` wykonuje spójny `pg_dump` i szyfruje go przez Restic codziennie. Sam lokalny wolumen kopii nie zabezpiecza przed utratą VPS — instrukcja opisuje kopię poza serwerem i odtwarzanie do pustej bazy.

[Instrukcja VPS i odzyskiwania danych](docs/deployment.md) · [Audyt bezpieczeństwa](docs/security-audit.md) · [Raport testów](docs/verification.md) · [Plan i zakres](docs/implementation-plan.md) · [Słownik domeny](GLOSSARY.md)

Zależności pośrednie `multer`, `minimatch` i `deepmerge-ts` mają jawne poprawione zakresy w `overrides`. Narzędzia Prisma/nodemon są deklarowane w katalogu głównym; deklaracja adaptera NestJS jest tam również powtórzona, aby obejść [błąd npm przy przenoszeniu overrides przez link workspace](https://github.com/npm/cli/issues/9659). Zgodność tych wersji jest sprawdzana generowaniem Prisma, migracjami, lintem i testami API. Po usunięciu tego ograniczenia npm można uprościć deklarację adaptera.
