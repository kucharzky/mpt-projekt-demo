# Wdrożenie SmartUniPlanner na VPS

Wariant samodzielny: Docker Compose, Caddy, aplikacja NestJS serwująca zbudowany React, PostgreSQL i szyfrowane backupy Restic. Konfiguracja nie instaluje usług na laptopie. Publicznego VPS nie wdrożono; lokalna próba używała izolowanego projektu Compose i portów dostępnych wyłącznie z localhost.

## Przygotowanie serwera

Praktyczny punkt startowy to Linux z Docker Engine i Compose, 2 vCPU, 4 GB RAM oraz dysk SSD z miejscem na bazę, obrazy i retencję kopii. Limity kontenerów w Compose nie są wynikiem testu obciążenia — dostosuj je po pomiarach. Domena musi mieć rekord A wskazujący VPS; jeśli ma AAAA, IPv6 też musi prowadzić do tego serwera. Udostępnij 80/tcp, 443/tcp i opcjonalnie 443/udp. Dostęp SSH ogranicz do kluczy i zaufanych adresów, zgodnie z konfiguracją dostawcy. Włącz aktualizacje bezpieczeństwa systemu i monitorowanie miejsca na dysku.

Nie wystawiaj Docker API, PostgreSQL ani portu API aplikacji. Publikacja portów Dockera może omijać reguły UFW; sprawdź również firewall dostawcy i łańcuch DOCKER-USER. Konto w grupie `docker` traktuj jako administratora serwera. Repozytorium nie zmienia konfiguracji SSH ani zapory istniejącego serwera.

## Start

W katalogu repozytorium, z docelową domeną:

```sh
node scripts/production-setup.mjs planner.twoja-domena.pl administrator@twoja-domena.pl
docker compose --env-file deploy/.env.production -f compose.production.yml config --quiet
docker compose --env-file deploy/.env.production -f compose.production.yml up -d --build
docker compose --env-file deploy/.env.production -f compose.production.yml ps
```

Skrypt wymaga jedynie Node do jednorazowego wygenerowania konfiguracji. Na VPS bez Node uruchom go w kontenerze:

```sh
docker run --rm --user "$(id -u):$(id -g)" -v "$PWD:/work" -w /work node:24.22.2-bookworm-slim node scripts/production-setup.mjs planner.twoja-domena.pl administrator@twoja-domena.pl
```

Skrypt tworzy `deploy/.env.production` z losowymi sekretami i uprawnieniami `0600`, bez ich wypisywania. Zachowaj bezpieczną kopię tego pliku poza VPS, szczególnie `RESTIC_PASSWORD`; bez niego nie odtworzysz zaszyfrowanych danych. Plik jest ignorowany przez Git i Docker build. Nie wyświetlaj pełnego `docker compose config` w logach, ponieważ zawiera rozwinięte sekrety. Do walidacji używaj `config --quiet`.

Compose przekazuje sekrety jako zmienne środowiskowe tylko usługom, które ich potrzebują. Administrator Docker może je odczytać; nie przyznawaj tego dostępu użytkownikom aplikacji. API obsługuje również `DATABASE_URL_FILE`, `SESSION_SECRET_FILE` i `REGISTRATION_CODE_FILE`, jeśli operator ma osobny system sekretów i poprawnie ustawi uprawnienia plików.

Caddy nasłuchuje wewnątrz kontenera na nieuprzywilejowanych portach 8080/8443, mapowanych na publiczne 80/443. Działa jako UID 1000, bez capabilities. Jednorazowy `storage-init`, bez sieci, przygotowuje uprawnienia wolumenów certyfikatów i kopii. Admin API Caddy jest wyłączone. Certyfikaty są przechowywane w trwałym wolumenie.

Sieć proxy używa `172.30.91.0/24`; stały adres Caddy to `172.30.91.2`, a dynamiczna pula zaczyna się w drugiej połowie podsieci. Jeśli ten zakres koliduje z siecią VPS, zmień subnet, ip_range, adres Caddy i `TRUSTED_PROXIES` razem. Nie zastępuj zaufanego adresu przez `true`, liczbę przeskoków ani całą sieć prywatną.

Na produkcji utworzenie konta wymaga `REGISTRATION_CODE` z wygenerowanego pliku konfiguracyjnego. Przekaż go wyłącznie osobom, którym chcesz umożliwić rejestrację, poza publiczną stroną. Kod nie pojawia się w odpowiedzi API ani w bundle frontendu. Jest wspólny dla nowych rejestracji; jego rotacja nie blokuje wcześniej utworzonych kont. Lokalnie, bez tej zmiennej, rejestracja jest otwarta.

Po starcie sprawdź logowanie, zapis zadania, brak błędów konsoli, certyfikat domeny oraz brak dostępności portów 3001/5432 z internetu. `/api/health` jest dostępne dla kontroli kontenera, a na publicznym proxy zwraca 404. `restart: unless-stopped` wznawia proces po awarii, lecz sama niezdrowa kontrola Docker nie restartuje procesu — monitor powinien zgłaszać taki stan.

## Aktualizacje i sekrety

