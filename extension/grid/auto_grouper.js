// SPDX-License-Identifier: GPL-3.0-or-later
// Freedesktop .desktop category classifier and greedy overflow-page prevention planner.

import { MAX_GRID_APPS } from './grid_sorter.js';

export const MAX_FOLDERS = 64;

export const CATEGORY_BUCKETS = Object.freeze([
    Object.freeze({
        key: 'games',
        coral_id: 'coral-games',
        label: 'Games',
        aliases: Object.freeze(['games', 'game']),
        categories: Object.freeze(['Game', 'ArcadeGame', 'ActionGame', 'RolePlaying', 'Simulation', 'StrategyGame']),
    }),
    Object.freeze({
        key: 'development',
        coral_id: 'coral-development',
        label: 'Development',
        aliases: Object.freeze(['development', 'developer', 'programming']),
        categories: Object.freeze(['Development', 'IDE', 'Building', 'Debugger', 'RevisionControl', 'WebDevelopment']),
    }),
    Object.freeze({
        key: 'media',
        coral_id: 'coral-media',
        label: 'Media & Graphics',
        aliases: Object.freeze(['media & graphics', 'graphics & media', 'graphics', 'media', 'sound & video']),
        categories: Object.freeze([
            'AudioVideo', 'Audio', 'Video', 'Music', 'Player', 'Recorder',
            'Graphics', '2DGraphics', '3DGraphics', 'Photography', 'VectorGraphics', 'RasterGraphics',
        ]),
    }),
    Object.freeze({
        key: 'internet',
        coral_id: 'coral-internet',
        label: 'Internet & Social',
        aliases: Object.freeze(['internet & social', 'internet', 'network', 'web']),
        categories: Object.freeze([
            'Network', 'WebBrowser', 'Email', 'InstantMessaging', 'Chat', 'IRCClient',
            'FileTransfer', 'P2P', 'RemoteAccess', 'Feed', 'VideoConference',
        ]),
    }),
    Object.freeze({
        key: 'office',
        coral_id: 'coral-office',
        label: 'Office',
        aliases: Object.freeze(['office', 'productivity']),
        categories: Object.freeze([
            'Office', 'WordProcessor', 'Spreadsheet', 'Presentation', 'Calendar',
            'ContactManagement', 'Finance', 'ProjectManagement', 'Publishing', 'Viewer',
        ]),
    }),
    Object.freeze({
        key: 'science',
        coral_id: 'coral-science',
        label: 'Science & Docs',
        aliases: Object.freeze(['science & docs', 'documentation', 'science', 'education']),
        categories: Object.freeze(['Science', 'Education', 'Documentation', 'Math', 'Astronomy', 'Chemistry']),
    }),
    Object.freeze({
        key: 'system',
        coral_id: 'coral-system',
        label: 'System',
        aliases: Object.freeze(['system', 'x-gnome-shell-system.directory', 'settings']),
        categories: Object.freeze(['System', 'Settings', 'Monitor', 'PackageManager', 'Security', 'HardwareSettings']),
    }),
    Object.freeze({
        key: 'utilities',
        coral_id: 'coral-utilities',
        label: 'Utilities',
        aliases: Object.freeze(['utilities', 'x-gnome-shell-utilities.directory']),
        categories: Object.freeze(['X-GNOME-Utilities', 'Archiving', 'Compression', 'FileTools', 'Calculator']),
    }),
    Object.freeze({
        key: 'accessories',
        coral_id: 'coral-accessories',
        label: 'Accessories',
        aliases: Object.freeze(['accessories', 'utility']),
        categories: Object.freeze(['Utility', 'Accessibility', 'Clock', 'TextEditor', 'Core']),
    }),
]);

export function parse_desktop_categories(categories_raw) {
    if (Array.isArray(categories_raw)) {
        return categories_raw.map((c) => String(c ?? '').trim()).filter((c) => c.length > 0);
    }
    if (typeof categories_raw !== 'string' || categories_raw.length === 0) return [];
    return categories_raw.split(';').map((c) => c.trim()).filter((c) => c.length > 0);
}

export function classify_app_category(categories_raw) {
    const tokens = parse_desktop_categories(categories_raw);
    if (tokens.length === 0) return null;
    for (let i = 0; i < CATEGORY_BUCKETS.length; i += 1) {
        const bucket = CATEGORY_BUCKETS[i];
        for (let j = 0; j < bucket.categories.length; j += 1) {
            if (tokens.includes(bucket.categories[j])) {
                return bucket;
            }
        }
    }
    return null;
}

