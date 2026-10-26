// SPDX-License-Identifier: GPL-3.0-or-later
// Libadwaita Preferences Folder Styling and About & Support pages plus border color presets.

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import { CATEGORY_BUCKETS } from '../../grid/auto_grouper.js';
import { format_rgba, parse_rgba } from './color.js';

export const BORDER_PRESETS = Object.freeze([
    ['Gruvbox Amber', 'rgb(251,184,108)'],
    ['Kelp Emerald', 'rgb(46,194,126)'],
    ['Ocean Cyan', 'rgb(106,215,225)'],
    ['Coral Red', 'rgb(255,0,0)'],
]);

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

function add_link_row(group, title, subtitle, button_label, url, fallback_url = null) {
    const row = new Adw.ActionRow({ title, subtitle });
    const btn = new Gtk.Button({
        label: button_label,
        valign: Gtk.Align.CENTER,
        css_classes: ['pill'],
    });
    btn.connect('clicked', () => {
        let ok = false;
        try {
            ok = Boolean(Gio.AppInfo.launch_default_for_uri(url, null));
        } catch (_e) {
            ok = false;
        }
        if (!ok && fallback_url) {
            try { Gio.AppInfo.launch_default_for_uri(fallback_url, null); } catch (_e2) { /* ignore */ }
        }
    });
    row.add_suffix(btn);
    row.activatable_widget = btn;
    group.add(row);
}

export function build_folder_styling_page(ext_settings, settings, signals) {
    const page = new Adw.PreferencesPage({
        title: 'Folder Styling',
        icon_name: 'folder-symbolic',
    });

    const style_group = new Adw.PreferencesGroup({
        title: 'App Folder Dialog Accent Border &amp; Presets',
        description: 'Style open App Folder popups in the GNOME Overview to match Kelp windows and the Reef dock pill',
    });

    const [bdr_row, bdr_sw] = make_switch_row(
        'Show App Folder Accent Border',
        'Draw a high-contrast accent border ring around open App Folder popups',
        settings.show_folder_border(),
        (v) => settings.set_show_folder_border(v),
    );

    const color_row = new Adw.ActionRow({
        title: 'Accent Border Color',
        subtitle: 'Pick a custom RGBA color or select a 1-click Kelp &amp; Reef preset below',
    });
    const rgba = new Gdk.RGBA();
    if (!rgba.parse(settings.border_color_rgba())) rgba.parse('rgb(255,0,0)');
    const color_btn = new Gtk.ColorButton({ rgba, use_alpha: true, valign: Gtk.Align.CENTER });
    color_btn.connect('color-set', () => settings.set_border_color_rgba(color_btn.get_rgba().to_string()));
    color_row.add_suffix(color_btn);

    const preset_labels = BORDER_PRESETS.map(([label]) => label);
    const match_preset = (color) => BORDER_PRESETS.findIndex(([, c]) => format_rgba(parse_rgba(c)) === color);
    const [preset_row, preset_combo] = make_combo_row(
        'Quick Color Presets',
        'One-click color presets matching Kelp active window borders and Reef dock styling',
        preset_labels,
        match_preset(settings.border_color_rgba()),
        (idx) => {
            if (idx >= 0 && idx < BORDER_PRESETS.length) {
                const css_color = BORDER_PRESETS[idx][1];
                settings.set_border_color_rgba(css_color);
                const next_rgba = new Gdk.RGBA();
                if (next_rgba.parse(css_color)) color_btn.set_rgba(next_rgba);
            }
        },
    );

    const [bw_row, bw_spin] = make_spin_row(
        'Border Width (px)',
        'Thickness of the App Folder popup border ring (0–8 px, default 2 px)',
        settings.border_width(), 0, 8, 1,
        (v) => settings.set_border_width(v),
    );
    const [br_row, br_spin] = make_spin_row(
        'Border Corner Radius (px)',
        'Corner rounding of the App Folder popup dialog (0–36 px, default 24 px)',
        settings.border_radius(), 0, 36, 2,
        (v) => settings.set_border_radius(v),
    );

    for (const r of [bdr_row, color_row, preset_row, bw_row, br_row]) style_group.add(r);
    page.add(style_group);

    const cat_group = new Adw.PreferencesGroup({
        title: 'Smart Auto-Group Category Reference',
        description: 'Freedesktop .desktop categories mapped by Coral when preventing App Grid overflow pages',
    });
    for (let i = 0; i < CATEGORY_BUCKETS.length; i += 1) {
        const b = CATEGORY_BUCKETS[i];
        const safe_title = b.label.replace(/&/g, '&amp;');
        const row = new Adw.ActionRow({
            title: safe_title,
            subtitle: `Matches: ${b.categories.slice(0, 5).join(', ')}`,
        });
        row.add_suffix(new Gtk.Label({
            label: b.coral_id,
            valign: Gtk.Align.CENTER,
            css_classes: ['dim-label', 'monospace'],
        }));
        cat_group.add(row);
    }
    page.add(cat_group);

    const sync_style = () => {
        if (bdr_sw.active !== settings.show_folder_border()) bdr_sw.active = settings.show_folder_border();
        if (bw_spin.get_value_as_int() !== settings.border_width()) bw_spin.set_value(settings.border_width());
        if (br_spin.get_value_as_int() !== settings.border_radius()) br_spin.set_value(settings.border_radius());
        const next_color = settings.border_color_rgba();
        const next_rgba = new Gdk.RGBA();
        if (next_rgba.parse(next_color) && !color_btn.get_rgba().equal(next_rgba)) color_btn.set_rgba(next_rgba);
        const next_idx = match_preset(next_color);
        if (preset_combo.get_active() !== next_idx) preset_combo.set_active(next_idx);
    };
    for (const k of ['show-folder-border', 'border-width', 'border-radius', 'border-color-rgba']) {
        if (ext_settings.settings_schema?.has_key(k)) {
            signals.push([ext_settings, ext_settings.connect(`changed::${k}`, sync_style)]);
        }
    }
    return page;
}

