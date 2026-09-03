# Prompt for Claude Design

> Paste everything below the line into Claude Design as a single message.

---

Design the interface for **Buena Vida OS**, an internal task app for a small
specialty-coffee and wellness company in Costa Rica. Deliver high-fidelity
screens plus a component sheet, not a marketing site.

## Who uses it

Twelve accounts. The founder and CEO (non-technical, runs the company from her
phone between meetings and the roastery), a commercial director, a head barista
who runs roasting and logistics, an administrator, and seven specialists —
roaster, warehouse, B2B sales, academy, design, regenerative impact, and the
CEO's assistant. There is also one external advisor with a restricted account
who sees only what is shared with him — his version of the app is nearly empty
by design, so the empty states matter more for him than for anyone else. All
native Spanish speakers in Costa Rica. **Every word of the
interface is in Spanish** — neutral Latin American register, no Spain-isms
(never *vosotros*, *vale*, *ordenador*). Sentence case, plain verbs.

Two thirds of use is on a phone, one-handed, often standing up. Design
mobile-first at 390px and let desktop be the adaptation, not the other way round.

## What it does

You either **tell it** ("crear tarea: llamar al proveedor de empaque, viernes,
alta") or **tap it**. Both paths write to the same task list. There is no
separate "AI section" — the chat is one of the app's screens, not a bolted-on
assistant.

## Screens

1. **Entrar** — email field, one button, magic-link sent state. That's the whole
   screen. No product marketing.
2. **Hoy** (default landing) — what's due today, what's overdue, what I'm
   assigned. The overdue group is the most important object on the screen and
   should be impossible to miss without being alarming; these are the founder's
   own late tasks and shame is not the goal.
3. **Chat** — conversation with the assistant. Message bubbles plus **result
   cards** (see below).
4. **Tareas** — full list with filters: team, area, assignee, status, due
   window. Needs to work with 400 rows. The CEO's version has a "ver todo"
   toggle that widens the list from her own teams to the whole company; design
   both states.
5. **Detalle de tarea** — opens as a bottom sheet on mobile, side panel on
   desktop. Title, notes, sector, owner, assignee, due date, priority, status,
   and an activity log of who changed what.
6. **Archivos** — the brand and shared-document library: logos, the brand guide,
   supplier documents. Replaces a shared Drive folder, so it has to be
   noticeably easier to scan than one: strong visual previews, no folder trees
   deeper than one level.
7. **Equipo** (admin only) — people, teams, who belongs to which team. Needs to
   show one person's multiple team memberships without becoming a spreadsheet.

## The component that matters most: the result card

When the assistant does something, the confirmation is **not** text in a message
bubble. It is a distinct card with three visual states. This distinction carries
the product's core promise: what the card says is read from the database, not
written by the assistant, so it is always true.

- **Guardando** — pending, in flight
- **Guardado** — verified write. Shows the actual saved values: title, date,
  priority, who it's assigned to. Tapping opens the task.
- **No se guardó** — the write failed. States plainly what didn't happen and
  what to do. Never apologetic, never vague, never a shrug emoji.

The failure state must be as visually resolved and deliberate as the success
state. If it looks like an afterthought, people will assume it's rare, and it
isn't.

## Other components

- Task row (list density: comfortable on mobile, compact on desktop)
- Priority indicator — four levels, and it must be legible without colour alone
- Due-date indicator, including an overdue treatment
- Team marker — eight teams, each identifiable at a glance:
  Comercial, Operaciones, USA, Academia, Marketing, Administración,
  Regenerativo, Dirección. Some people belong to six of them, so this marker
  does real work in a dense list.
- Assignee representation for people with no profile photo
- Empty states for: no tasks today, no results after filtering, first-ever
  conversation. Each is an invitation to act, not a decorative illustration.
- Error state for "no se pudo cargar"
- **Attachments on a task** — a drop zone, an upload-in-progress row, and the
  attached-file list inside the task detail sheet. Photos preview inline, PDFs
  open in an embedded viewer, other types are a download row. A phone photo of
  a shipping label is the most common upload; treat that as the primary case,
  not an edge case.
- Upload failure and file-too-large states
- Daily digest email (design the email too)

## Brand

Buena Vida is a Costa Rican specialty coffee and wellness brand. Its existing
identity is warm, natural, and considered — real product photography, a lot of
green and daylight, not rustic-farmhouse and not corporate-SaaS.

**Montserrat** is the licensed family already in use and is available to you. The
brand's display faces (Futura PT, Anissete) are not licensed for this project —
do not specify them. Montserrat alone across the interface is acceptable and
probably correct; if you want a second face for numerals or long text, pick
something clearly distinct and say why.

## Direction — constraints, read these

This brief invites a specific cliché and I want you to refuse it: **do not build
the cream-background / warm-terracotta / high-contrast-serif "artisan coffee"
page.** That is the default any designer produces from the word *coffee*, it
looks like every generated page on the internet right now, and it is wrong for
a tool someone opens forty times a day. Also avoid: identical rounded cards for
every content type, the same soft grey shadow under everything, tracked-out
all-caps eyebrow labels, arrows appended to button text.

This is a **working tool used daily by tired people**. Its job is legibility at
arm's length in bad light, a task capturable in under five seconds, and a state
that is never ambiguous. Spend your visual boldness in exactly one place — I'd
suggest the Hoy screen's handling of what's overdue — and keep everything else
quiet and dense.

Where the brand is warm and human, the interface should be **calm and precise**,
and that contrast is the design idea. The warmth belongs to the coffee. The app's
job is to not lose anyone's work.

## Deliverables

1. A short token system first: 4–6 named hex values, type scale with weights,
   spacing scale, radius scale. Show it before the screens.
2. The seven screens at 390px, plus Hoy, Tareas, and Archivos at desktop width.
3. The component sheet, with every state of the result card.
4. The digest email.

Use real Spanish content throughout — actual plausible tasks for a coffee
company and the real team names, never "Lorem ipsum" and never "Task 1 /
Task 2". Draw from: supplier and farm visits, roasting batches and cup
profiles, national deliveries and export shipments, B2B client proposals,
barista workshops, label design, invoice collections, and a regenerative
certification renewal.
