/*
 *  Fusion UI
 *  Copyright (C) 2025 Kylantis, Inc
 *  
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *  
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *  
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

// eslint-disable-next-line no-undef
class WebRenderer extends CustomCtxRenderer {

  constructor({
    id, input, logger, config, isRoot,
  } = {}) {
    super({
      id, input, logger, config, isRoot,
    });
  }

  // #API
  isHeadlessContext() {
    return !self.appContext || self.appContext.server;
  }

  load(opts) {
    let deps = [];
    // eslint-disable-next-line no-restricted-globals
    if (!this.isHeadlessContext() && !this.isRoot() && !this.isServerRendered()) {
      deps = [
        this.loadCSSDependencies(),
        this.loadJSDependencies(),
      ];
    }
    return Promise.all(deps).then(() => super.load(opts));
  }

  cssDependencies() {
    return this.getSyntheticMethod({ name: 'ownCssDependencies' })()
  }

  jsDependencies() {
    return this.getSyntheticMethod({ name: 'ownJsDependencies' })()
  }

  loadCSSDependencies() {
    return self.appContext.loadCSSDependencies(
      this.cssDependencies()
    );
  }

  loadJSDependencies() {
    return self.appContext.loadJSDependencies(
      this.jsDependencies()
    );
  }
}

module.exports = WebRenderer;
