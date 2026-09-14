'use strict';

module.exports = {
  async icalSync({ homey }) {
    return homey.app.syncIcalSources(true);
  },

  async icalImport({ homey, body }) {
    return homey.app.importIcalUpload(body || {});
  },

  async icalStatus({ homey }) {
    return homey.settings.get('icalSyncStatus') || {};
  },
};
