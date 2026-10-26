// SPDX-License-Identifier: GPL-3.0-or-later
// 3-tab GTK4 / Libadwaita preferences UI for Coral App Grid, Smart Auto-Groups, and Folder Styling.

import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { dissolve_coral_folders } from './grid/folder_sorter.js';
import { AUTO_GROUP_MODES, ExtensionSettings, FOLDER_POSITIONS } from './ui/settings/gsettings.js';
import { build_about_page, build_folder_styling_page } from './ui/settings/prefs_pages.js';

function make_switch_row(title, subtitle, active, on_toggle) {
    const row = new Adw.ActionRow({ title, subtitle });
    const sw = new Gtk.Switch({ active: Boolean(active), valign: Gtk.Align.CENTER });
    sw.connect('notify::active', () => on_toggle(sw.active));
    row.add_suffix(sw);
    row.activatable_widget = sw;
    return [row, sw];
}

function make_spin_row(title, subtitle, value, min, max, step, on_change) {
    const row = new Adw.ActionRow({ title, subtitle });
    const spin = Gtk.SpinButton.new_with_range(min, max, step);
    spin.set_value(value);
    spin.set_valign(Gtk.Align.CENTER);
    spin.connect('value-changed', () => on_change(spin.get_value_as_int()));
    row.add_suffix(spin);
    return [row, spin];
}

function make_combo_row(title, subtitle, items, active_idx, on_change) {
    const row = new Adw.ActionRow({ title, subtitle });
    const combo = new Gtk.ComboBoxText({ valign: Gtk.Align.CENTER });
    for (const item of items) combo.append_text(item);
    combo.set_active(Math.max(0, active_idx));
    combo.connect('changed', () => on_change(combo.get_active()));
    row.add_suffix(combo);
    return [row, combo];
}

