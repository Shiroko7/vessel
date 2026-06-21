# Vessel

An [Owlbear Rodeo](https://www.owlbear.rodeo) extension that puts a live
submarine damage schematic in front of your table.

Built for a Barotrauma-flavoured campaign: the party crews a submersible called
the *Dugong*, things puncture it, and everyone needs to see which compartment is
flooding without the GM narrating a spreadsheet.

## What it does

A cutaway of the hull, always on screen. Every room and every hull section
carries HP, temp HP, and AC. The GM edits; every player's view updates live.
Damage is colour-coded by percentage — `pristine → damaged → heavy → critical →
destroyed` — so the state of the boat is legible at a glance from across the
table, which is the entire point of a status monitor.

Ballast tanks render with a fixed water-level fill, because they are supposed to
be full and a player asking "why is that room flooded" every session gets old.

## The synchronisation problem

This is the part worth reading. An extension like this has three requirements
that pull against each other: updates must be **instant** for everyone, must
**survive a refresh**, and must **recover** when a client misses a message.

`src/useVesselState.ts` uses all three OBR mechanisms rather than picking one:

1. **Room metadata is the source of truth.** `OBR.room.setMetadata` persists
   state in the room itself, so it survives refreshes and outlives any single
   client. On load, metadata authoritatively overwrites anything local.
2. **Broadcast is the fast path.** `OBR.broadcast.sendMessage(..., { destination: 'REMOTE' })`
   pushes GM edits to connected clients immediately. Metadata writes propagate,
   but not fast enough to feel like a live dashboard.
3. **Metadata change events are the safety net.** `OBR.room.onMetadataChange`
   catches clients that were reconnecting or otherwise not listening when a
   broadcast went out. Without this, a player who tabbed away at the wrong
   moment silently holds a stale hull until someone edits again.

On top of that, a `localStorage` cache renders the last known state
**synchronously on mount**, before the OBR SDK has finished initialising. That
removes the blank-panel flash on F5 — the schematic is there instantly and is
corrected a moment later if it was wrong. Uses a stable storage key independent
of schema version, so a schema bump does not orphan everyone's cache.

## Geometry

Rooms are authored as rectangles in a fixed `0 0 1240 470` viewBox. **Walls are
not authored at all** — `deriveWalls` computes them from the outer edges of the
room layout, so moving a room cannot leave a hull section floating in the wrong
place. The bow and stern caps are generated as SVG paths rather than rects to
get the curved hull profile.

There is an in-app layout editor with snap guides, so the *Dugong* can be
rearranged, or replaced with an entirely different boat, without touching code.

## Running it

```bash
bun install
bun run dev
```

Then add `http://localhost:5173/manifest.json` as a custom extension in Owlbear
Rodeo. `bun run build` produces a static bundle; the `netlify.toml` deploys it
as-is.

## Stack

React 19 + TypeScript, Vite, `@owlbear-rodeo/sdk` v3. Hand-written SVG for the
schematic — no charting or diagram library. Deploys as static files.

## Honest limitations

- **The hull is the Dugong.** Room layout is data (`src/dugongData.ts`) and
  editable in-app, but there is no import/export, so sharing a custom boat means
  sharing the file.
- No undo on stat edits.
- Only the GM should realistically be editing; the extension does not enforce
  this with a role check, it just assumes nobody is being a menace.
- No tests.
