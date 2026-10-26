// SPDX-License-Identifier: GPL-3.0-or-later
// Coral App Grid lifecycle coordinator, InjectionManager patcher, and named timer manager.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import St from 'gi://St';
import { InjectionManager } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import { apply_folder_dialog_style, clear_folder_dialog_style } from '../ui/folder_style.js';
import { ExtensionSettings } from '../ui/settings/gsettings.js';
import {
    APP_FOLDERS_SCHEMA, apply_auto_grouping_if_needed, sort_all_folders,
} from './folder_sorter.js';
import {
    build_add_folder_dialog_override, build_compare_items_override,
    build_load_apps_override, build_redisplay_override,
} from './grid_redisplay.js';

export class GridManager {
    constructor(extension) {
        this.extension = extension;
        this.ext_settings = extension.getSettings();
        this.settings = new ExtensionSettings(this.ext_settings);
        this._injection_manager = new InjectionManager();
        this._app_system = Shell.AppSystem.get_default();
        this._controls = Main.overview?._overview?._controls || null;
        this._app_display = this._controls?._appDisplay || null;
        this._shell_settings = new Gio.Settings({ schema_id: 'org.gnome.shell' });
        this._folder_settings = new Gio.Settings({ schema_id: APP_FOLDERS_SCHEMA });
        this._currently_updating = false;
        this._reorder_pending = false;
        this._reorder_timeout_id = 0;
        this._current_style = null;

        this.load_theme();
        this._patch_shell();
        this._connect_listeners();
        this.reorder_grid();
    }

    load_theme() {
        this.unload_theme();
        try {
            const file = Gio.File.new_for_path(`${this.extension.path}/ui/stylesheet.css`);
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            if (theme) {
                theme.load_stylesheet(file);
                this._current_style = file;
            }
        } catch (err) {
            console.error(err);
        }
    }

    unload_theme() {
        if (!this._current_style) return;
        try {
            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            if (theme) theme.unload_stylesheet(this._current_style);
        } catch (_e) { /* ignore */ }
        this._current_style = null;
    }

    _patch_shell() {
        const settings = this.settings;
        const folder_settings = this._folder_settings;

        this._injection_manager.overrideMethod(
            AppDisplay.AppDisplay.prototype,
            '_compareItems',
            () => build_compare_items_override(settings, folder_settings),
        );
        this._injection_manager.overrideMethod(
            AppDisplay.AppDisplay.prototype,
            '_loadApps',
            (original_load_apps) => build_load_apps_override(original_load_apps, settings),
        );
        this._injection_manager.overrideMethod(
            AppDisplay.AppDisplay.prototype,
            '_redisplay',
            () => build_redisplay_override(settings),
        );
        this._injection_manager.overrideMethod(
            AppDisplay.AppDisplay.prototype,
            'addFolderDialog',
            (original_add_dialog) => build_add_folder_dialog_override(original_add_dialog, settings),
        );
    }

    _connect_listeners() {
        this._shell_settings.connectObject(
            'changed::app-picker-layout', () => this.reorder_grid(),
            'changed::favorite-apps', () => this.reorder_grid(),
            this,
        );
        Main.overview.connectObject('item-drag-end', () => this.reorder_grid(), this);
        this._folder_settings.connectObject('changed::folder-children', () => this.reorder_grid(), this);
        this._app_system.connectObject('installed-changed', () => this.reorder_grid(), this);
        this.ext_settings.connectObject('changed', () => {
            this._sync_folder_dialogs_style();
            this.reorder_grid();
        }, this);
        if (this._controls?._stateAdjustment) {
            this._controls._stateAdjustment.connectObject('notify::value', () => {
                if (this._controls._stateAdjustment.value === OverviewControls.ControlsState.APP_GRID) {
                    if (this.settings.reset_page_on_open() && this._app_display) {
                        this._app_display.goToPage(0, false);
                    }
                    this.reorder_grid();
                }
            }, this);
        }
    }

    _sync_folder_dialogs_style(clear = false) {
        const folder_icons = this._app_display?._folderIcons;
        if (!Array.isArray(folder_icons)) return;
        for (let i = 0; i < folder_icons.length; i += 1) {
            const dlg = folder_icons[i]?._dialog;
            if (!dlg) continue;
            if (clear) clear_folder_dialog_style(dlg);
            else apply_folder_dialog_style(dlg, this.settings);
        }
        if (this._app_display?._currentDialog) {
            if (clear) clear_folder_dialog_style(this._app_display._currentDialog);
            else apply_folder_dialog_style(this._app_display._currentDialog, this.settings);
        }
    }

    reorder_grid() {
        if (!this._app_display) return;
        if (this._currently_updating || this._app_display._pageManager?._updatingPages) {
            this._reorder_pending = true;
            return;
        }
        this._currently_updating = true;
        this._reorder_pending = false;

        try {
            if (this.settings.auto_group_overflow()) {
                const fav_set = this.settings.show_favorite_apps()
                    ? new Set()
                    : new Set(this._shell_settings.get_strv('favorite-apps'));
                const page_capacity = this._app_display._grid?.itemsPerPage || this.settings.max_items_per_page();
                apply_auto_grouping_if_needed(
                    this._folder_settings,
                    this._app_system,
                    fav_set,
                    page_capacity,
                    this.settings.auto_group_mode(),
                );
            }
            if (this.settings.sort_folder_contents()) {
                sort_all_folders(this._folder_settings, this._app_system, this.settings.reverse_order());
            }
        } catch (err) {
            console.error(err);
        }

        if (this._reorder_timeout_id !== 0) {
            GLib.Source.remove(this._reorder_timeout_id);
            this._reorder_timeout_id = 0;
        }
        this._reorder_timeout_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._reorder_timeout_id = 0;
            try {
                this._app_display?._redisplay();
                this._sync_folder_dialogs_style(false);
            } catch (err) {
                console.error(err);
            }
            this._currently_updating = false;
            if (this._reorder_pending) {
                this._reorder_pending = false;
                this.reorder_grid();
            }
            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(this._reorder_timeout_id, '[coral] reorder-grid');
    }

    destroy() {
        Main.overview.disconnectObject(this);
        this._controls?._stateAdjustment?.disconnectObject(this);
        this._app_system?.disconnectObject(this);
        this._shell_settings?.disconnectObject(this);
        this.ext_settings?.disconnectObject(this);
        this._folder_settings?.disconnectObject(this);

        if (this._reorder_timeout_id !== 0) {
            GLib.Source.remove(this._reorder_timeout_id);
            this._reorder_timeout_id = 0;
        }
        this._currently_updating = false;
        this._reorder_pending = false;
        this._sync_folder_dialogs_style(true);
        this._injection_manager?.clear();
        try {
            this._app_display?._redisplay();
        } catch (_e) { /* ignore */ }
        this.unload_theme();
        this._injection_manager = null;
        this._app_system = null;
        this._controls = null;
        this._app_display = null;
        this._shell_settings = null;
        this._folder_settings = null;
        this.settings = null;
        this.ext_settings = null;
        this.extension = null;
    }
}
