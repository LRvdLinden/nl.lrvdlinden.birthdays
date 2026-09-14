'use strict';

const crypto = require('crypto');

function unfold(input) {
  return String(input || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeText(value) {
  return String(value || '').replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function dateFromValue(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function cleanSummary(summary) {
  return unescapeText(summary)
    .replace(/^(birthday|birthday of|birthday:|verjaardag|verjaardag van|geburtstag von|anniversaire de)\s+/i, '')
    .replace(/(?:'s birthday|’s birthday| verjaardag| birthday| geburtstag| anniversaire)$/i, '')
    .trim();
}

function parseIcal(input, sourceId, sourceName) {
  const events = [];
  let event = null;
  for (const line of unfold(input)) {
    if (line === 'BEGIN:VEVENT') { event = {}; continue; }
    if (line === 'END:VEVENT') {
      if (event) {
        const dateOfBirth = dateFromValue(event.dtstart);
        const name = cleanSummary(event.summary);
        if (dateOfBirth && name) {
          const uid = event.uid || crypto.createHash('sha1').update(`${name}|${dateOfBirth}`).digest('hex');
          events.push({
            id: `ical:${sourceId}:${uid}`,
            name,
            dateOfBirth,
            mobile: '', mobile2: '',
            message: event.description ? unescapeText(event.description) : '',
            category: sourceName || 'iCal',
            imageUrl: '', isBaby: true,
            icalSourceId: sourceId, icalUid: uid,
          });
        }
      }
      event = null; continue;
    }
    if (!event) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const property = line.slice(0, separator).split(';')[0].toLowerCase();
    const value = line.slice(separator + 1);
    if (['uid','summary','description','dtstart','rrule'].includes(property)) event[property] = value;
  }
  return events;
}

function mergeSource(existing, imported, sourceId) {
  const manual = (Array.isArray(existing) ? existing : []).filter(person => person.icalSourceId !== sourceId);
  return manual.concat(imported);
}

module.exports = { parseIcal, mergeSource };
