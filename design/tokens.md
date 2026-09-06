# Design tokens — UI Design.zip

Source: the `UI Design` folder (`Correo.dc.html`, `OSSidebar.dc.html`, `Pantallas.dc.html`).
Outfit + IBM Plex Mono. Cream paper, pine sidebar, terracotta actions.

Spec wins on architecture, access, and product copy. This drop wins on layout, color, type, and density.

## Color

| Token | Hex | Use |
|---|---|---|
| `paper` | `#E8E2D2` | app canvas |
| `wash` | `#F1ECDE` | list pane, page header |
| `sheet` | `#FFFDF7` | cards, message sheet |
| `cream` | `#F6F3EA` | sidebar text, selected nav |
| `ink` | `#12281C` | text, primary buttons |
| `pine` | `#0E2119` | sidebar |
| `gold` | `#C79350` | labels, selected mail bar |
| `sage` | `#5B8C6A` | task banners |
| `overdue` | `#C4622D` | unread badges, Crear tarea |

Mapped in `app/globals.css`.

## Type

- **Outfit** 300 / 400 / 500 / 600 / 700. Page title 34/700. Body 18–22 on desktop.
- **IBM Plex Mono** 400 / 500 for figures, dates, section labels. Never prose.

## Radius

11–13 chips and fields · 14–16 cards · 18–22 message sheets.

## Layout

Dark sidebar 300px. Top header 92px. Correo: 300 + 520 + remainder.
