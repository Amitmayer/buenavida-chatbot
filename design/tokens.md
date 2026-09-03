# Design tokens — Buena Vida app redesign

Source: `design/redesign/Buena Vida OS.dc.html` (zip drop). Cream paper, pine sidebar, gold accent.

Spec wins on architecture, access, and product copy. This drop wins on layout, color, type, and density.

## Color

| Token | Hex | Use |
|---|---|---|
| `paper` | `#F6F3EA` | app canvas |
| `sheet` | `#FFFDF7` | cards, fields, inbox |
| `ink` | `#17301F` | text |
| `pine` | `#12281C` | sidebar, primary buttons |
| `gold` | `#C79350` | accent, active inset, hero rings |
| `sage` | `#7C9A6B` | avatars, week bars |
| `overdue` | `#C0562F` | overdue, unread, failure |
| `wash` | `#EDEBDF` | table header, pills |
| `hover` | `#F1EEE3` | row hover |
| `cream` | `#E8E4D6` | sidebar text |

Mapped in `app/globals.css`.

## Type

- **Jost** 400 / 500 / 600. Page title 19/600. Body 13–14.
- **JetBrains Mono** 400 / 500 for figures only: dates, counts, section labels. Never prose.

## Radius

8–9 chips and fields · 12 cards · 14 file cards and tables · 16 hero.

## Layout

Dark sidebar 252px. Top header 62px with title, search, Nueva tarea. Content on paper.

Áreas in the sidebar are real teams from the database, not fictional labs from the prototype.
Keep Canales in Trabajo. Do not add roast widgets or invented clock times on `due_date`.
