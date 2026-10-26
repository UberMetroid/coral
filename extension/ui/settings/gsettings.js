// SPDX-License-Identifier: GPL-3.0-or-later
// Typed GSettings wrapper for Coral App Grid, Smart Auto-Groups, and App Folder styling.

import { format_rgba, parse_rgba } from './color.js';

export const FOLDER_POSITIONS = Object.freeze(['alphabetical', 'start', 'end']);
export const AUTO_GROUP_MODES = Object.freeze(['overflow-only', 'all-categories']);

const DEFAULTS = Object.freeze({
    folder_order_position: 'alphabetical',
    sort_folder_contents: true,
    auto_group_overflow: true,
    auto_group_mode: 'overflow-only',
    max_items_per_page: 24,
    reverse_order: false,
    show_favorite_apps: false,
    reset_page_on_open: true,
    show_folder_border: true,
    border_width: 2,
    border_radius: 24,
    border_color_rgba: 'rgb(255,0,0)',
});

function clamp_int(v, min, max, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

export class ExtensionSettings {
    constructor(gio_settings) {
        this.gio = gio_settings;
    }

    _has(key) {
        return Boolean(this.gio && this.gio.settings_schema?.has_key(key));
    }

    folder_order_position() {
        const raw = this._has('folder-order-position')
            ? this.gio.get_string('folder-order-position')
            : DEFAULTS.folder_order_position;
        return FOLDER_POSITIONS.includes(raw) ? raw : DEFAULTS.folder_order_position;
    }

    set_folder_order_position(pos) {
        if (!this._has('folder-order-position')) return;
        const next = FOLDER_POSITIONS.includes(pos) ? pos : DEFAULTS.folder_order_position;
        this.gio.set_string('folder-order-position', next);
    }

    sort_folder_contents() {
        return this._has('sort-folder-contents')
            ? this.gio.get_boolean('sort-folder-contents')
            : DEFAULTS.sort_folder_contents;
    }

    set_sort_folder_contents(v) {
        if (this._has('sort-folder-contents')) this.gio.set_boolean('sort-folder-contents', Boolean(v));
    }

    auto_group_overflow() {
        return this._has('auto-group-overflow')
            ? this.gio.get_boolean('auto-group-overflow')
            : DEFAULTS.auto_group_overflow;
    }

    set_auto_group_overflow(v) {
        if (this._has('auto-group-overflow')) this.gio.set_boolean('auto-group-overflow', Boolean(v));
    }

    auto_group_mode() {
        const raw = this._has('auto-group-mode')
            ? this.gio.get_string('auto-group-mode')
            : DEFAULTS.auto_group_mode;
        return AUTO_GROUP_MODES.includes(raw) ? raw : DEFAULTS.auto_group_mode;
    }

    set_auto_group_mode(mode) {
        if (!this._has('auto-group-mode')) return;
        const next = AUTO_GROUP_MODES.includes(mode) ? mode : DEFAULTS.auto_group_mode;
        this.gio.set_string('auto-group-mode', next);
    }

    max_items_per_page() {
        const raw = this._has('max-items-per-page')
            ? this.gio.get_int('max-items-per-page')
            : DEFAULTS.max_items_per_page;
        return clamp_int(raw, 12, 48, DEFAULTS.max_items_per_page);
    }

    set_max_items_per_page(v) {
        if (!this._has('max-items-per-page')) return;
        this.gio.set_int('max-items-per-page', clamp_int(v, 12, 48, DEFAULTS.max_items_per_page));
    }

    reverse_order() {
        return this._has('reverse-order')
            ? this.gio.get_boolean('reverse-order')
            : DEFAULTS.reverse_order;
    }

    set_reverse_order(v) {
        if (this._has('reverse-order')) this.gio.set_boolean('reverse-order', Boolean(v));
    }

    show_favorite_apps() {
        return this._has('show-favorite-apps')
            ? this.gio.get_boolean('show-favorite-apps')
            : DEFAULTS.show_favorite_apps;
    }

    set_show_favorite_apps(v) {
        if (this._has('show-favorite-apps')) this.gio.set_boolean('show-favorite-apps', Boolean(v));
    }

    reset_page_on_open() {
        return this._has('reset-page-on-open')
            ? this.gio.get_boolean('reset-page-on-open')
            : DEFAULTS.reset_page_on_open;
    }

    set_reset_page_on_open(v) {
        if (this._has('reset-page-on-open')) this.gio.set_boolean('reset-page-on-open', Boolean(v));
    }

    show_folder_border() {
        return this._has('show-folder-border')
            ? this.gio.get_boolean('show-folder-border')
            : DEFAULTS.show_folder_border;
    }

    set_show_folder_border(v) {
        if (this._has('show-folder-border')) this.gio.set_boolean('show-folder-border', Boolean(v));
    }

    border_width() {
        const raw = this._has('border-width') ? this.gio.get_int('border-width') : DEFAULTS.border_width;
        return clamp_int(raw, 0, 8, DEFAULTS.border_width);
    }

    set_border_width(v) {
        if (this._has('border-width')) this.gio.set_int('border-width', clamp_int(v, 0, 8, DEFAULTS.border_width));
    }

    border_radius() {
        const raw = this._has('border-radius') ? this.gio.get_int('border-radius') : DEFAULTS.border_radius;
        return clamp_int(raw, 0, 36, DEFAULTS.border_radius);
    }

    set_border_radius(v) {
        if (this._has('border-radius')) this.gio.set_int('border-radius', clamp_int(v, 0, 36, DEFAULTS.border_radius));
    }

    border_color_rgba() {
        const raw = this._has('border-color-rgba')
            ? this.gio.get_string('border-color-rgba')
            : DEFAULTS.border_color_rgba;
        return format_rgba(parse_rgba(raw));
    }

    set_border_color_rgba(css_color) {
        if (!this._has('border-color-rgba')) return;
        this.gio.set_string('border-color-rgba', format_rgba(parse_rgba(css_color)));
    }

    reset_defaults() {
        this.set_folder_order_position(DEFAULTS.folder_order_position);
        this.set_sort_folder_contents(DEFAULTS.sort_folder_contents);
        this.set_auto_group_overflow(DEFAULTS.auto_group_overflow);
        this.set_auto_group_mode(DEFAULTS.auto_group_mode);
        this.set_max_items_per_page(DEFAULTS.max_items_per_page);
        this.set_reverse_order(DEFAULTS.reverse_order);
        this.set_show_favorite_apps(DEFAULTS.show_favorite_apps);
        this.set_reset_page_on_open(DEFAULTS.reset_page_on_open);
        this.set_show_folder_border(DEFAULTS.show_folder_border);
        this.set_border_width(DEFAULTS.border_width);
        this.set_border_radius(DEFAULTS.border_radius);
        this.set_border_color_rgba(DEFAULTS.border_color_rgba);
    }
}
