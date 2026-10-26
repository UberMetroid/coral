// SPDX-License-Identifier: GPL-3.0-or-later
// AppDisplay method overrides for alphabetical grid ordering, favorites display, and folder styling.

import Shell from 'gi://Shell';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import { apply_folder_dialog_style } from '../ui/folder_style.js';
import { MAX_COMPARISON_FOLDERS, compare_grid_items } from './grid_sorter.js';

export function build_compare_items_override(settings, folder_settings) {
    return function coral_compare_items(item_a, item_b) {
        const folder_pos = settings.folder_order_position();
        const reverse = settings.reverse_order();
        const folder_ids = this._coral_folder_set instanceof Set
            ? this._coral_folder_set
            : (folder_settings ? folder_settings.get_strv('folder-children') : []);
        return compare_grid_items(item_a, item_b, folder_pos, folder_ids, reverse);
    };
}

export function build_load_apps_override(original_load_apps, settings) {
    return function coral_load_apps() {
        const app_icons = original_load_apps.call(this);
        if (!settings.show_favorite_apps()) {
            return app_icons;
        }
        const app_sys = Shell.AppSystem.get_default();
        const fav_mgr = this._appFavorites || (typeof AppFavorites.getAppFavorites === 'function' ? AppFavorites.getAppFavorites() : null);
        const favorites = fav_mgr && typeof fav_mgr.getFavorites === 'function' ? fav_mgr.getFavorites() : [];
        if (!Array.isArray(favorites) || favorites.length === 0) {
            return app_icons;
        }

        const existing_ids = new Set(app_icons.map((icon) => icon.id || icon._id));
        const folder_app_ids = new Set();
        if (Array.isArray(this._folderIcons)) {
            for (let i = 0; i < this._folderIcons.length; i += 1) {
                const f_icon = this._folderIcons[i];
                const ids = typeof f_icon?.getAppIds === 'function' ? f_icon.getAppIds() : [];
                for (let j = 0; j < ids.length; j += 1) folder_app_ids.add(ids[j]);
            }
        }

        const is_draggable =
            global.settings.is_writable('favorite-apps') ||
            global.settings.is_writable('app-picker-layout');

        for (let i = 0; i < favorites.length; i += 1) {
            const fav_app = favorites[i];
            const app_id = fav_app ? fav_app.get_id() : '';
            if (!app_id || existing_ids.has(app_id) || folder_app_ids.has(app_id)) continue;
            const app_info = fav_app.get_app_info ? fav_app.get_app_info() : null;
            if (app_info && this._parentalControlsManager &&
                !this._parentalControlsManager.shouldShowApp(app_info)) {
                continue;
            }
            let icon = this._items.get(app_id);
            if (!icon) {
                const resolved_app = app_sys.lookup_app(app_id) || fav_app;
                icon = new AppDisplay.AppIcon(resolved_app, { isDraggable: is_draggable });
                this._items.set(app_id, icon);
            }
            app_icons.push(icon);
            existing_ids.add(app_id);
        }
        return app_icons;
    };
}

export function build_redisplay_override(settings, folder_settings = null) {
    return function coral_redisplay() {
        const raw_folders = folder_settings ? folder_settings.get_strv('folder-children') : [];
        this._coral_folder_set = new Set(raw_folders.slice(0, MAX_COMPARISON_FOLDERS));
        try {
            if (Array.isArray(this._folderIcons)) {
                for (let i = 0; i < this._folderIcons.length; i += 1) {
                    const f_icon = this._folderIcons[i];
                    f_icon?.view?._redisplay();
                    if (f_icon?._dialog) {
                        apply_folder_dialog_style(f_icon._dialog, settings);
                    }
                }
            }

            const current_apps = this._orderedItems.slice();
            const current_app_ids = new Set(current_apps.map((icon) => icon.id));

            const new_apps = this._loadApps().sort(this._compareItems.bind(this));
            const new_app_ids = new Set(new_apps.map((icon) => icon.id));

            const added_apps = new Set(new_apps.filter((icon) => !current_apps.includes(icon) && !current_app_ids.has(icon.id)));
            const removed_apps = current_apps.filter((icon) => !new_apps.includes(icon) && !new_app_ids.has(icon.id));

            for (let i = 0; i < removed_apps.length; i += 1) {
                const icon = removed_apps[i];
                this._removeItem(icon);
                icon.destroy();
            }

            const items_per_page = Math.max(1, this._grid?.itemsPerPage || settings.max_items_per_page());
            for (let i = 0; i < new_apps.length; i += 1) {
                const icon = new_apps[i];
                const page = Math.floor(i / items_per_page);
                const position = i % items_per_page;
                if (added_apps.has(icon)) {
                    this._addItem(icon, page, position);
                } else {
                    this._moveItem(icon, page, position);
                }
            }

            this._orderedItems = new_apps;
            this.emit('view-loaded');
        } finally {
            delete this._coral_folder_set;
        }
    };
}

export function build_add_folder_dialog_override(original_add_folder_dialog, settings) {
    return function coral_add_folder_dialog(dialog) {
        original_add_folder_dialog.call(this, dialog);
        apply_folder_dialog_style(dialog, settings);
    };
}