function find_existing_folder_for_bucket(bucket, existing_folders) {
    if (!Array.isArray(existing_folders)) return null;
    const limit = Math.min(existing_folders.length, MAX_FOLDERS);
    for (let i = 0; i < limit; i += 1) {
        const folder = existing_folders[i];
        if (!folder || typeof folder.id !== 'string') continue;
        const id_lower = folder.id.trim().toLowerCase();
        const name_lower = String(folder.name ?? '').trim().toLowerCase();
        if (id_lower === bucket.coral_id || id_lower === bucket.key || bucket.aliases.includes(id_lower)) {
            return folder;
        }
        if (name_lower.length > 0 && bucket.aliases.includes(name_lower)) {
            return folder;
        }
    }
    return null;
}

export function plan_overflow_grouping(
    loose_apps,
    existing_folders = [],
    page_capacity = 24,
    mode = 'overflow-only',
) {
    const safe_apps = Array.isArray(loose_apps) ? loose_apps.slice(0, MAX_GRID_APPS) : [];
    const safe_folders = Array.isArray(existing_folders) ? existing_folders.slice(0, MAX_FOLDERS) : [];
    const capacity = Math.max(12, Math.min(48, Math.round(Number(page_capacity) || 24)));
    const unique_apps = [];
    const seen_app_ids = new Set();
    for (let i = 0; i < safe_apps.length; i += 1) {
        const app = safe_apps[i];
        if (!app || typeof app.id !== 'string' || app.id.length === 0 || seen_app_ids.has(app.id)) continue;
        seen_app_ids.add(app.id);
        unique_apps.push(app);
    }
    const active_folders = safe_folders.filter((f) => Array.isArray(f?.apps) && f.apps.length > 0);
    let top_level_count = unique_apps.length + active_folders.length;

    if (mode !== 'all-categories' && top_level_count <= capacity) {
        return {
            triggered: false,
            initial_top_level: top_level_count,
            final_top_level: top_level_count,
            page_capacity: capacity,
            assignments: [],
        };
    }

    const grouped_by_key = new Map();
    for (let i = 0; i < unique_apps.length; i += 1) {
        const app = unique_apps[i];
        const bucket = classify_app_category(app.categories);
        if (!bucket) continue;
        if (!grouped_by_key.has(bucket.key)) grouped_by_key.set(bucket.key, { bucket, app_ids: [] });
        grouped_by_key.get(bucket.key).app_ids.push(app.id);
    }

    const candidates = [];
    for (const { bucket, app_ids } of grouped_by_key.values()) {
        const existing = find_existing_folder_for_bucket(bucket, safe_folders);
        const existing_has_apps = Boolean(existing && Array.isArray(existing.apps) && existing.apps.length > 0);
        const saved_slots = existing_has_apps ? app_ids.length : app_ids.length - 1;
        if (mode === 'all-categories') {
            if (existing_has_apps ? app_ids.length >= 1 : app_ids.length >= 2) {
                candidates.push({ bucket, existing, existing_has_apps, app_ids, saved_slots });
            }
        } else if (saved_slots >= 1) {
            candidates.push({ bucket, existing, existing_has_apps, app_ids, saved_slots });
        }
    }

    candidates.sort((a, b) => {
        if (b.saved_slots !== a.saved_slots) return b.saved_slots - a.saved_slots;
        if (a.existing_has_apps !== b.existing_has_apps) return a.existing_has_apps ? -1 : 1;
        return b.app_ids.length - a.app_ids.length;
    });

    const assignments = [];
    const initial_top_level = top_level_count;
    for (let i = 0; i < candidates.length; i += 1) {
        if (mode !== 'all-categories' && top_level_count <= capacity) break;
        const c = candidates[i];
        assignments.push({
            folder_id: c.existing ? c.existing.id : c.bucket.coral_id,
            folder_name: c.existing && c.existing.name ? c.existing.name : c.bucket.label,
            is_new_folder: !c.existing,
            category_key: c.bucket.key,
            added_app_ids: c.app_ids,
            saved_slots: c.saved_slots,
        });
        top_level_count -= c.saved_slots;
    }

    return {
        triggered: assignments.length > 0,
        initial_top_level,
        final_top_level: top_level_count,
        page_capacity: capacity,
        assignments,
    };
}
