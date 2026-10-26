// SPDX-License-Identifier: GPL-3.0-or-later
// Pure alphabetical and folder-position comparators for the GNOME Shell App Grid and App Folders.

export const MAX_GRID_APPS = 512;
export const MAX_COMPARISON_FOLDERS = 64;

export function alphabetical_compare(name_a, name_b, reverse = false) {
    const a = String(name_a ?? '').toLowerCase();
    const b = String(name_b ?? '').toLowerCase();
    const cmp = a.localeCompare(b);
    return reverse ? -cmp : cmp;
}

export function resolve_item_id(item) {
    if (!item || typeof item !== 'object') return '';
    if (typeof item.id === 'string' && item.id.length > 0) return item.id;
    if (typeof item._id === 'string' && item._id.length > 0) return item._id;
    return '';
}

export function resolve_item_name(item) {
    if (!item || typeof item !== 'object') return '';
    if (typeof item.name === 'string' && item.name.length > 0) return item.name;
    if (typeof item._name === 'string' && item._name.length > 0) return item._name;
    return resolve_item_id(item);
}

export function compare_grid_items(item_a, item_b, folder_position = 'alphabetical', folder_ids = [], reverse = false) {
    const name_a = resolve_item_name(item_a);
    const name_b = resolve_item_name(item_b);
    if (folder_position === 'alphabetical' || !Array.isArray(folder_ids) || folder_ids.length === 0) {
        return alphabetical_compare(name_a, name_b, reverse);
    }

    const id_a = resolve_item_id(item_a);
    const id_b = resolve_item_id(item_b);
    const bounded_folders = folder_ids.slice(0, MAX_COMPARISON_FOLDERS);
    const is_folder_a = bounded_folders.includes(id_a);
    const is_folder_b = bounded_folders.includes(id_b);

    if (is_folder_a === is_folder_b) {
        return alphabetical_compare(name_a, name_b, reverse);
    }

    if (folder_position === 'start') {
        return is_folder_a ? -1 : 1;
    }
    if (folder_position === 'end') {
        return is_folder_a ? 1 : -1;
    }
    return alphabetical_compare(name_a, name_b, reverse);
}

export function sort_desktop_ids_by_name(desktop_ids, lookup_name_fn, reverse = false) {
    if (!Array.isArray(desktop_ids) || desktop_ids.length === 0) return [];
    const limit = Math.min(desktop_ids.length, MAX_GRID_APPS);
    const pairs = [];
    for (let i = 0; i < limit; i += 1) {
        const id = String(desktop_ids[i] ?? '');
        if (id.length === 0) continue;
        let display_name = id;
        if (typeof lookup_name_fn === 'function') {
            const resolved = lookup_name_fn(id);
            if (typeof resolved === 'string' && resolved.trim().length > 0) {
                display_name = resolved;
            }
        }
        pairs.push({ id, name: display_name });
    }
    pairs.sort((a, b) => {
        const cmp = alphabetical_compare(a.name, b.name, reverse);
        if (cmp !== 0) return cmp;
        return alphabetical_compare(a.id, b.id, reverse);
    });
    return pairs.map((entry) => entry.id);
}
