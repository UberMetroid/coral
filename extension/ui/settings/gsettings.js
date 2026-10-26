// SPDX-License-Identifier: GPL-3.0-or-later
// Data-driven GSettings wrapper for Coral App Grid, Smart Auto-Groups, and App Folder styling.

import { format_rgba, parse_rgba } from './color.js';

export const FOLDER_POSITIONS = Object.freeze(['alphabetical', 'start', 'end']);
export const AUTO_GROUP_MODES = Object.freeze(['overflow-only', 'all-categories']);

const SCHEMA_SPEC = Object.freeze({
    folder_order_position: Object.freeze({ key: 'folder-order-position', type: 'enum', values: FOLDER_POSITIONS, def: 'alphabetical' }),
    sort_folder_contents: Object.freeze({ key: 'sort-folder-contents', type: 'bool', def: true }),
    auto_group_overflow: Object.freeze({ key: 'auto-group-overflow', type: 'bool', def: true }),
    auto_group_mode: Object.freeze({ key: 'auto-group-mode', type: 'enum', values: AUTO_GROUP_MODES, def: 'overflow-only' }),
    max_items_per_page: Object.freeze({ key: 'max-items-per-page', type: 'int', min: 12, max: 48, def: 24 }),
    reverse_order: Object.freeze({ key: 'reverse-order', type: 'bool', def: false }),
    show_favorite_apps: Object.freeze({ key: 'show-favorite-apps', type: 'bool', def: false }),
    reset_page_on_open: Object.freeze({ key: 'reset-page-on-open', type: 'bool', def: true }),
    show_folder_border: Object.freeze({ key: 'show-folder-border', type: 'bool', def: true }),
    border_width: Object.freeze({ key: 'border-width', type: 'int', min: 0, max: 8, def: 2 }),
    border_radius: Object.freeze({ key: 'border-radius', type: 'int', min: 0, max: 36, def: 24 }),
    border_color_rgba: Object.freeze({ key: 'border-color-rgba', type: 'rgba', def: 'rgb(255,0,0)' }),
});

function clamp_int(v, min, max, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

export class ExtensionSettings {
    constructor(gio_settings) {
        this.gio = gio_settings;
    }

    _has(key) {
        return Boolean(this.gio && this.gio.settings_schema?.has_key(key));
    }

    _read(spec) {
        if (!this._has(spec.key)) {
            return spec.type === 'rgba' ? format_rgba(parse_rgba(spec.def)) : spec.def;
        }
        if (spec.type === 'bool') return this.gio.get_boolean(spec.key);
        if (spec.type === 'int') return clamp_int(this.gio.get_int(spec.key), spec.min, spec.max, spec.def);
        if (spec.type === 'enum') {
            const raw = this.gio.get_string(spec.key);
            return spec.values.includes(raw) ? raw : spec.def;
        }
        return format_rgba(parse_rgba(this.gio.get_string(spec.key)));
    }

    _write(spec, val) {
        if (!this._has(spec.key)) return;
        if (spec.type === 'bool') {
            this.gio.set_boolean(spec.key, Boolean(val));
        } else if (spec.type === 'int') {
            const clamped = clamp_int(val, spec.min, spec.max, spec.def);
            if (this.gio.get_int(spec.key) !== clamped) this.gio.set_int(spec.key, clamped);
        } else if (spec.type === 'enum') {
            this.gio.set_string(spec.key, spec.values.includes(val) ? val : spec.def);
        } else {
            this.gio.set_string(spec.key, format_rgba(parse_rgba(val)));
        }
    }

    reset_defaults() {
        for (const spec of Object.values(SCHEMA_SPEC)) {
            this._write(spec, spec.def);
        }
    }
}

for (const [prop, spec] of Object.entries(SCHEMA_SPEC)) {
    ExtensionSettings.prototype[prop] = function () { return this._read(spec); };
    ExtensionSettings.prototype[`set_${prop}`] = function (v) { this._write(spec, v); };
}
