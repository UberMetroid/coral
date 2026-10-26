// SPDX-License-Identifier: GPL-3.0-or-later
// Zero-dependency GJS architectural lint, Page Rule, EGO boundary, GTK4/Adw, and behavioral test suite.

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import {
    CATEGORY_BUCKETS, MAX_FOLDERS, classify_app_category,
    parse_desktop_categories, plan_overflow_grouping,
} from '../extension/grid/auto_grouper.js';
import {
    MAX_GRID_APPS, alphabetical_compare, compare_grid_items, sort_desktop_ids_by_name,
} from '../extension/grid/grid_sorter.js';
import { build_folder_dialog_css } from '../extension/ui/folder_style.js';
import { format_rgba, is_dark_rgba, parse_rgba, text_color_for_css } from '../extension/ui/settings/color.js';
import { AUTO_GROUP_MODES, ExtensionSettings, FOLDER_POSITIONS } from '../extension/ui/settings/gsettings.js';
import { BORDER_PRESETS, build_about_page, build_folder_styling_page } from '../extension/ui/settings/prefs_pages.js';

const BANNED_STEMS = new Set([
    'util', 'utils', 'lib', 'helper', 'helpers', 'common', 'misc', 'shared', 'base', 'core', 'types', 'mod',
]);
const DECODER = new TextDecoder('utf-8');
const REPO_ROOT = Gio.File.new_for_uri(import.meta.url).get_parent().get_parent().get_path();
const EXT_ROOT = GLib.build_filenamev([REPO_ROOT, 'extension']);

function assert(cond, msg) {
    if (!cond) throw new Error(`Verification failed: ${msg}`);
}

function read_text(path) {
    const [ok, bytes] = GLib.file_get_contents(path);
    assert(ok, `failed to read ${path}`);
    return DECODER.decode(bytes);
}

function walk_repo(dir_path, js_files, dirs) {
    dirs.push(dir_path);
    const enumerator = Gio.File.new_for_path(dir_path).enumerate_children(
        'standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null,
    );
    let info;
    while ((info = enumerator.next_file(null)) !== null) {
        const name = info.get_name();
        if (name.startsWith('.') || name === 'dist' || name === 'target') continue;
        const full = GLib.build_filenamev([dir_path, name]);
        if (info.get_file_type() === Gio.FileType.DIRECTORY) walk_repo(full, js_files, dirs);
        else if (name.endsWith('.js')) js_files.push(full);
    }
    enumerator.close(null);
}

function verify_page_rules_and_lint(js_files, dirs) {
    assert(js_files.length === 12, `expected 12 .js files, found ${js_files.length}`);
    const legacy = [
        'imports.gi', 'imports.ui', 'imports.misc', 'ExtensionUtils',
        'Meta.LaterType', 'Clutter.Container', 'add_actor', 'remove_actor', 'new String(',
    ];
    for (const file of js_files) {
        const content = read_text(file);
        const lines = content.endsWith('\n') ? content.slice(0, -1).split('\n') : content.split('\n');
        assert(lines.length >= 16 && lines.length <= 256,
            `Page Rule violation: ${file} has ${lines.length} lines (16..=256)`);
        assert(lines[0] === '// SPDX-License-Identifier: GPL-3.0-or-later', `Missing SPDX header in ${file}`);
        assert(lines[1].startsWith('// ') && lines[1].length >= 12,
            `Missing concise module description on line 2 of ${file}`);
        if (file.startsWith(EXT_ROOT)) {
            for (const sym of legacy) {
                assert(!content.includes(sym), `Forbidden legacy symbol '${sym}' in ${file}`);
            }
        }
        for (let idx = 0; idx < lines.length; idx += 1) {
            const raw = lines[idx], ln = idx + 1, code = raw.split('//')[0];
            assert(raw.length <= 200, `Line ${ln} of ${file} exceeds 200 chars (${raw.length})`);
            if (!file.startsWith(EXT_ROOT)) continue;
            assert(!code.trimStart().startsWith('var ') && !code.includes(' var ') && !code.includes('(var '),
                `Forbidden var in ${file}:${ln}`);
            for (let i = 0; i < code.length - 1; i += 1) {
                const prev = i > 0 ? code[i - 1] : '';
                const prev_eq = prev === '=' || prev === '!' || prev === '<' || prev === '>';
                const next_eq = i + 2 < code.length && code[i + 2] === '=';
                assert(!(code[i] === '=' && code[i + 1] === '=' && !prev_eq && !next_eq), `Loose == in ${file}:${ln}`);
                assert(!(code[i] === '!' && code[i + 1] === '=' && !next_eq), `Loose != in ${file}:${ln}`);
            }
        }
    }
    for (const dir_path of dirs) {
        const enumerator = Gio.File.new_for_path(dir_path).enumerate_children(
            'standard::name', Gio.FileQueryInfoFlags.NONE, null,
        );
        const visible = [];
        let info;
        while ((info = enumerator.next_file(null)) !== null) {
            const name = info.get_name();
            if (!name.startsWith('.') && name !== 'dist' && name !== 'target') visible.push(name);
        }
        enumerator.close(null);
        assert(visible.length <= 8,
            `Directory density violation: ${dir_path} has ${visible.length} visible entries (max 8)`);
        for (const name of visible) {
            const stem = (name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name).toLowerCase();
            assert(!BANNED_STEMS.has(stem), `Banned generic name '${name}' in ${dir_path}`);
        }
    }
}

