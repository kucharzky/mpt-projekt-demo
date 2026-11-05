# Jeden backend z modułami, dwa npm workspaces

SmartUniPlanner rozwijamy jako `apps/web` (React/Vite) i `apps/api` (NestJS) w npm workspaces, z jedną bazą PostgreSQL. W pierwszym wdrożeniu backend podaje również zbudowany frontend pod tym samym origin. Domyślnie w development Node i zależności npm działają lokalnie, a PostgreSQL i pozostała infrastruktura w Dockerze; uruchomienie web w Dockerze jest opcjonalne. Architektura jest wdrożona w kodzie aplikacji.

Kalendarz, zadania, sesje pracy i propozycje należą do jednego modułu `planner`, ponieważ ich zmiany muszą być atomowe. Parser jest adapterem wejściowym, a scheduler czystym kodem domenowym wewnątrz backendu. Osobne pakiety npm wydzielimy po pojawieniu się dodatkowego konsumenta; przedwczesne wydzielanie mnoży konfigurację kompilacji i zależności bez poprawy izolacji reguł.

Kontrakt HTTP opisujemy w API i OpenAPI, z którego generujemy typy klienta. Modele Prisma pozostają wewnętrzne. Wybieramy ten podział zamiast współdzielenia pełnego modelu serwera przez `packages/shared`, aby frontend nie zależał od persystencji, dekoratorów i implementacji backendu. Osobna walidacja runtime jest obowiązkiem API.
