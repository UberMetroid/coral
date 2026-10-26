# AGENTS.md — Coral Architectural Invariants & Engineering Standards

## 1. Global Engineering Philosophy

Coral (`coral@ubermetroid.github.io`) is built on four uncompromising engineering pillars:

1. **Linus Torvalds' "Good Taste"**: Eliminate special-case branching through clean data representation (immutable frozen category tables, pure alphabetical comparators, and deterministic greedy overflow-page prevention planning).
2. **UNIX Philosophy**: Each module ("page") does one thing well, composes cleanly via explicit ES2022 imports, and avoids hidden global state.
3. **NASA JPL Power-of-10 Safety Rules**:
   - All category bucket evaluations (`auto_grouper.js`), folder-children traversals (`folder_sorter.js`), and AppGrid item comparisons (`grid_sorter.js`) enforce explicit upper iteration bounds (`MAX_GRID_APPS = 512`, `MAX_FOLDERS = 64`).
   - Zero dynamic code evaluation (`eval`, `Function`) and zero external subprocesses (`Gio.Subprocess`, `GLib.spawn_*`) in the compositor.
   - All `GLib.timeout_add` sources are deterministically named via `GLib.Source.set_name_by_id` and removed on teardown.
4. **OWASP Zero-Trust & Multi-Distro Security**:
   - Zero shell subprocesses or network calls; integrates natively with `systemd-logind` lock/suspend and `org.gnome.desktop.app-folders` GSettings across Fedora, Debian, Ubuntu, Arch, openSUSE, and NixOS.
   - Zero module-scope compositor access (`Main.overview._overview._controls` is accessed strictly inside `enable()`).

---

## 2. The Page Rule & Directory Density (Enforced by `tests/verify.js`)

- **File Line Bounds**: Every `.js` source file in the repository (`extension/`, `tests/`) **must** be between **16 and 256 lines** (`16..=256`), and every line **must** be at most **200 characters** (`<= 200`).
- **Directory Density**: Every directory in the repository (`root`, `tests/`, `extension/`, and all subdirectories) **must** contain **at most 8 visible entries** (`<= 8`).
- **Banned Generic Names**: Generic grab-bag names (`util`, `utils`, `lib`, `helper`, `helpers`, `common`, `misc`, `shared`, `base`, `core`, `types`, `mod`) are strictly forbidden.
- **2-Line SPDX + Concise Module Header**:
   - Line 1 of every `.js` file must be `// SPDX-License-Identifier: GPL-3.0-or-later`.
   - Line 2 of every `.js` file must be a concise single-line module description (`// <Concise module description>`).

---

## 3. Process-Boundary & GNOME Shell / EGO Lifecycle Invariants (`tests/verify.js`)

- **ES2022 Strictness**: Zero `var` declarations (`const`/`let` only) and zero loose equality operators (`===`/`!==` only).
- **Process Boundary Separation**: `extension/prefs.js` runs in the GTK4 `gnome-extensions-app` process. Neither `prefs.js` nor any module in its import chain (`grid/grid_sorter.js`, `grid/auto_grouper.js`, `grid/folder_sorter.js`, `ui/folder_style.js`, `ui/settings/gsettings.js`, `ui/settings/color.js`, `ui/settings/prefs_pages.js`) may import compositor-only typelibs (`gi://Meta`, `gi://Clutter`, `gi://St`, `gi://Shell`, `resource:///org/gnome/shell/*`).
- **Deterministic EGO Teardown**: `extension/extension.js` performs zero top-level work at import time and deterministically cleans up all `InjectionManager` overrides, `connectObject` listeners, named `GLib` timers, and loaded stylesheets on `disable()`.

---

## 4. Functional Page Map

### Verification & Test Suite (`tests/` — 1 page)
- [`tests/verify.js`](tests/verify.js): Zero-dependency GJS architectural lint, Page Rule (`16..=256` lines, `<= 8` entries/dir), process-boundary check, GTK4/Libadwaita Preferences inspection, and headless behavioral test suite (`gjs -m tests/verify.js`).

### GNOME Shell Extension (`extension/` — 11 JS pages across 2 domain trees)
- **Root Entrypoints**:
  - [`extension/extension.js`](extension/extension.js): `CoralExtension extends Extension` EGO lifecycle entrypoint.
  - [`extension/prefs.js`](extension/prefs.js): `CoralPreferences extends ExtensionPreferences` 3-tab GTK4 / Libadwaita preferences UI.
- **App Grid, Smart Auto-Grouper & Folder Sorting Engine (`extension/grid/` — 5 pages)**:
  - [`grid_manager.js`](extension/grid/grid_manager.js): Lifecycle coordinator, `InjectionManager` patching, Overview/AppSystem/GSettings signals, and named `[coral] reorder-grid` timer.
  - [`grid_sorter.js`](extension/grid/grid_sorter.js): Pure alphabetical and folder-position comparators (`alphabetical_compare`, `compare_grid_items`, `sort_desktop_ids_by_name`).
  - [`auto_grouper.js`](extension/grid/auto_grouper.js): Pure Freedesktop `.desktop` category classifier and greedy overflow-page prevention planner (`plan_overflow_grouping`).
  - [`folder_sorter.js`](extension/grid/folder_sorter.js): `org.gnome.desktop.app-folders` synchronizer, alphabetical folder-content sorter, and `dissolve_coral_folders()` unpacker.
  - [`grid_redisplay.js`](extension/grid/grid_redisplay.js): `AppDisplay` `_compareItems`, `_redisplay`, and `_loadApps` override implementations plus favorite-apps and reset-page-on-open handlers.
- **UI, Folder Styling & Settings (`extension/ui/` — 4 JS pages + stylesheet)**:
  - [`folder_style.js`](extension/ui/folder_style.js), `stylesheet.css`
  - `settings/`: [`color.js`](extension/ui/settings/color.js), [`gsettings.js`](extension/ui/settings/gsettings.js), [`prefs_pages.js`](extension/ui/settings/prefs_pages.js)
