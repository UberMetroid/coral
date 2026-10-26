// SPDX-License-Identifier: GPL-3.0-or-later
// GNOME Shell extension entrypoint (CoralExtension extends Extension) managing enable/disable.

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { GridManager } from './grid/grid_manager.js';

export default class CoralExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this.manager = null;
    }

    enable() {
        if (this.manager !== null) return;
        this.manager = new GridManager(this);
    }

    disable() {
        if (this.manager !== null) {
            this.unload_theme();
            this.manager.destroy();
            this.manager = null;
        }
    }

    unload_theme() {
        if (this.manager !== null) {
            this.manager.unload_theme();
        }
    }
}
