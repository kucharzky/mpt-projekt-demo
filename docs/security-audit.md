# Audyt bezpieczeństwa SmartUniPlanner

Przegląd: 2026-11-04–2026-11-05. Zakres: kod React/NestJS/Express, walidacja, izolacja danych, sesje i CSRF, parser ICS, zależności npm oraz przygotowany wariant Docker/Caddy/PostgreSQL. Przegląd i poprawki wykonano z użyciem [security-best-practices](https://github.com/openai/skills/blob/main/skills/.curated/security-best-practices/SKILL.md), w tym reguł dla Express i React. Nie jest to niezależny pentest ani audyt działającego publicznego VPS.

Opisane problemy poprawiono w kodzie lub konfiguracji. Weryfikacja obejmuje 45 testów automatycznych, ręczne scenariusze Chrome, rzeczywiste zakończenie TLS w izolowanym Caddy i odtworzenie zaszyfrowanej kopii do osobnej bazy. Audyt npm zgłosił 0 znanych podatności. To wynik dla sprawdzonego lockfile, nie gwarancja braku przyszłych podatności ani skan systemu operacyjnego obrazów.

## Ustalenia i poprawki

### SEC-01 — trwałe limity żądań i koszt uwierzytelnienia

**Priorytet: wysoki. Reguły: EXPRESS-AUTH-001, EXPRESS-DOS-001. Naprawione.**

Wcześniej limity logowania używały `new Map()` w procesie, znikały po restarcie i nie obejmowały kosztownych operacji. Powtarzane żądania mogły obciążyć Argon2, parser i planer; kilka procesów miało niezależne liczniki.

[RateLimiter](../apps/api/src/security/rate-limit.ts), metoda `consume`, linie 19–44, używa atomowego `INSERT … ON CONFLICT` w PostgreSQL. Klucze są HMAC-em zakresu i identyfikatora; tabela nie zawiera surowych IP ani e-maili. Wygasłe liczniki są usuwane. Liczba oczekujących połączeń, wielkość puli i czasy operacji są ograniczone; niedostępność magazynu limitów daje 503.

[Middleware](../apps/api/src/main.ts), linie 149–213 i 286–313, egzekwuje 300 żądań/min/IP, 60 pobrań sesji/15 min/IP, 30 prób uwierzytelnienia/15 min/IP oraz 10 prób/15 min dla pary konto–IP. Kosztowne generowanie planów, podziałów, dostępności i podglądów ma 20 żądań/min/użytkownika. Odrzucenia zwracają 429 z `Retry-After`. Ścieżki są normalizowane także dla końcowego ukośnika i wielkości liter.

[AuthController](../apps/api/src/auth/auth.controller.ts), linie 30–49, dopuszcza maksymalnie cztery jednoczesne obliczenia hasha na proces. Weryfikacja nieistniejącego konta również oblicza Argon2, co ogranicza prostą enumerację opartą o czas logowania. Hash: Argon2id, 64 MiB, trzy iteracje, jeden wątek. Test współbieżnych liczników używa dwóch niezależnych pul i potwierdza dokładnie 10 dopuszczonych z 30 równoczesnych żądań.

### SEC-02 — HTTPS, zaufane proxy i konfiguracja produkcyjna

**Priorytet: wysoki. Reguły: EXPRESS-PROXY-001, EXPRESS-COOKIE-001. Naprawione.**

Wariant oparty wyłącznie o `TRUST_PROXY=1` i ręczne uruchomienie API nie zapewniał bezpiecznej topologii VPS. Przy nieprawidłowym wystawieniu API klient mógłby wpływać na interpretację adresu IP lub protokołu.

[Walidacja konfiguracji](../apps/api/src/config.ts), linie 20–52, zatrzymuje start produkcji bez HTTPS, długiego sekretu sesji, kodu rejestracji i jawnego zaufanego proxy. Odrzuca globalne zakresy zaufania oraz niebezpieczne flagi Node. [Compose](../compose.production.yml) ufa wyłącznie `172.30.91.2/32`; statyczny adres Caddy nie należy do puli dynamicznej. API i PostgreSQL nie mają portów hosta. Publiczne 80/443 należą wyłącznie do Caddy, który obsługuje TLS i nadpisuje informacje proxy zgodnie ze swoim standardowym mechanizmem zaufania.

Zweryfikowano rzeczywisty TLS z własnym testowym CA ograniczonym do klienta testowego, przekierowanie HTTP→HTTPS, CSP i cookie Secure. Nie instalowano CA w systemie ani nie obchodzono ostrzeżenia przeglądarki. Osobny test API potwierdza, że zmiana niezaufanego `X-Forwarded-For` nie omija limitów.

### SEC-03 — rozdzielenie uprawnień bazy danych

**Priorytet: wysoki. Reguła: EXPRESS-INJECT-001, zasada minimalnych uprawnień. Naprawione.**

Developerskie konto PostgreSQL nie powinno być kontem aplikacji produkcyjnej. Przejęcie procesu działającego z uprawnieniami właściciela/superusera zwiększałoby skutki podatności.

[Inicjalizacja ról](../deploy/init-db.sh), linie 6–19, tworzy osobne konta administratora, migratora, aplikacji i backupu. Konto `smartuni_app` ma DML i użycie schematu, bez tworzenia tabel, ról, baz i replikacji. [Migrator](../apps/api/scripts/migrate.cjs) odbiera mu także dostęp do `_prisma_migrations`. Backup ma odczyt i domyślne transakcje read-only. Ograniczono liczbę połączeń i czasy zapytań aplikacji.

W działającym obrazie sprawdzono: proces UID 1000, `current_user = smartuni_app`, `canCreateTables = false`, `canRewriteMigrations = false`, a zapis zadania działa. Zapytania aplikacji pozostają parametryzowane przez Prisma/tagged SQL; nie znaleziono wykonywania SQL ani poleceń powłoki z konkatenacji danych żądania.

### SEC-04 — cykl życia sesji i bezpieczne odpowiedzi

**Priorytet: średni. Reguły: EXPRESS-SESS-001/002, EXPRESS-CSRF-001, EXPRESS-ERROR-001. Naprawione.**

Wcześniejsza sesja miała domyślną nazwę cookie i długie jednolite wygasanie. Brakowało jawnego absolutnego limitu oraz wyłączenia cache odpowiedzi prywatnych.

[Konfiguracja sesji](../apps/api/src/main.ts), linie 217–253: magazyn PostgreSQL, cookie produkcyjne `__Host-session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, bez Domain. Sesja anonimowa ma 10 minut; uwierzytelniona wygasa po 24 h bezczynności i maksymalnie 7 dniach od logowania. Identyfikator i CSRF są regenerowane przy logowaniu. Wylogowanie niszczy sesję i usuwa cookie. Przypadkowe anonimowe GET-y nie tworzą nowych sesji; token jest wydawany przez właściwy endpoint sesji.

Mutacje wymagają CSRF i zgodnego Origin, a żądania Fetch Metadata `cross-site` są odrzucane. CORS pozostaje wyłączony. API zwraca `Cache-Control: no-store, private`, bez ETag i X-Powered-By. Dodano Referrer-Policy, Permissions-Policy, ochronę przed osadzeniem i CSP. Dopuszczenie stylów inline służy dynamicznej geometrii kalendarza i Radix; skrypty nie mają `unsafe-inline` ani `unsafe-eval`.

Nieprawidłowy JSON i zbyt duże żądania mają kontrolowane odpowiedzi 400/413. Błędy ORM są mapowane bez ujawniania zapytań, ścieżek i sekretów. Komunikaty walidacji i odmowy są dostępne po polsku i angielsku. Testy obejmują wygaszenie sesji po stronie serwera, brak cookie dla anonimowego zasobu, nietypowe ścieżki CSRF, nagłówki i błędne dane wejściowe.

### SEC-05 — łączny koszt importu ICS i dane tymczasowe

**Priorytet: wysoki. Reguły: EXPRESS-UPLOAD-001, EXPRESS-DOS-001. Naprawione.**

Limit iteracji liczony osobno dla każdej reguły RRULE pozwalał łączyć wiele kosztownych serii w jednym pliku. Limit wielkości pliku sam nie ogranicza kosztu ekspansji.

[Parser](../apps/api/src/imports/ics.ts), linie 42–137: 2 MB, do 5000 VEVENT, maksymalnie 10 000 wystąpień i wspólny budżet 25 000 kroków ekspansji dla całego pliku. Długości metadanych i SEQUENCE mają limity, a nieznane błędy biblioteki są zamieniane na kontrolowany komunikat. Rejestr stref czasowych jest czyszczony w `finally`. Baza przechowuje do 20 000 importowanych wydarzeń na użytkownika; aktywnych podglądów może być 10. Wygasłe podglądy są sprzątane, a po zatwierdzeniu payload importu jest opróżniany z zachowaniem idempotencji.

Limit JSON 3 MB działa również w Caddy. Ustawiono limity czasu odczytu nagłówków/body, odpowiedzi proxy, Node i bazy. Test z dwiema długimi seriami potwierdza wspólny budżet ekspansji. Nie wykonuje się pobierania URL z treści ICS ani uruchamiania załączników.

### SEC-06 — obraz i izolacja procesów

**Priorytet: średni. Reguły: REACT-CONFIG-001, EXPRESS-STATIC-001, EXPRESS-NODE-INSPECT-001. Naprawione.**

[Dockerfile](../Dockerfile), linie 27–41, oddziela etap budowania/migracji od runtime. Runtime zawiera produkcyjne zależności, skompilowane API i statyczny build UI; nie kopiuje repozytorium, `.env` ani narzędzi developerskich jako osobnego środowiska. `npm prune --omit=dev` usuwa zależności oznaczone wyłącznie developersko; zależności pośrednie wymagane przez pakiety produkcyjne pozostają.

[Compose](../compose.production.yml) ogranicza pamięć, PID-y, capabilities, uprawnienia i zapisy do systemu plików. Aplikacja i Caddy działają bez roota. Wyjątki: inicjalizacja uprawnień pustych wolumenów oraz oficjalny entrypoint PostgreSQL, po którym daemon bazy działa jako postgres. Migracje nie otrzymują konta administratora bazy. Logi mają rotację. Statyczne zasoby nie obejmują uploadów ani sekretów; dotfiles są blokowane. W przeglądarce nie przechowuje się tokenów sesji w localStorage — tylko język, motyw i stan panelu.

### SEC-07 — szyfrowane kopie i odtwarzanie

**Priorytet: wysoki dla utraty danych. Poprawiono lokalny mechanizm; kopia poza VPS wymaga konfiguracji operatora.**

Sam ręczny, niezaszyfrowany `pg_dump` nie stanowi wystarczającego planu odzyskiwania prywatnych harmonogramów.

[Backup](../deploy/backup.sh) uruchamia `pg_dump` przez Restic `--stdin-from-command`, co propaguje błędy zrzutu. Dane są szyfrowane, objęte retencją i kontrolą integralności. Konto backupu nie może modyfikować aplikacji. Wykonano zrzut działającej produkcyjnej próby po utworzeniu zadania, odszyfrowanie i `pg_restore --exit-on-error` do nowej bazy; zapisane zadanie było obecne. Bazy używanej przez aplikację nie nadpisano.

Obecne repozytorium Restic jest lokalnym wolumenem. Nie chroni przed utratą całego VPS; nie skonfigurowano zewnętrznego magazynu, ponieważ nie wskazano dostawcy ani dostępów. [Instrukcja](deployment.md) opisuje wymagany transfer poza serwer i próbę odtworzenia. Klucz szyfrowania i konfiguracja również wymagają bezpiecznej kopii poza VPS.

### SEC-08 — kontrolowana rejestracja produkcyjna

**Priorytet: średni. Decyzja użytkownika: kod dostępu na produkcji. Naprawione.**

Bez połączenia z dostawcą poczty nie można potwierdzić własności podanego adresu. Otwarta rejestracja umożliwiałaby nieznanym osobom tworzenie kont i zużywanie zasobów.

[AuthController](../apps/api/src/auth/auth.controller.ts), linie 65–76, wymaga losowego kodu z konfiguracji, zanim sprawdzi konto i obliczy hash. Porównanie używa digestów o stałej długości i `timingSafeEqual`. Kod nie trafia do bundle ani odpowiedzi sesji; UI otrzymuje wyłącznie flagę wymaganego kodu. Produkcja nie uruchomi się bez niego. Lokalnie rejestracja jest otwarta, o ile operator nie ustawi tej zmiennej.

Testy i Chrome potwierdzają odmowę bez kodu/z błędnym kodem, brak utworzonego konta oraz sukces z prawidłowym kodem. Kod nie potwierdza tożsamości ani adresu e-mail. Przy przyszłej otwartej rejestracji potrzebny będzie osobny przepływ weryfikacji adresu i odzyskiwania konta; obecnie dostęp jest przeznaczony dla zaproszonych osób.

## Dodatkowo sprawdzone

- Uprawnienia właściciela, administratora i członka; odrzucanie cudzych zadań oraz nieaktualnych wersji; natychmiastowe odebranie dostępu po usunięciu z zespołu.
- Dostępność jest udostępniana dobrowolnie, bez tytułów prywatnych wydarzeń. Spotkanie wymaga akceptacji wszystkich uczestników.
- React renderuje dane jako tekst, bez `dangerouslySetInnerHTML`. Linki materiałów są walidowane po stronie serwera do http/https i otwierane z ograniczeniem referrera. Brak pobierania dowolnych URL przez backend, otwartych przekierowań, kodu z `eval` i publicznego uploadu plików wykonywalnych.
- Lockfile, audyt npm w CI i propozycje aktualizacji Dependabot. Kod nie wysyła danych do zewnętrznego kalendarza ani USOS API.

## Pozostałe czynności wdrożeniowe

Potrzebne są docelowa domena i VPS, rzeczywisty odbiór DNS/HTTPS/firewalla, kopia poza serwerem i monitoring. Nie wykonano skanu portów publicznego hosta, testu DDoS, niezależnego pentestu, testu obciążenia wielu równoczesnych studentów ani skanu podatności warstw systemowych kontenerów. Limity trzeba dostroić do ruchu i wspólnych adresów IP uczelni. Sekrety w środowisku kontenerów są dostępne administratorom Dockera; użytkownicy aplikacji nie powinni otrzymywać tego dostępu.

Nie stwierdzono dodatkowych potwierdzonych podatności w przejrzanym zakresie. Granice powyższego sprawdzenia są częścią wyniku audytu.