Przed aktualizacją wykonaj kopię. Uruchom testy i CI dla wybranej wersji, następnie pobierz zmiany i przebuduj obrazy. Migracje są wersjonowane i wykonywane przed startem API. Nie cofaj schematu bazy przez samą zamianę obrazu aplikacji; oceniaj zgodność migracji przed rollbackiem.

Hasła PostgreSQL ustawione przez `init-db.sh` są tworzone tylko przy inicjalizacji pustego wolumenu. Sama zmiana `.env.production` nie zmienia istniejącego hasła roli. Rotacja wymaga kontrolowanej zmiany hasła w PostgreSQL i odpowiadającego URL, a następnie odtworzenia właściwych kontenerów. Nie wpisuj haseł w historię powłoki. Zmiana `SESSION_SECRET` unieważnia sesje i zmienia klucze limitów żądań. Klucz repozytorium Restic rotuj narzędziami `restic key`, zachowując sprawdzoną możliwość odtworzenia.

Wersje obrazów są wskazane jawnie. Dependabot proponuje aktualizacje npm, Docker i GitHub Actions. `npm audit` działa również w CI. Przed publicznym wydaniem warto przypiąć zatwierdzone obrazy do digestów zgodnych z architekturą VPS i skanować warstwy systemowe obrazów — sam audyt npm nie obejmuje systemu operacyjnego.

## Kopie i odtwarzanie

Backup działa z rolą tylko do odczytu. Restic uruchamia `pg_dump` jako polecenie, więc błąd zrzutu nie zostaje uznany za poprawną pustą kopię. Kopie są szyfrowane przed zapisaniem, sprawdzane przez `restic check` i przechowywane według polityki 7 dziennych, 4 tygodniowych i 6 miesięcznych. Pierwsza kopia powstaje przy starcie, następne co 24 godziny. Niesprawny backup kończy proces i jest widoczny w logach; kontrola zdrowia sprawdza czas ostatniego sukcesu.

Ręczne wykonanie i lista kopii:

```sh
docker compose --env-file deploy/.env.production -f compose.production.yml exec -T backup /usr/local/bin/smartuni-backup once
docker compose --env-file deploy/.env.production -f compose.production.yml exec -T backup restic snapshots
```

Wolumen `backup_data` znajduje się na tym samym serwerze. Skonfiguruj regularny transfer zaszyfrowanego repozytorium poza VPS albo zmień `RESTIC_REPOSITORY` na własne repozytorium Restic (np. S3/SFTP), dodając wyłącznie potrzebne uprawnienia i połączenie wychodzące usługi backup. Obecna sieć `database` jest wewnętrzna; zdalny backend wymaga dodatkowej sieci z wyjściem. Dane dostępowe do zewnętrznego magazynu nie są skonfigurowane. Monitoruj powodzenie transferu i przetestuj odtworzenie z kopii zewnętrznej.

Odtwarzanie najpierw do nowej, pustej bazy:

```sh
umask 077
docker compose --env-file deploy/.env.production -f compose.production.yml exec -T backup restic dump latest /smartuniplanner.dump > /tmp/smartuni-restore.dump
docker compose --env-file deploy/.env.production -f compose.production.yml exec -T postgres createdb -U postgres -O smartuni_migrator smartuni_restore
docker compose --env-file deploy/.env.production -f compose.production.yml exec -T postgres pg_restore -U postgres --role=smartuni_migrator -d smartuni_restore --no-owner --no-acl --exit-on-error < /tmp/smartuni-restore.dump
```

Sprawdź dane oraz uprawnienia przed przełączeniem aplikacji. Zrzut zawiera dane prywatne mimo syntetycznych przykładów w testach; plik po odszyfrowaniu przechowuj krótko, z ograniczonym dostępem. Nie nadpisuj używanej bazy tymi poleceniami.

Po utracie całego VPS odtwórz repozytorium, konfigurację i repozytorium Restic. Uruchom najpierw tylko `postgres` (utworzy role), odtwórz dane do pustej bazy, potem uruchom migracje i aplikację. Migrator odbiera aplikacji dostęp do `_prisma_migrations` także po odtworzeniu. Wykonaj próbę logowania i zapisu. Utrata certyfikatów Caddy jest odwracalna przez ponowne wydanie, ale niepotrzebne odtwarzanie pustego wolumenu może uruchomić limity wystawcy.

## Odbiór przed udostępnieniem

Zweryfikuj docelowy DNS i certyfikat, firewall, alarmy dostępności i dysku, kopię poza VPS oraz jej odtworzenie. Dostosuj limity do rzeczywistego ruchu (wspólny adres IP akademika/uczelni może wymagać innych wartości). Zgodnie z decyzją użytkownika rejestracja produkcyjna wymaga kodu administratora. Nie weryfikuje własności adresu e-mail i nie ma automatycznego odzyskiwania hasła; zaproszenie wymaga tajnego kodu przekazywanego właściwej osobie. Przy otwartym wdrożeniu dla nieznanych użytkowników dodaj weryfikację adresu i odzyskiwanie konta przez uzgodnionego dostawcę poczty. Konta nie oznaczają potwierdzonej tożsamości studenta AGH.

Źródła konfiguracji: [Caddy — automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Caddy — reverse proxy i nagłówki](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy), [Restic — backup i stdin-from-command](https://restic.readthedocs.io/en/stable/040_backup.html).