export function build_about_page() {
    const page = new Adw.PreferencesPage({
        title: 'About & Support',
        icon_name: 'help-about-symbolic',
    });

    const header_group = new Adw.PreferencesGroup({
        title: 'Coral — Alphabetical App Grid &amp; Smart Auto-Folder Organizer',
        description: 'Keeps the GNOME 45–50 App Grid and App Folders in alphabetical order and automatically ' +
            'groups overflow apps into labeled category folders.',
    });

    const ver_row = new Adw.ActionRow({
        title: 'Coral Release Version',
        subtitle: 'Zero-subprocess, zero-telemetry Wayland App Grid organizer for GNOME Shell',
    });
    ver_row.add_suffix(new Gtk.Label({
        label: 'v1.1.1', valign: Gtk.Align.CENTER, css_classes: ['monospace'],
    }));
    header_group.add(ver_row);

    const lic_row = new Adw.ActionRow({
        title: 'Open-Source License',
        subtitle: 'Derived from Alphabetical App Grid by Stuart Hayhurst &amp; contributors — free software forever',
    });
    lic_row.add_suffix(new Gtk.Label({
        label: 'GPL-3.0-or-later', valign: Gtk.Align.CENTER, css_classes: ['monospace'],
    }));
    header_group.add(lic_row);
    page.add(header_group);

    const support_group = new Adw.PreferencesGroup({
        title: 'Support &amp; Community',
        description: 'If Coral improves your daily workflow alongside Kelp, Reef, and Shoal, starring the repository ' +
            'or sponsoring development helps keep GNOME 45–50 support fast and rock-solid.',
    });

    add_link_row(
        support_group,
        'Star Coral on GitHub',
        'Star UberMetroid/coral to help other GNOME &amp; Linux users discover Coral',
        'Star on GitHub',
        'https://github.com/UberMetroid/coral',
    );
    add_link_row(
        support_group,
        'Tuition, Not Coffee — Help send my daughter to college',
        "Skip the coffee — 100% of sponsorships go toward my daughter's college &amp; future fund",
        'Tuition, Not Coffee',
        'https://ubermetroid.github.io/tuition-not-coffee',
        'https://github.com/UberMetroid/coral',
    );
    add_link_row(
        support_group,
        'Project Website &amp; Documentation',
        'Explore the Coral feature guide, smart auto-group overview, and configuration reference',
        'Open Website',
        'https://ubermetroid.github.io/coral/',
    );
    add_link_row(
        support_group,
        'Report an Issue or Request a Feature',
        'Found a bug or have a feature request? Open an issue on GitHub',
        'Report Issue',
        'https://github.com/UberMetroid/coral/issues',
    );

    page.add(support_group);
    return page;
}