function build_grid_and_autogroups_page(ext_settings, settings, signals) {
    const page = new Adw.PreferencesPage({
        title: 'Grid & Auto-Groups',
        icon_name: 'view-app-grid-symbolic',
    });

    const auto_group = new Adw.PreferencesGroup({
        title: 'Smart Auto-Group Overflow Page Prevention',
        description: 'Automatically sort loose apps into labeled category folders when icons exceed a single page',
    });

    const [ag_row, ag_sw] = make_switch_row(
        'Smart Auto-Group to Prevent Overflow Page',
        'Automatically group loose apps into labeled category folders when Page 1 fills up',
        settings.auto_group_overflow(),
        (v) => settings.set_auto_group_overflow(v),
    );

    const mode_labels = [
        'Only When Needed to Stop Overflow Page (Default)',
        'Always Group All Categorizable Apps into Folders',
    ];
    const [mode_row, mode_combo] = make_combo_row(
        'Auto-Group Strategy',
        'Choose whether to create category folders only on page overflow or for all loose apps',
        mode_labels,
        AUTO_GROUP_MODES.indexOf(settings.auto_group_mode()),
        (idx) => {
            if (idx >= 0 && idx < AUTO_GROUP_MODES.length) {
                settings.set_auto_group_mode(AUTO_GROUP_MODES[idx]);
            }
        },
    );

    const [cap_row, cap_spin] = make_spin_row(
        'Target Icons Per Page',
        'Single-page icon capacity before overflow auto-grouping triggers (12–48, default 24)',
        settings.max_items_per_page(), 12, 48, 2,
        (v) => settings.set_max_items_per_page(v),
    );

    const dissolve_row = new Adw.ActionRow({
        title: 'Unpack Auto-Created Category Folders',
        subtitle: 'Dissolve auto-created coral-* folders back into loose icons on the App Grid',
    });
    const dissolve_btn = new Gtk.Button({
        label: 'Unpack Auto-Groups',
        valign: Gtk.Align.CENTER,
    });
    dissolve_btn.connect('clicked', () => {
        try { dissolve_coral_folders(); } catch (_e) { /* ignore */ }
    });
    dissolve_row.add_suffix(dissolve_btn);
    dissolve_row.activatable_widget = dissolve_btn;

    for (const r of [ag_row, mode_row, cap_row, dissolve_row]) auto_group.add(r);
    page.add(auto_group);

    const sort_group = new Adw.PreferencesGroup({
        title: 'Alphabetical Ordering &amp; Favorites',
        description: 'Configure folder placement, folder-content sorting, reverse order, and favorite apps',
    });

    const pos_labels = [
        'Alphabetical — Mix Folders & Apps (Default)',
        'Start of Grid — Folders First',
        'End of Grid — Folders Last',
    ];
    const [pos_row, pos_combo] = make_combo_row(
        'Folder Placement',
        'Where App Folders appear relative to regular applications in the App Grid',
        pos_labels,
        FOLDER_POSITIONS.indexOf(settings.folder_order_position()),
        (idx) => {
            if (idx >= 0 && idx < FOLDER_POSITIONS.length) {
                settings.set_folder_order_position(FOLDER_POSITIONS[idx]);
            }
        },
    );

    const [sfc_row, sfc_sw] = make_switch_row(
        'Sort Folder Contents Alphabetically',
        'Automatically sort the applications inside every App Folder in alphabetical order',
        settings.sort_folder_contents(),
        (v) => settings.set_sort_folder_contents(v),
    );
    const [rev_row, rev_sw] = make_switch_row(
        'Reverse Alphabetical Order (Z -> A)',
        'Sort the App Grid and App Folder contents from Z to A instead of A to Z',
        settings.reverse_order(),
        (v) => settings.set_reverse_order(v),
    );
    const [fav_row, fav_sw] = make_switch_row(
        'Show Pinned Favorites in App Grid',
        'Also display pinned dock/dash favorite applications inside the main alphabetical App Grid',
        settings.show_favorite_apps(),
        (v) => settings.set_show_favorite_apps(v),
    );
    const [rst_row, rst_sw] = make_switch_row(
        'Always Open App Grid on First Page',
        'Reset the App Grid to Page 1 whenever the Overview App Grid is opened',
        settings.reset_page_on_open(),
        (v) => settings.set_reset_page_on_open(v),
    );

    const reset_row = new Adw.ActionRow({
        title: 'Reset to Coral Defaults',
        subtitle: 'Restore Alphabetical A -> Z sorting, Smart Overflow Auto-Grouping (24 icons), and Coral Red border',
    });
    const reset_btn = new Gtk.Button({
        label: 'Reset Defaults',
        valign: Gtk.Align.CENTER,
        css_classes: ['suggested-action'],
    });
    reset_btn.connect('clicked', () => settings.reset_defaults());
    reset_row.add_suffix(reset_btn);
    reset_row.activatable_widget = reset_btn;

    for (const r of [pos_row, sfc_row, rev_row, fav_row, rst_row, reset_row]) sort_group.add(r);
    page.add(sort_group);

    const sync_grid = () => {
        if (ag_sw.active !== settings.auto_group_overflow()) ag_sw.active = settings.auto_group_overflow();
        const m_idx = Math.max(0, AUTO_GROUP_MODES.indexOf(settings.auto_group_mode()));
        if (mode_combo.get_active() !== m_idx) mode_combo.set_active(m_idx);
        if (cap_spin.get_value_as_int() !== settings.max_items_per_page()) {
            cap_spin.set_value(settings.max_items_per_page());
        }
        const p_idx = Math.max(0, FOLDER_POSITIONS.indexOf(settings.folder_order_position()));
        if (pos_combo.get_active() !== p_idx) pos_combo.set_active(p_idx);
        if (sfc_sw.active !== settings.sort_folder_contents()) sfc_sw.active = settings.sort_folder_contents();
        if (rev_sw.active !== settings.reverse_order()) rev_sw.active = settings.reverse_order();
        if (fav_sw.active !== settings.show_favorite_apps()) fav_sw.active = settings.show_favorite_apps();
        if (rst_sw.active !== settings.reset_page_on_open()) rst_sw.active = settings.reset_page_on_open();
    };
    const keys = [
        'auto-group-overflow', 'auto-group-mode', 'max-items-per-page', 'folder-order-position',
        'sort-folder-contents', 'reverse-order', 'show-favorite-apps', 'reset-page-on-open',
    ];
    for (const k of keys) {
        if (ext_settings.settings_schema?.has_key(k)) {
            signals.push([ext_settings, ext_settings.connect(`changed::${k}`, sync_grid)]);
        }
    }
    return page;
}

export default class CoralPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const ext_settings = this.getSettings();
        const settings = new ExtensionSettings(ext_settings);
        const signals = [];
        window.set_default_size(760, 680);
        window.add(build_grid_and_autogroups_page(ext_settings, settings, signals));
        window.add(build_folder_styling_page(ext_settings, settings, signals));
        window.add(build_about_page());
        window.connect('close-request', () => {
            for (const [obj, sig] of signals) obj.disconnect(sig);
            signals.length = 0;
            return false;
        });
    }
}
