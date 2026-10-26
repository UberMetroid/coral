// SPDX-License-Identifier: GPL-3.0-or-later
// Synchronizes org.gnome.desktop.app-folders for overflow auto-grouping and alphabetical folder sorting.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import { MAX_FOLDERS, plan_overflow_grouping } from './auto_grouper.js';
import { sort_desktop_ids_by_name } from './grid_sorter.js';

export const APP_FOLDERS_SCHEMA = 'org.gnome.desktop.app-folders';
export const FOLDER_CHILD_SCHEMA = 'org.gnome.desktop.app-folders.folder';
export const FOLDER_BASE_PATH = '/org/gnome/desktop/app-folders/folders/';

function open_folder_settings(folder_id) {
    return Gio.Settings.new_with_path(FOLDER_CHILD_SCHEMA, `${FOLDER_BASE_PATH}${folder_id}/`);
}

function arrays_equal(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

export function read_existing_folders(folder_settings) {
    if (!folder_settings) return [];
    const ids = folder_settings.get_strv('folder-children').slice(0, MAX_FOLDERS);
    const result = [];
    for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        if (typeof id !== 'string' || id.length === 0) continue;
        try {
            const child = open_folder_settings(id);
            const name = child.get_string('name');
            const apps = child.get_strv('apps');
            const excluded = child.get_strv('excluded-apps');
            result.push({ id, name, apps, excluded, settings: child });
        } catch (_e) { /* ignore malformed relocatable folder */ }
    }
    return result;
}

export function apply_auto_grouping_if_needed(
    folder_settings,
    app_system,
    favorite_ids_set,
    page_capacity,
    mode = 'overflow-only',
) {
    if (!folder_settings || !app_system) return false;
    const folders = read_existing_folders(folder_settings);
    const folder_apps_set = new Set();
    for (let i = 0; i < folders.length; i += 1) {
        const active_apps = folders[i].apps.filter((id) => app_system.lookup_app(id) !== null);
        folders[i].apps = active_apps;
        for (let j = 0; j < active_apps.length; j += 1) {
            folder_apps_set.add(active_apps[j]);
        }
    }

    const installed = app_system.get_installed ? app_system.get_installed() : [];
    const loose_apps = [];
    for (let i = 0; i < installed.length; i += 1) {
        const info = installed[i];
        let id = '';
        try {
            id = info.get_id();
        } catch (_e) {
            continue;
        }
        if (!id || folder_apps_set.has(id)) continue;
        if (favorite_ids_set && favorite_ids_set.has(id)) continue;
        if (typeof info.should_show === 'function' && !info.should_show()) continue;
        const categories = typeof info.get_categories === 'function' ? (info.get_categories() || '') : '';
        loose_apps.push({ id, name: info.get_name() || id, categories });
    }

    const plan = plan_overflow_grouping(loose_apps, folders, page_capacity, mode);
    if (!plan.triggered || plan.assignments.length === 0) return false;

    const current_children = folder_settings.get_strv('folder-children');
    const next_children = current_children.slice();
    let changed = false;

    for (let i = 0; i < plan.assignments.length; i += 1) {
        const a = plan.assignments[i];
        const child = open_folder_settings(a.folder_id);
        if (!next_children.includes(a.folder_id)) {
            next_children.push(a.folder_id);
            if (child.is_writable('name')) child.set_string('name', a.folder_name);
            if (child.is_writable('translate')) child.set_boolean('translate', false);
        }
        const existing_apps = child.get_strv('apps');
        const merged = existing_apps.slice();
        for (let j = 0; j < a.added_app_ids.length; j += 1) {
            const app_id = a.added_app_ids[j];
            if (!merged.includes(app_id)) merged.push(app_id);
        }
        if (!arrays_equal(existing_apps, merged) && child.is_writable('apps')) {
            child.set_value('apps', new GLib.Variant('as', merged));
            changed = true;
        }
    }

    if (!arrays_equal(current_children, next_children) && folder_settings.is_writable('folder-children')) {
        folder_settings.set_strv('folder-children', next_children);
        changed = true;
    }
    return changed;
}

export function sort_all_folders(folder_settings, app_system, reverse = false) {
    if (!folder_settings) return false;
    const folder_ids = folder_settings.get_strv('folder-children').slice(0, MAX_FOLDERS);
    const lookup_name = (id) => {
        const app = app_system ? app_system.lookup_app(id) : null;
        return app ? app.get_name() : id;
    };
    let changed = false;
    for (let i = 0; i < folder_ids.length; i += 1) {
        const child = open_folder_settings(folder_ids[i]);
        const current = child.get_strv('apps');
        const sorted = sort_desktop_ids_by_name(current, lookup_name, reverse);
        if (!arrays_equal(current, sorted) && child.is_writable('apps')) {
            child.set_value('apps', new GLib.Variant('as', sorted));
            changed = true;
        }
    }
    return changed;
}

export function dissolve_coral_folders(folder_settings = null) {
    const settings = folder_settings || new Gio.Settings({ schema_id: APP_FOLDERS_SCHEMA });
    const current = settings.get_strv('folder-children');
    const kept = [];
    let dissolved = 0;
    for (let i = 0; i < current.length; i += 1) {
        const id = current[i];
        if (typeof id === 'string' && id.startsWith('coral-')) {
            try {
                const child = open_folder_settings(id);
                const keys = child.settings_schema ? child.settings_schema.list_keys() : ['apps', 'name', 'translate'];
                for (let k = 0; k < keys.length; k += 1) child.reset(keys[k]);
            } catch (_e) { /* ignore */ }
            dissolved += 1;
        } else {
            kept.push(id);
        }
    }
    if (dissolved > 0 && settings.is_writable('folder-children')) {
        settings.set_strv('folder-children', kept);
    }
    return dissolved;
}
