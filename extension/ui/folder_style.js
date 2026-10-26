// SPDX-License-Identifier: GPL-3.0-or-later
// Pure inline CSS builder for GNOME Shell App Folder popup dialog accent borders.

import { format_rgba, parse_rgba } from './settings/color.js';

export function build_folder_dialog_css(show_border, border_width, border_radius, border_color_rgba) {
    const r = Math.max(0, Math.min(36, Math.round(Number(border_radius) || 0)));
    if (!show_border) {
        return `border-radius: ${r}px;`;
    }
    const w = Math.max(0, Math.min(8, Math.round(Number(border_width) || 0)));
    if (w === 0) {
        return `border-radius: ${r}px;`;
    }
    const color = format_rgba(parse_rgba(border_color_rgba));
    return `border: ${w}px solid ${color}; border-radius: ${r}px;`;
}

export function apply_folder_dialog_style(dialog, settings) {
    if (!dialog || !settings) return;
    const view_box = dialog._viewBox || dialog.child || dialog;
    if (!view_box || typeof view_box.set_style !== 'function') return;
    const css = build_folder_dialog_css(
        settings.show_folder_border(),
        settings.border_width(),
        settings.border_radius(),
        settings.border_color_rgba(),
    );
    view_box.set_style(css);
    if (typeof view_box.add_style_class_name === 'function') {
        view_box.add_style_class_name('coral-folder-dialog');
    }
}

export function clear_folder_dialog_style(dialog) {
    if (!dialog) return;
    const view_box = dialog._viewBox || dialog.child || dialog;
    if (!view_box) return;
    if (typeof view_box.set_style === 'function') {
        view_box.set_style(null);
    }
    if (typeof view_box.remove_style_class_name === 'function') {
        view_box.remove_style_class_name('coral-folder-dialog');
    }
}
