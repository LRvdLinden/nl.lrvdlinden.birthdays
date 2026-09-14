'use strict';

module.exports = [
  {
    method: 'POST', path: '/ical/sync',
    fn: async ({ homey }) => homey.app.syncIcalSources(true),
  },
  {
    method: 'POST', path: '/ical/import',
    fn: async ({ homey, body }) => homey.app.importIcalUpload(body || {}),
  },
  {
    method: 'GET', path: '/ical/status',
    fn: async ({ homey }) => homey.settings.get('icalSyncStatus') || {},
  },
];
