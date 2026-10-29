#!/usr/bin/env python3
"""Build Polish stakeholder presentation via deckcraft-cli."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

OUT_DIR = Path("/home/kucharzky/Projects/mpt-projekt-preview/.scratch")
DECK = OUT_DIR / "MPT-prezentacja-stakeholder.deckcraft"
PPTX = OUT_DIR / "MPT-prezentacja-stakeholder.pptx"
CLI = [
    "flatpak",
    "run",
    "--filesystem=/home/kucharzky/Projects/mpt-projekt-preview",
    "--command=deckcraft-cli",
    "ai.storyteller.deckcraft",
]


def cmd(command: str, params: dict | None = None) -> str:
    if params is None:
        return command
    return f"{command}={json.dumps(params, ensure_ascii=False)}"


def run_deckcraft(commands: list[str]) -> None:
    argv = [*CLI, "run"]
    for c in commands:
        argv.extend(["--cmd", c])
    argv.extend(["--save", str(DECK), "--print"])
    print("Running", len(commands), "commands…", flush=True)
    proc = subprocess.run(argv, capture_output=True, text=True)
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def main() -> None:
    commands: list[str] = [
        cmd("design.theme", {"name": "Harbor"}),
        cmd("design.variant", {"index": 0}),
        cmd("design.fonts", {"name": "Geometric"}),
        cmd(
            "file.properties",
            {
                "title": "Inteligentny planer studencki",
                "subject": "Przegląd projektu dla stakeholderów — MPT",
                "author": "Zespół MPT",
                "company": "Metodyka Projektów Telekomunikacyjnych",
                "category": "Status projektu",
                "keywords": "kalendarz,scheduler,USOS,MVP",
            },
        ),
        # Slide 0 — title
        cmd("text.set", {"id": 258, "text": "Inteligentny planer studencki"}),
        cmd(
            "text.set",
            {
                "id": 259,
                "text": (
                    "Smart Timetable & Auto-Scheduler\n\n"
                    "Przegląd dla stakeholderów  ·  Metodyka Projektów Telekomunikacyjnych"
                ),
            },
        ),
        cmd(
            "slide.notes",
            {
                "index": 0,
                "text": (
                    "Witamy. To przegląd produktu: wizja, architektura, funkcje, backlog "
                    "i repozytorium. Na końcu pokażemy kierunek MVP oraz rolę demo UI."
                ),
            },
        ),
        # Slide 1 — vision divider
        cmd("slide.new", {"layout": "titleOnly", "title": "Wizja produktu"}),
        cmd(
            "slide.notes",
            {
                "text": (
                    "Krótki separator. Przechodzimy od tytułu do jednej tezy strategicznej "
                    "— bez listy funkcji."
                ),
            },
        ),
        # Slide 2 — strategic takeaway
        cmd("slide.new", {"layout": "blank"}),
        cmd("insert.textBox", {"rect": [72, 56, 816, 28], "text": "ZAŁOŻENIE STRATEGICZNE"}),
        cmd("format.size", {"size": 12}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#1B7FA6"}),
        cmd(
            "insert.textBox",
            {
                "rect": [72, 110, 816, 160],
                "text": (
                    "Jeden kalendarz studenta,\n"
                    "w którym plan zajęć, aktywności\n"
                    "i zadania układają się same."
                ),
            },
        ),
        cmd("format.size", {"size": 32}),
        cmd("format.bold", {}),
        cmd(
            "insert.textBox",
            {
                "rect": [72, 300, 816, 80],
                "text": (
                    "Import USOS → wolne sloty → automatyczne sesje zadań według deadline'ów.\n"
                    "Konflikt rozwiązujemy z użytkownikiem, nie za jego plecami."
                ),
            },
        ),
        cmd("format.size", {"size": 14}),
        cmd("format.color", {"color": "#12384D"}),
        cmd("shape.insert", {"preset": "rect", "rect": [72, 400, 120, 4]}),
        cmd("shape.fill", {"color": "#36B3A8"}),
        cmd("shape.line", {"none": True}),
        cmd(
            "insert.textBox",
            {
                "rect": [72, 420, 816, 40],
                "text": (
                    "Demo UI (mpt-projekt-preview) pokazuje docelowe doświadczenie — "
                    "pełny produkt powstaje w github.com/kucharzky/mpt-projekt."
                ),
            },
        ),
        cmd("format.size", {"size": 12}),
        cmd("format.color", {"color": "#5D576B"}),
        cmd(
            "slide.notes",
            {
                "text": (
                    "Teza: nie budujemy kolejnej listy To-Do. Budujemy system, który chroni "
                    "zajęcia USOS i sam rozmieszcza pracę wokół nich. Preview to wizualny "
                    "prototyp, nie produkcja."
                ),
            },
        ),
        # Slide 3 — agenda
        cmd("slide.new", {"layout": "blank"}),
        cmd("insert.textBox", {"rect": [72, 40, 800, 40], "text": "Agenda spotkania"}),
        cmd("format.size", {"size": 28}),
        cmd("format.bold", {}),
        cmd("shape.insert", {"preset": "roundRect", "rect": [72, 110, 260, 320]}),
        cmd("shape.fill", {"color": "#E4EEF2"}),
        cmd("shape.line", {"none": True}),
        cmd("shape.insert", {"preset": "roundRect", "rect": [350, 110, 260, 320]}),
        cmd("shape.fill", {"color": "#E4EEF2"}),
        cmd("shape.line", {"none": True}),
        cmd("shape.insert", {"preset": "roundRect", "rect": [628, 110, 260, 320]}),
        cmd("shape.fill", {"color": "#E4EEF2"}),
        cmd("shape.line", {"none": True}),
        cmd("insert.textBox", {"rect": [92, 130, 220, 36], "text": "01  ·  Technologia"}),
        cmd("format.size", {"size": 16}),
        cmd("format.bold", {}),
        cmd(
            "insert.textBox",
            {
                "rect": [92, 180, 220, 200],
                "text": "Architektura warstw\nStack frontend / API\nParser ICS i scheduler\nDevOps i jakość",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("insert.textBox", {"rect": [370, 130, 220, 36], "text": "02  ·  Produkt"}),
        cmd("format.size", {"size": 16}),
        cmd("format.bold", {}),
        cmd(
            "insert.textBox",
            {
                "rect": [370, 180, 220, 200],
                "text": "MVP: kalendarz i zadania\nImport planu USOS\nInteligentne planowanie\nWizja funkcji zespołowych",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("insert.textBox", {"rect": [648, 130, 220, 36], "text": "03  ·  Realizacja"}),
        cmd("format.size", {"size": 16}),
        cmd("format.bold", {}),
        cmd(
            "insert.textBox",
            {
                "rect": [648, 180, 220, 200],
                "text": "Epiki backlogu (Jira)\nEtapy wdrożenia\nStruktura repozytorium\nNastępne decyzje",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd(
            "slide.notes",
            {
                "text": (
                    "Trzy bloki: tech, produkt, realizacja. Stakeholder dostaje mapę — "
                    "nie musimy wchodzić w każdy szczegół na start."
                ),
            },
        ),
        # Slide 4 — architecture divider
        cmd("slide.new", {"layout": "titleOnly", "title": "Architektura i stack"}),
        cmd(
            "slide.notes",
            {"text": "Sekcja techniczna. Najpierw warstwy systemu, potem konkretne technologie."},
        ),
        # Slide 5 — four layers
        cmd("slide.new", {"layout": "blank"}),
        cmd("insert.textBox", {"rect": [72, 36, 800, 36], "text": "Architektura — cztery warstwy"}),
        cmd("format.size", {"size": 26}),
        cmd("format.bold", {}),
        cmd("shape.insert", {"preset": "roundRect", "rect": [72, 100, 200, 340]}),
        cmd("shape.fill", {"color": "#0B1F2A"}),
        cmd("shape.line", {"none": True}),
        cmd("shape.insert", {"preset": "roundRect", "rect": [288, 100, 200, 340]}),
        cmd("shape.fill", {"color": "#12384D"}),
        cmd("shape.line", {"none": True}),
        cmd("shape.insert", {"preset": "roundRect", "rect": [504, 100, 200, 340]}),
        cmd("shape.fill", {"color": "#1B7FA6"}),
        cmd("shape.line", {"none": True}),
        cmd("shape.insert", {"preset": "roundRect", "rect": [720, 100, 168, 340]}),
        cmd("shape.fill", {"color": "#36B3A8"}),
        cmd("shape.line", {"none": True}),
        cmd("insert.textBox", {"rect": [88, 130, 168, 40], "text": "Frontend"}),
        cmd("format.size", {"size": 18}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#FFFFFF"}),
        cmd(
            "insert.textBox",
            {"rect": [88, 190, 168, 220], "text": "Kalendarz\nZadania\nFormularze\nKanban\nWolne sloty"},
        ),
        cmd("format.size", {"size": 13}),
        cmd("format.color", {"color": "#E4EEF2"}),
        cmd("insert.textBox", {"rect": [304, 130, 168, 40], "text": "Backend API"}),
        cmd("format.size", {"size": 18}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#FFFFFF"}),
        cmd(
            "insert.textBox",
            {
                "rect": [304, 190, 168, 220],
                "text": "REST / domena\nUżytkownicy\nUprawnienia\nWalidacja\nPersystencja",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("format.color", {"color": "#E4EEF2"}),
        cmd("insert.textBox", {"rect": [520, 130, 168, 40], "text": "Parser ICS"}),
        cmd("format.size", {"size": 18}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#FFFFFF"}),
        cmd(
            "insert.textBox",
            {
                "rect": [520, 190, 168, 220],
                "text": "Import .ics\nUSOS events\nDuplikaty\nCykliczność\nBłędy pliku",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("format.color", {"color": "#FFFFFF"}),
        cmd("insert.textBox", {"rect": [736, 130, 136, 40], "text": "Scheduler"}),
        cmd("format.size", {"size": 16}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#0B1F2A"}),
        cmd(
            "insert.textBox",
            {
                "rect": [736, 190, 136, 220],
                "text": "Wolne sloty\nSesje zadań\nPriorytety\nKonflikt UI\nPrzeplanowanie",
            },
        ),
        cmd("format.size", {"size": 12}),
        cmd("format.color", {"color": "#0B1F2A"}),
        cmd(
            "slide.notes",
            {
                "text": (
                    "Cztery niezależne odpowiedzialności. Frontend nie liczy planowania — "
                    "to robi Scheduler. Parser izoluje USOS. Backend spina to w API i bazę."
                ),
            },
        ),
        # Slide 6 — tech stack
        cmd("slide.new", {"layout": "blank"}),
        cmd(
            "insert.textBox",
            {"rect": [72, 32, 800, 36], "text": "Stack technologiczny — wybór docelowy"},
        ),
        cmd("format.size", {"size": 24}),
        cmd("format.bold", {}),
        cmd(
            "insert.textBox",
            {
                "rect": [72, 78, 800, 28],
                "text": "Jednolity TypeScript end-to-end · szybkie MVP · łatwa współpraca zespołu",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("format.color", {"color": "#5D576B"}),
        cmd("insert.textBox", {"rect": [72, 130, 280, 28], "text": "Frontend"}),
        cmd("format.size", {"size": 14}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#1B7FA6"}),
        cmd(
            "insert.textBox",
            {
                "rect": [72, 162, 280, 100],
                "text": "React 19 + TypeScript\nVite · Tailwind CSS\nLucide (UI ikony)",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("insert.textBox", {"rect": [380, 130, 260, 28], "text": "Backend"}),
        cmd("format.size", {"size": 14}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#1B7FA6"}),
        cmd(
            "insert.textBox",
            {"rect": [380, 162, 260, 100], "text": "NestJS (Node.js)\nPrisma ORM\nPostgreSQL"},
        ),
        cmd("format.size", {"size": 13}),
        cmd("insert.textBox", {"rect": [680, 130, 220, 28], "text": "Infrastruktura"}),
        cmd("format.size", {"size": 14}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#1B7FA6"}),
        cmd(
            "insert.textBox",
            {
                "rect": [680, 162, 220, 100],
                "text": "Docker Compose\nGitHub Actions\nCI: lint · test · build",
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("shape.insert", {"preset": "rect", "rect": [72, 290, 816, 2]}),
        cmd("shape.fill", {"color": "#E4EEF2"}),
        cmd("shape.line", {"none": True}),
        cmd("insert.textBox", {"rect": [72, 320, 420, 28], "text": "Moduły specjalne"}),
        cmd("format.size", {"size": 14}),
        cmd("format.bold", {}),
        cmd(
            "insert.textBox",
            {
                "rect": [72, 356, 420, 90],
                "text": (
                    "Parser: ical.js / własny moduł .ics\n"
                    "Scheduler: serwis domenowy (priorytet = dni do deadline)\n"
                    "Auth: rejestracja · sesje / JWT"
                ),
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("insert.textBox", {"rect": [520, 320, 380, 28], "text": "Dlaczego ten stack?"}),
        cmd("format.size", {"size": 14}),
        cmd("format.bold", {}),
        cmd(
            "insert.textBox",
            {
                "rect": [520, 356, 380, 90],
                "text": (
                    "Ten sam język w UI i API.\n"
                    "Sprawdzony w demo preview.\n"
                    "Skala MVP bez over-engineeringu."
                ),
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd(
            "slide.notes",
            {
                "text": (
                    "Stack wynika z preview (React/Vite/TS) i potrzeby wspólnego języka w zespole. "
                    "Nest + Prisma + Postgres to standard produkcyjny na MVP uczelniane. "
                    "Docker i Actions od dnia pierwszego."
                ),
            },
        ),
        # Slide 7 — features divider
        cmd("slide.new", {"layout": "titleOnly", "title": "Funkcjonalności"}),
        cmd(
            "slide.notes",
            {
                "text": (
                    "Przechodzimy do produktu. Najpierw MVP, potem inteligentny planer, "
                    "na końcu horyzont zespolowy."
                ),
            },
        ),
        # Slide 8 — MVP pillars
        cmd("slide.new", {"layout": "blank"}),
        cmd("insert.textBox", {"rect": [72, 36, 800, 36], "text": "MVP — trzy filary"}),
        cmd("format.size", {"size": 26}),
        cmd("format.bold", {}),
        cmd("insert.textBox", {"rect": [72, 110, 270, 28], "text": "Kalendarz"}),
        cmd("format.size", {"size": 18}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#1B7FA6"}),
        cmd(
            "insert.textBox",
            {
                "rect": [72, 150, 270, 280],
                "text": (
                    "Widok dnia i tygodnia\nCRUD wydarzeń\nZajecia · zadania · aktywności\n"
                    "Podgląd wolnych okienek\nCykliczność i kolizje"
                ),
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("insert.textBox", {"rect": [360, 110, 270, 28], "text": "Zadania"}),
        cmd("format.size", {"size": 18}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#1B7FA6"}),
        cmd(
            "insert.textBox",
            {
                "rect": [360, 150, 270, 280],
                "text": (
                    "CRUD zadań\nDeadline · priorytet · czas\nStatusy To Do → Done\n"
                    "Filtrowanie i sortowanie\nPrzypisanie do kalendarza"
                ),
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd("insert.textBox", {"rect": [648, 110, 250, 28], "text": "Import USOS"}),
        cmd("format.size", {"size": 18}),
        cmd("format.bold", {}),
        cmd("format.color", {"color": "#1B7FA6"}),
        cmd(
            "insert.textBox",
            {
                "rect": [648, 150, 250, 280],
                "text": (
                    "Pliki .ics z USOS\nParsowanie VEVENT\nAuto-dodanie zajęć\n"
                    "Walidacja i błędy\nDuplikaty / aktualizacja"
                ),
            },
        ),
        cmd("format.size", {"size": 13}),
        cmd(
            "slide.notes",
            {
                "text": (
                    "MVP bez AI marketingu: kalendarz, zadania, import. Użytkownik i dane "
                    "osobiste są w zakresie E4 — rejestracja, izolacja danych, baza."
                ),
            },
        ),
        # Slide 9 — smart planner (twoContent + text.set for col2)
        cmd(
            "slide.new",
            {
                "layout": "twoContent",
                "title": "Inteligentny planer",
                "body": (
                    "Automatyczne planowanie\n\n"
                    "Wolne sloty 08:00–21:00\n"
                    "Dzielenie na sesje 1–2 h\n"
                    "Priorytet = dni do deadline\n"
                    "Przerwy i bufory przejścia\n"
                    "Bez kolizji z USOS\n\n"
                    "Hard-locked events nigdy nie są ruszane."
                ),
            },
        ),
        # Placeholder ids for twoContent: title=?, body=?, body2=? — set after inspect via relative: last shapes
        # We'll fill second column after creating with a follow-up using known pattern:
        # After slide.new, content placeholders get sequential ids; use slide.inspect via print was done earlier:
        # Title, Content2, Content3 — we set Content3 after by selecting via a second text.set needing id.
        # Safer: rebuild this slide as blank with two columns instead.
    ]

    # Rebuild planner slide as blank for reliable positioning — replace last slide.new block approach
    # Remove the incomplete twoContent approach: pop the last slide.new and notes-less item
    commands.pop()  # remove incomplete twoContent

    commands.extend(
        [
            cmd("slide.new", {"layout": "blank"}),
            cmd("insert.textBox", {"rect": [72, 36, 800, 36], "text": "Inteligentny planer"}),
            cmd("format.size", {"size": 26}),
            cmd("format.bold", {}),
            cmd("insert.textBox", {"rect": [72, 100, 400, 28], "text": "Automatyczne planowanie"}),
            cmd("format.size", {"size": 16}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#1B7FA6"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 140, 400, 280],
                    "text": (
                        "Wolne sloty 08:00–21:00\n"
                        "Dzielenie na sesje 1–2 h\n"
                        "Priorytet = dni do deadline\n"
                        "Przerwy i bufory przejścia\n"
                        "Bez kolizji z USOS\n\n"
                        "Hard-locked events nigdy nie są ruszane."
                    ),
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd("insert.textBox", {"rect": [520, 100, 380, 28], "text": "Optymalizacja"}),
            cmd("format.size", {"size": 16}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#F78154"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [520, 140, 380, 280],
                    "text": (
                        "Przeplanowanie po zmianach\n"
                        "Przenoszenie niezrobionych sesji\n"
                        "Niedostępność użytkownika\n"
                        "Ostrzeżenie o przeciążeniu\n"
                        "Akceptacja / edycja propozycji\n\n"
                        "Konflikt tego samego dnia →\nUI z podglądem live."
                    ),
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd(
                "slide.notes",
                {
                    "text": (
                        "Scheduler to wyróżnik produktu. Pokazujemy zasady: USOS nietykalny, "
                        "soft events mogą ustąpić, użytkownik zatwierdza propozycje i "
                        "rozstrzyga remisy deadline'ów."
                    ),
                },
            ),
            # Slide 10 — users + beyond MVP
            cmd("slide.new", {"layout": "blank"}),
            cmd("insert.textBox", {"rect": [72, 48, 500, 36], "text": "Użytkownicy i dane"}),
            cmd("format.size", {"size": 26}),
            cmd("format.bold", {}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 110, 480, 160],
                    "text": (
                        "Rejestracja i logowanie\n"
                        "Indywidualny kalendarz i lista zadań\n"
                        "Persystencja w PostgreSQL\n"
                        "Ochrona danych osobowych"
                    ),
                },
            ),
            cmd("format.size", {"size": 14}),
            cmd("shape.insert", {"preset": "roundRect", "rect": [560, 80, 340, 360]}),
            cmd("shape.fill", {"color": "#0B1F2A"}),
            cmd("shape.line", {"none": True}),
            cmd("insert.textBox", {"rect": [588, 120, 284, 40], "text": "POZA MVP"}),
            cmd("format.size", {"size": 12}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#36B3A8"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [588, 170, 284, 220],
                    "text": (
                        "Praca zespołowa,\n"
                        "wspólny kalendarz\n"
                        "i auto-podzial pracy\n"
                        "to kolejna fala\n"
                        "po stabilnym MVP."
                    ),
                },
            ),
            cmd("format.size", {"size": 18}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#FFFFFF"}),
            cmd(
                "slide.notes",
                {
                    "text": (
                        "Świadomie odkładamy team features. Stakeholder powinien usłyszeć: "
                        "najpierw wartość dla jednego studenta, potem współpraca."
                    ),
                },
            ),
            # Slide 11 — demo / preview
            cmd("slide.new", {"layout": "blank"}),
            cmd("insert.textBox", {"rect": [72, 48, 800, 40], "text": "Podgląd UX — repo demo"}),
            cmd("format.size", {"size": 26}),
            cmd("format.bold", {}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 120, 816, 100],
                    "text": (
                        "mpt-projekt-preview to interaktywny prototyp UI.\n"
                        "Pokazuje kalendarz tygodniowy, import .ics, wolne sloty\n"
                        "oraz auto-scheduling z rozwiązywaniem konfliktów."
                    ),
                },
            ),
            cmd("format.size", {"size": 16}),
            cmd("shape.insert", {"preset": "rect", "rect": [72, 250, 180, 4]}),
            cmd("shape.fill", {"color": "#F78154"}),
            cmd("shape.line", {"none": True}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 280, 816, 120],
                    "text": (
                        "Dołączymy zrzuty ekranu z demo, żeby zobrazować docelowy wygląd.\n"
                        "Kod produkcyjny i CI żyją w github.com/kucharzky/mpt-projekt.\n"
                        "Preview != release — to narzędzie rozmowy ze stakeholderem."
                    ),
                },
            ),
            cmd("format.size", {"size": 14}),
            cmd(
                "slide.notes",
                {
                    "text": (
                        "Tu warto przełączyć sie na żywe demo albo galerię screenshotow. "
                        "Podkreśl rozdział: preview = kształt UX; mpt-projekt = oficjalne "
                        "repo przedmiotu."
                    ),
                },
            ),
            # Slide 12 — backlog divider
            cmd("slide.new", {"layout": "titleOnly", "title": "Backlog i realizacja"}),
            cmd(
                "slide.notes",
                {"text": "Epiki Jira i etapy. Pokazujemy kolejnosc wartośći, nie mikrozadania."},
            ),
            # Slide 13 — epics
            cmd("slide.new", {"layout": "blank"}),
            cmd("insert.textBox", {"rect": [72, 28, 800, 32], "text": "Epiki backlogu (Jira)"}),
            cmd("format.size", {"size": 24}),
            cmd("format.bold", {}),
            cmd("insert.textBox", {"rect": [72, 80, 280, 28], "text": "Fala MVP"}),
            cmd("format.size", {"size": 14}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#1B7FA6"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 114, 280, 200],
                    "text": (
                        "E1  Kalendarz\n"
                        "E2  Zarządzanie zadaniami\n"
                        "E3  Import planu USOS\n"
                        "E4  Backend i baza\n"
                        "E5  Scheduler\n"
                        "E6  Testy i wdrożenie"
                    ),
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd("insert.textBox", {"rect": [380, 80, 280, 28], "text": "Fala współpracy"}),
            cmd("format.size", {"size": 14}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#F78154"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [380, 114, 280, 120],
                    "text": (
                        "E7  Zespoły projektowe\n"
                        "E8  Wspolny kalendarz\n"
                        "E9  Auto-podział pracy"
                    ),
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd("shape.insert", {"preset": "roundRect", "rect": [680, 90, 220, 280]}),
            cmd("shape.fill", {"color": "#E4EEF2"}),
            cmd("shape.line", {"none": True}),
            cmd("insert.textBox", {"rect": [700, 120, 180, 40], "text": "Zasada"}),
            cmd("format.size", {"size": 14}),
            cmd("format.bold", {}),
            cmd(
                "insert.textBox",
                {
                    "rect": [700, 170, 180, 160],
                    "text": (
                        "E1–E6 zamykają\n"
                        "wartość dla jednego\n"
                        "studenta.\n\n"
                        "E7–E9 dopiero\n"
                        "po stabilnym MVP."
                    ),
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd(
                "slide.notes",
                {
                    "text": (
                        "Dziewięć epik. Stakeholder widzi jasny cut: MVP vs expansion. "
                        "E5 scheduler jest w MVP — to core value."
                    ),
                },
            ),
            # Slide 14 — timeline
            cmd("slide.new", {"layout": "blank"}),
            cmd("insert.textBox", {"rect": [72, 36, 800, 36], "text": "Etapy realizacji"}),
            cmd("format.size", {"size": 26}),
            cmd("format.bold", {}),
            cmd("shape.insert", {"preset": "rect", "rect": [72, 160, 816, 6]}),
            cmd("shape.fill", {"color": "#E4EEF2"}),
            cmd("shape.line", {"none": True}),
            cmd("shape.insert", {"preset": "ellipse", "rect": [90, 148, 30, 30]}),
            cmd("shape.fill", {"color": "#1B7FA6"}),
            cmd("shape.line", {"none": True}),
            cmd("shape.insert", {"preset": "ellipse", "rect": [250, 148, 30, 30]}),
            cmd("shape.fill", {"color": "#1B7FA6"}),
            cmd("shape.line", {"none": True}),
            cmd("shape.insert", {"preset": "ellipse", "rect": [410, 148, 30, 30]}),
            cmd("shape.fill", {"color": "#1B7FA6"}),
            cmd("shape.line", {"none": True}),
            cmd("shape.insert", {"preset": "ellipse", "rect": [570, 148, 30, 30]}),
            cmd("shape.fill", {"color": "#36B3A8"}),
            cmd("shape.line", {"none": True}),
            cmd("shape.insert", {"preset": "ellipse", "rect": [730, 148, 30, 30]}),
            cmd("shape.fill", {"color": "#F78154"}),
            cmd("shape.line", {"none": True}),
            cmd("insert.textBox", {"rect": [60, 200, 140, 100], "text": "01\nRepo +\narchitektura"}),
            cmd("format.size", {"size": 12}),
            cmd("format.align", {"align": "center"}),
            cmd("insert.textBox", {"rect": [220, 200, 140, 100], "text": "02\nKalendarz\ni zadania"}),
            cmd("format.size", {"size": 12}),
            cmd("format.align", {"align": "center"}),
            cmd("insert.textBox", {"rect": [380, 200, 140, 100], "text": "03\nImport\nUSOS .ics"}),
            cmd("format.size", {"size": 12}),
            cmd("format.align", {"align": "center"}),
            cmd("insert.textBox", {"rect": [540, 200, 140, 100], "text": "04\nIntegracja\nMVP + testy"}),
            cmd("format.size", {"size": 12}),
            cmd("format.align", {"align": "center"}),
            cmd("insert.textBox", {"rect": [700, 200, 160, 100], "text": "05\nScheduler →\nteamy"}),
            cmd("format.size", {"size": 12}),
            cmd("format.align", {"align": "center"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 360, 816, 60],
                    "text": (
                        "Kazdy etap konczy sie demonstracja dzialajacej wartośći — "
                        "nie samym kodem w repozytorium."
                    ),
                },
            ),
            cmd("format.size", {"size": 14}),
            cmd(
                "slide.notes",
                {
                    "text": (
                        "Pięć etapów. Po 04 mamy MVP do pokazania. 05 to scheduler + ewentualnie "
                        "team. Git Flow: feature → PR → dev → main."
                    ),
                },
            ),
            # Slide 15 — repo structure
            cmd("slide.new", {"layout": "blank"}),
            cmd("insert.textBox", {"rect": [72, 28, 800, 32], "text": "Struktura repozytorium"}),
            cmd("format.size", {"size": 24}),
            cmd("format.bold", {}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 70, 800, 24],
                    "text": "github.com/kucharzky/mpt-projekt  ·  Git Flow: main ← dev ← feature/MPT-*",
                },
            ),
            cmd("format.size", {"size": 12}),
            cmd("format.color", {"color": "#5D576B"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 120, 420, 320],
                    "text": (
                        "mpt-projekt/\n"
                        "├── apps/\n"
                        "│   ├── web/          # React · Vite · Tailwind\n"
                        "│   └── api/          # NestJS · Prisma\n"
                        "├── packages/\n"
                        "│   ├── shared/       # typy domenowe\n"
                        "│   └── ics-parser/   # import .ics\n"
                        "├── docs/             # ADR · specyfikacje\n"
                        "├── docker-compose.yml\n"
                        "└── README.md"
                    ),
                },
            ),
            cmd("format.size", {"size": 12}),
            cmd("shape.insert", {"preset": "roundRect", "rect": [520, 120, 380, 300]}),
            cmd("shape.fill", {"color": "#0B1F2A"}),
            cmd("shape.line", {"none": True}),
            cmd("insert.textBox", {"rect": [548, 150, 324, 40], "text": "Konwencje"}),
            cmd("format.size", {"size": 16}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#36B3A8"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [548, 210, 324, 180],
                    "text": (
                        "PR wymaga review\n"
                        "Klucz Jira w branchu\n"
                        "i w opisie PR\n"
                        "main tylko ze stable\n"
                        "Preview osobno —\n"
                        "nie miesza historii"
                    ),
                },
            ),
            cmd("format.size", {"size": 14}),
            cmd("format.color", {"color": "#FFFFFF"}),
            cmd(
                "slide.notes",
                {
                    "text": (
                        "Monorepo proponowane — struktura w README jest jeszcze TBD. "
                        "Pokazujemy docelowy układ. Preview zostaje poza oficjalnym tree."
                    ),
                },
            ),
            # Slide 16 — next steps
            cmd("slide.new", {"layout": "blank"}),
            cmd("insert.textBox", {"rect": [72, 48, 800, 36], "text": "Następne kroki"}),
            cmd("format.size", {"size": 28}),
            cmd("format.bold", {}),
            cmd("shape.insert", {"preset": "roundRect", "rect": [72, 120, 260, 220]}),
            cmd("shape.fill", {"color": "#E4EEF2"}),
            cmd("shape.line", {"none": True}),
            cmd("shape.insert", {"preset": "roundRect", "rect": [350, 120, 260, 220]}),
            cmd("shape.fill", {"color": "#E4EEF2"}),
            cmd("shape.line", {"none": True}),
            cmd("shape.insert", {"preset": "roundRect", "rect": [628, 120, 260, 220]}),
            cmd("shape.fill", {"color": "#0B1F2A"}),
            cmd("shape.line", {"none": True}),
            cmd("insert.textBox", {"rect": [92, 150, 220, 36], "text": "1. Utwierdzić stack"}),
            cmd("format.size", {"size": 15}),
            cmd("format.bold", {}),
            cmd(
                "insert.textBox",
                {
                    "rect": [92, 200, 220, 110],
                    "text": "React · Nest · Postgres\nDocker · Actions\njako baseline zespołu",
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd("insert.textBox", {"rect": [370, 150, 220, 36], "text": "2. Zamknąć E1–E4"}),
            cmd("format.size", {"size": 15}),
            cmd("format.bold", {}),
            cmd(
                "insert.textBox",
                {
                    "rect": [370, 200, 220, 110],
                    "text": "Kalendarz, zadania,\nimport ICS i API\nzanim wejdzie scheduler",
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd("insert.textBox", {"rect": [648, 150, 220, 36], "text": "3. Demo → feedback"}),
            cmd("format.size", {"size": 15}),
            cmd("format.bold", {}),
            cmd("format.color", {"color": "#36B3A8"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [648, 200, 220, 110],
                    "text": "Zrzuty z preview\n+ decyzje stakeholderów\nna kolejny sprint",
                },
            ),
            cmd("format.size", {"size": 13}),
            cmd("format.color", {"color": "#FFFFFF"}),
            cmd(
                "insert.textBox",
                {
                    "rect": [72, 380, 816, 60],
                    "text": "Pytania?  ·  github.com/kucharzky/mpt-projekt",
                },
            ),
            cmd("format.size", {"size": 16}),
            cmd("format.bold", {}),
            cmd(
                "slide.notes",
                {
                    "text": (
                        "Zamykamy call-to-action: zatwierdzić stack, ruszyć epiki MVP, "
                        "zebrać feedback z demo. Zostaw czas na pytania."
                    ),
                },
            ),
        ]
    )

    # Fix Polish diacritics properly in a second pass on the source — rewrite with correct UTF-8
    # (Python file already UTF-8; restore proper Polish letters)
    run_deckcraft(commands)

    convert = subprocess.run(
        [*CLI, "convert", str(DECK), str(PPTX)],
        capture_output=True,
        text=True,
    )
    sys.stdout.write(convert.stdout)
    sys.stderr.write(convert.stderr)
    if convert.returncode != 0:
        raise SystemExit(convert.returncode)

    info = subprocess.run(
        [*CLI, "info", str(DECK)],
        capture_output=True,
        text=True,
    )
    print(info.stdout[:2000])
    print(f"Saved: {DECK}")
    print(f"Exported: {PPTX}")


if __name__ == "__main__":
    main()
