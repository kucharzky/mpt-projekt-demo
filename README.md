# Projekt [NAZWA TBD] – Metodyka Projektów

Oficjalne repozytorium kodu, konfiguracji oraz dokumentacji projektu realizowanego w ramach przedmiotu **Metodyka Projektów Telekomunikacyjnych**.

## Zespół Projektowy

 Imię i nazwisko | Rola w projekcie | GitHub |
| :--- | :--- | :--- |
| **Maciej Kucharski** | | [@kucharzky](https://github.com/kucharzky) |
| **Adrian Homa** |  | [@AH-repo](https://github.com/AH-repo) |
| **Michał Górka** |  | [@migorka](https://github.com/migorka) |
| **Mateusz Kosek** |  | [@Mateusz-AGH](https://github.com/Mateusz-AGH) |
| **Mikołaj Zielniok** |  | [@w1nn3t0u-o7](https://github.com/w1nn3t0u-o7) |
| **Maciej Dyrdał** |  | ... |
| **Mateusz Purol** |  | [@Skaaty](https://github.com/Skaaty) |
| **Mateusz Kulak** |  | ... |

---

## Git Flow

W projekcie stosujemy uproszczony model **Git Flow**, aby zapewnić porządek w wersjonowaniu.

### 1. Gałęzie główne (Protected Branches)
* **`main`** – Gałąź produkocja / stabilna. Zawiera wyłącznie w pełni przetestowane wersje projektu, gotowe do oddania prowadzącemu. Brak bezpośrednich commitów (tylko poprzez Merge Request z `dev`).
* **`dev`** – Gałąź integracyjna. Tutaj scalane są poszczególne zadania przed ostatecznym zatwierdzeniem.

### 2. Gałęzie robocze (Feature / Bugfix Branches)
Prace nad nowymi elementami wykonujemy na osobnych gałęziach tworzonych z gałęzi `dev`. Nazewnictwo gałęzi musi zawierać klucz zadania z systemu Jira (np. `MPT-12`):
* `feature/MPT-[numer]-nazwa-zadania` (np. `feature/MPT-14-intial-configuration`)
* `bugfix/MPT-[numer]-opis-problemu` (np. `bugfix/MPT-19-prod-fix`)

### 3. Zasada Pull Request / Merge Request
* Każda zmiana z gałęzi `feature/*` trafia do `dev` poprzez **Pull Request**.
* Wymagana jest weryfikacja kodu/konfiguracji przez przynajmniej jednego innego członka zespołu przed scaleniem.
* W opisie każdego commita oraz Pull Requesta należy umieścić klucz zadania z Jiry (np. `resolved MPT-14`), co automatycznie spina kod z systemem śledzenia zadań.

---

## Struktura Repozytorium [TBD]
