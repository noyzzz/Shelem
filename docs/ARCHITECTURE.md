# Frontend architecture

The frontend groups code by feature and separates components from logic.
Use hooks, model, and API folders where they help navigation. Small features can
keep shared types in a single file at the feature root.

| Folder                 | Responsibility                                                 |
| ---------------------- | -------------------------------------------------------------- |
| `src/app`              | Start the app, select screens, and manage navigation.          |
| `src/screens`          | Combine features into complete screens.                        |
| `src/domain`           | Shared game types and pure card and seat functions.            |
| `src/features/account` | Account requests, sign-in state, and account controls.         |
| `src/features/game`    | Room connection, game actions, status text, and game panels.   |
| `src/features/table`   | Table view models, DOM and 3D renderers, and scene lifecycle.  |
| `src/features/media`   | LiveKit connection, device selection, and participant video.   |
| `src/components`       | Shared visual components. `ui` contains the shadcn primitives. |
| `src/lib`              | Small shared utilities.                                        |
| `src/styles`           | Global styles and theme variables.                             |
| `src/types`            | Declarations for external libraries and browser APIs.          |

## Dependencies

- Domain functions use explicit inputs. They do not import React, browser APIs,
  or network clients.
- API modules own network requests and connection state.
- Hooks connect APIs and browser effects to React state.
- Components receive data and action callbacks. They do not use the game client.
- Screens connect features. Cross-feature data types and pure display helpers
  can be shared, but features do not import another feature's connection hooks.
- Keep a helper beside its owner until it has another use. Do not create a
  shared abstraction only to reduce the size of a file.

## Room and account state

`App` mounts `useRoomSession` once. Home, setup, and the game screen use the same
room connection and player identity. `useGameActions` owns state for the active
room, including bids, selected cards, pending actions, and trick acknowledgements.

`GameRoomScreen` owns its layout. Shared display text functions stay together in
`features/game/model/gameView.ts`.

`useAccount` owns account state at the app level. `AccountPanel` renders that
state. Opening the panel refreshes the account and match totals. The app closes
the panel when the screen changes and supplies the guest player ID for match
claims.

## Table rendering

`GameRoomScreen` builds one `TableViewModel`. Both `VirtualTable` and `DomTable`
receive it. Card order, legal card selection, seat position, readiness, and turn
status therefore use the same calculations.

`features/table/model` contains renderer-independent data. `scene` contains
Three.js objects, geometry, animation, camera settings, and projection types.
`useTableScene` owns scene creation, resizing, updates, and disposal. The game
table and menu table share this lifecycle.

`MenuTableScene` keeps its fixed preview data outside the component function in
the same file.

If the 3D renderer fails, the screen selects the DOM renderer. The
`?renderer=dom` URL option selects it directly and remains set during navigation.

## Seat video

`SeatVideoTarget` registers each mounted seat element through a callback.
`GameRoomScreen` passes the resulting elements to the media feature. Participant
videos use React portals to render into these elements. No element-ID convention
or document-wide mutation observer is required. The same registration handles
seat changes, renderer changes, and the mobile hand layout.

The game screen loads media code on demand. It supplies the media credential
request callback. Media code does not import the game client.
Shared media types are in `features/media/types.ts`.

## Configuration

The `@/` alias resolves to `src`. Keep `components/ui` and `lib/utils` aligned
with `components.json`. The configured global stylesheet is
`src/styles/globals.css`.