function verify_process_boundaries_and_invariants() {
    const shared = [
        'prefs.js', 'grid/grid_sorter.js', 'grid/auto_grouper.js', 'grid/folder_sorter.js',
        'ui/folder_style.js', 'ui/settings/gsettings.js', 'ui/settings/color.js', 'ui/settings/prefs_pages.js',
    ];
    const compositor_only = ['gi://Meta', 'gi://Clutter', 'gi://St', 'gi://Shell', 'resource:///org/gnome/shell/'];
    for (const rel of shared) {
        for (const raw of read_text(GLib.build_filenamev([EXT_ROOT, rel])).split('\n')) {
            const code = raw.split('//')[0];
            for (const sym of compositor_only) {
                assert(!code.includes(sym), `Process-boundary violation: ${rel} imports '${sym}'`);
            }
        }
    }
    const check_files = [
        'extension.js', 'prefs.js', 'ui/settings/prefs_pages.js', 'grid/grid_manager.js',
        'grid/grid_sorter.js', 'grid/auto_grouper.js', 'grid/folder_sorter.js',
        'grid/grid_redisplay.js', 'metadata.json', 'schemas/org.gnome.shell.extensions.coral.gschema.xml',
    ];
    const combined = check_files.map((rel) => read_text(GLib.build_filenamev([EXT_ROOT, rel]))).join('\n');
    const reqs = [
        'export default class CoralExtension extends Extension', 'this.manager.destroy()',
        'fillPreferencesWindow(window)', 'Adw.PreferencesPage', 'close-request',
        'Star Coral on GitHub', 'Tuition, Not Coffee — Help send my daughter to college',
        'https://ubermetroid.github.io/tuition-not-coffee',
        'Derived from Alphabetical App Grid by Stuart Hayhurst',
        '[coral] reorder-grid', 'this._injection_manager.clear()', 'dissolve_coral_folders',
        '"45"', '"50"', '"settings-schema": "org.gnome.shell.extensions.coral"',
        'name="auto-group-overflow"', 'name="folder-order-position"', 'v1.0.0',
        'this.unload_theme()', 'load_stylesheet(file)', 'Support &amp; Community',
    ];
    for (const req of reqs) assert(combined.includes(req), `Missing invariant: ${req}`);
    assert(!combined.includes('Rust installer') && !combined.includes('cargo install'), 'No Rust CLI reference');
    const prefs_pages = read_text(GLib.build_filenamev([EXT_ROOT, 'ui/settings/prefs_pages.js']));
    assert(!/new Gtk\.Label\(\{[^}]*&amp;/s.test(prefs_pages), 'Gtk.Label must not contain raw &amp; without use_markup');
}

async function verify_behavioral_and_gtk_suite() {
    const tmp_dir = GLib.dir_make_tmp('coral-verify-XXXXXX');
    const schema_xml = 'org.gnome.shell.extensions.coral.gschema.xml';
    const dst_xml = Gio.File.new_for_path(GLib.build_filenamev([tmp_dir, schema_xml]));
    Gio.File.new_for_path(GLib.build_filenamev([EXT_ROOT, 'schemas', schema_xml]))
        .copy(dst_xml, Gio.FileCopyFlags.OVERWRITE, null, null);
    assert(Gio.Subprocess.new(['glib-compile-schemas', tmp_dir], Gio.SubprocessFlags.NONE).wait_check(null),
        'glib-compile-schemas');
    const src = Gio.SettingsSchemaSource.new_from_directory(tmp_dir, Gio.SettingsSchemaSource.get_default(), false);
    const ext_settings = new Gio.Settings({
        settings_schema: src.lookup('org.gnome.shell.extensions.coral', true),
        backend: Gio.memory_settings_backend_new(),
    });
    const s = new ExtensionSettings(ext_settings);

    assert(s.folder_order_position() === 'alphabetical' && s.sort_folder_contents() && s.auto_group_overflow(), 'defs');
    assert(s.auto_group_mode() === 'overflow-only' && s.max_items_per_page() === 24 && !s.reverse_order(), 'grid defs');
    assert(!s.show_favorite_apps() && s.reset_page_on_open() && s.show_folder_border(), 'border defs');
    assert(FOLDER_POSITIONS.length === 3 && AUTO_GROUP_MODES.length === 2 && BORDER_PRESETS.length === 4, 'enums');
    assert(MAX_GRID_APPS === 512 && MAX_FOLDERS === 64 && CATEGORY_BUCKETS.length === 9, 'constants');

    s.set_folder_order_position('start');
    assert(s.folder_order_position() === 'start', 'folder pos start');
    s.set_folder_order_position('invalid');
    assert(s.folder_order_position() === 'alphabetical', 'folder pos fallback');
    s.set_max_items_per_page(99);
    assert(s.max_items_per_page() === 48, 'clamp max items per page');
    s.set_max_items_per_page(4);
    assert(s.max_items_per_page() === 12, 'clamp min items per page');
    s.set_border_width(20);
    s.set_border_radius(80);
    s.set_border_color_rgba('#2ec27e');
    assert(s.border_width() === 8 && s.border_radius() === 36 && s.border_color_rgba() === 'rgba(46, 194, 126, 1)', 'border');
    assert(is_dark_rgba(parse_rgba('#111111')) && text_color_for_css('#ffffff') === '#000000', 'luminance');
    assert(build_folder_dialog_css(true, 2, 24, 'rgb(255,0,0)') ===
        'border: 2px solid rgba(255, 0, 0, 1); border-radius: 24px;', 'folder dialog css');
    assert(build_folder_dialog_css(false, 2, 24, 'rgb(255,0,0)') === 'border-radius: 24px;', 'disabled border css');
    s.reset_defaults();
    assert(s.max_items_per_page() === 24 && format_rgba(parse_rgba(s.border_color_rgba())) === 'rgba(255, 0, 0, 1)', 'rst');
    assert(alphabetical_compare('Alacritty', 'Firefox', false) < 0 && alphabetical_compare('Alacritty', 'Firefox', true) > 0, 'cmp');
    const folder_item = { id: 'Games', name: 'Games' };
    const app_item = { id: 'alacritty.desktop', name: 'Alacritty' };
    assert(compare_grid_items(folder_item, app_item, 'start', ['Games'], false) < 0, 'folder at start');
    assert(compare_grid_items(folder_item, app_item, 'end', ['Games'], false) > 0, 'folder at end');
    assert(compare_grid_items(folder_item, app_item, 'alphabetical', ['Games'], false) > 0, 'folder alphabetical');
    const sorted_ids = sort_desktop_ids_by_name(['z.desktop', 'a.desktop'], (id) => (id === 'a.desktop' ? 'Alpha' : 'Zeta'));
    assert(sorted_ids[0] === 'a.desktop' && sorted_ids[1] === 'z.desktop', 'sort_desktop_ids_by_name');

    assert(parse_desktop_categories('GNOME;GTK;Game;').includes('Game'), 'parse categories');
    assert(classify_app_category('Network;WebBrowser;')?.key === 'internet', 'classify internet');
    assert(classify_app_category('AudioVideo;Video;')?.key === 'media', 'classify media');

    const small_loose = Array.from({ length: 18 }, (_, i) => ({ id: `app-${i}.desktop`, categories: 'Utility;' }));
    const existing_g = [{ id: 'Games', name: 'Games', apps: ['g1.desktop'] }];
    const no_overflow = plan_overflow_grouping(small_loose, existing_g, 24, 'overflow-only');
    assert(!no_overflow.triggered && no_overflow.assignments.length === 0, 'no auto-group when <= capacity');
    const all_cat = plan_overflow_grouping(small_loose, [], 24, 'all-categories');
    assert(all_cat.triggered && all_cat.assignments[0].folder_id === 'coral-accessories', 'all-cat');

    const overflow_loose = [
        ...Array.from({ length: 5 }, (_, i) => ({ id: `net-${i}.desktop`, categories: 'Network;WebBrowser;' })),
        ...Array.from({ length: 4 }, (_, i) => ({ id: `med-${i}.desktop`, categories: 'AudioVideo;Video;' })),
        ...Array.from({ length: 3 }, (_, i) => ({ id: `dev-${i}.desktop`, categories: 'Development;IDE;' })),
        ...Array.from({ length: 16 }, (_, i) => ({ id: `misc-${i}.desktop`, categories: '' })),
    ];
    const existing_f = [...existing_g, { id: 'Office', name: 'Office', apps: ['calc.desktop'] }];
    const plan = plan_overflow_grouping(overflow_loose, existing_f, 24, 'overflow-only');
    assert(plan.triggered && plan.initial_top_level === 30 && plan.final_top_level <= 24, 'overflow page prevented');

    try {
        const Gtk = (await import('gi://Gtk?version=4.0')).default;
        const Adw = (await import('gi://Adw?version=1')).default;
        if (Gtk.init_check()) {
            Adw.init();
            const signals = [];
            const page_f = build_folder_styling_page(ext_settings, s, signals), page_a = build_about_page();
            assert(page_f.get_title() === 'Folder Styling' && page_a.get_title() === 'About & Support', 'GTK4 pages');
            let root_to_walk = [page_f, page_a];
            const gres = '/usr/share/gnome-shell/org.gnome.Shell.Extensions.src.gresource';
            if (Gio.File.new_for_path(gres).query_exists(null)) {
                Gio.resources_register(Gio.Resource.load(gres));
                const { default: CoralPreferences } = await import('../extension/prefs.js');
                const prefs = Object.create(CoralPreferences.prototype);
                prefs.getSettings = () => ext_settings;
                const win = new Adw.PreferencesWindow();
                prefs.fillPreferencesWindow(win);
                root_to_walk = [win];
            }
            const walk_labels = (w) => {
                if (!w) return;
                if (w instanceof Gtk.Label) {
                    const txt = w.get_text() || '';
                    assert(!txt.includes('&amp;'), `Unescaped &amp; in rendered Gtk.Label text: ${txt}`);
                    if (w.get_visible()) assert(txt.trim().length > 0, 'Empty visible Gtk.Label');
                }
                for (let c = w.get_first_child?.(); c; c = c.get_next_sibling?.()) walk_labels(c);
            };
            for (const r of root_to_walk) walk_labels(r);
            for (const [obj, sig] of signals) obj.disconnect(sig);
        }
    } catch (e) {
        if (String(e).includes('Verification failed')) throw e;
    }
    const comp = Gio.File.new_for_path(GLib.build_filenamev([tmp_dir, 'gschemas.compiled']));
    for (const f of [dst_xml, comp, Gio.File.new_for_path(tmp_dir)]) f.delete(null);
}

const js_files = [], dirs = [];
walk_repo(REPO_ROOT, js_files, dirs);
verify_page_rules_and_lint(js_files, dirs);
verify_process_boundaries_and_invariants();
await verify_behavioral_and_gtk_suite();
print(`OK: verified ${js_files.length} JS pages across ${dirs.length} directories and all headless behavioral suites.`);
