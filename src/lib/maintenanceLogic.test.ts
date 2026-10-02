import { describe, it, expect } from 'vitest';
import {
  createList,
  createEntry,
  updateEntry,
  setEntryDone,
  setEntryProvisional,
  isProvisionalOverdue,
  isValidDateStr,
  deleteEntry,
  addUser,
  updateUser,
  removeUser,
  updateSettings,
  findActiveUser,
  normalizeKuerzel,
  isValidKuerzel,
  MaintenanceList,
  Actor,
} from './maintenanceLogic';

const NOW = '2026-10-02T10:00:00.000Z';
const LATER = '2026-10-02T11:00:00.000Z';
let idCounter = 0;
const newId = () => `id-${++idCounter}`;

const admin: Actor = { type: 'admin' };
const user = (k: string): Actor => ({ type: 'user', kuerzel: k });

function baseList(): MaintenanceList {
  const r = createList({ code: 'ih', name: 'Test', locations: ['Werk Nord', 'Werk Süd'], firstUser: { kuerzel: 'ih1', name: 'Ina Hoff' } }, NOW);
  if (!r.ok) throw new Error(r.error);
  let list = r.list;
  const m = addUser(list, user('IH1'), { kuerzel: 'ma1', name: 'Max Meier', role: 'melder' }, NOW);
  if (!m.ok) throw new Error(m.error);
  list = m.list;
  const m2 = addUser(list, user('IH1'), { kuerzel: 'mb2', name: 'Berta B', role: 'melder' }, NOW);
  if (!m2.ok) throw new Error(m2.error);
  return m2.list;
}

const validEntry = {
  location: 'Werk Nord',
  area: 'Halle 2',
  machine: 'CNC-01',
  description: 'Kühlmittelpumpe tropft',
  discipline: 'mechanisch',
  urgency: 'hoch',
};

function withEntry(list: MaintenanceList, by = 'MA1') {
  const r = createEntry(list, user(by), validEntry, NOW, newId);
  if (!r.ok) throw new Error(r.error);
  return { list: r.list, entry: r.value };
}

describe('Kürzel', () => {
  it('normalisiert und validiert', () => {
    expect(normalizeKuerzel(' mt ')).toBe('MT');
    expect(normalizeKuerzel('a b/c!')).toBe('ABC');
    expect(normalizeKuerzel('abcdefghijkl')).toBe('ABCDEFGH');
    expect(isValidKuerzel('M')).toBe(false);
    expect(isValidKuerzel('MT')).toBe(true);
    expect(isValidKuerzel('')).toBe(false);
  });
});

describe('createList', () => {
  it('legt Liste mit Standardstandorten und erstem Instandhaltungs-Kürzel an', () => {
    const r = createList({ code: ' ih-1 ', firstUser: { kuerzel: 'xy' } }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.list.listCode).toBe('IH-1');
    expect(r.list.locations.length).toBe(2);
    expect(r.list.users).toEqual([{ kuerzel: 'XY', name: '', role: 'instandhaltung', active: true }]);
    expect(r.list.version).toBe(1);
    expect(r.list.nextNumber).toBe(1);
  });
  it('lehnt leeren Code und ungültiges Kürzel ab', () => {
    expect(createList({ code: '###' }, NOW).ok).toBe(false);
    expect(createList({ code: 'A', firstUser: { kuerzel: 'x' } }, NOW).ok).toBe(false);
  });
  it('lehnt doppelte Standorte ab', () => {
    expect(createList({ code: 'A', locations: ['Nord', 'nord'] }, NOW).ok).toBe(false);
  });
});

describe('findActiveUser', () => {
  it('ist case-insensitiv und ignoriert deaktivierte', () => {
    const list = baseList();
    expect(findActiveUser(list, 'ma1')?.kuerzel).toBe('MA1');
    const off = updateUser(list, user('IH1'), 'MA1', { active: false }, LATER);
    expect(off.ok).toBe(true);
    if (!off.ok) return;
    expect(findActiveUser(off.list, 'MA1')).toBeNull();
    expect(findActiveUser(list, 'nope')).toBeNull();
    expect(findActiveUser(list, '')).toBeNull();
  });
});

describe('createEntry', () => {
  it('vergibt fortlaufende Nummern, rev 1 und setzt Ersteller aus dem Kürzel', () => {
    let list = baseList();
    const a = withEntry(list, 'MA1');
    const b = withEntry(a.list, 'MB2');
    expect(a.entry.number).toBe(1);
    expect(b.entry.number).toBe(2);
    expect(a.entry.rev).toBe(1);
    expect(a.entry.createdBy).toBe('MA1');
    expect(b.entry.createdBy).toBe('MB2');
    expect(a.entry.done).toBe(false);
    expect(b.list.entries.length).toBe(2);
    expect(b.list.version).toBe(list.version + 2);
  });
  it('ignoriert eingeschmuggelte Felder (Whitelist)', () => {
    const list = baseList();
    const r = createEntry(list, user('MA1'), { ...validEntry, createdBy: 'HACK', rev: 99, done: true, number: 500, id: 'x' }, NOW, newId);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.createdBy).toBe('MA1');
    expect(r.value.rev).toBe(1);
    expect(r.value.done).toBe(false);
    expect(r.value.number).toBe(1);
    expect(r.value.id).not.toBe('x');
  });
  it('verlangt alle Pflichtfelder und gültige Werte', () => {
    const list = baseList();
    for (const key of Object.keys(validEntry)) {
      const bad: any = { ...validEntry };
      delete bad[key];
      const r = createEntry(list, user('MA1'), bad, NOW, newId);
      expect(r.ok, `Feld ${key} fehlt`).toBe(false);
      if (!r.ok) expect(r.status).toBe(400);
    }
    expect(createEntry(list, user('MA1'), { ...validEntry, location: 'Mars' }, NOW, newId).ok).toBe(false);
    expect(createEntry(list, user('MA1'), { ...validEntry, discipline: 'sonstiges' }, NOW, newId).ok).toBe(false);
    expect(createEntry(list, user('MA1'), { ...validEntry, urgency: 'egal' }, NOW, newId).ok).toBe(false);
    expect(createEntry(list, user('MA1'), { ...validEntry, machine: '   ' }, NOW, newId).ok).toBe(false);
    expect(createEntry(list, user('MA1'), null, NOW, newId).ok).toBe(false);
  });
  it('kürzt zu lange Texte', () => {
    const list = baseList();
    const r = createEntry(list, user('MA1'), { ...validEntry, description: 'x'.repeat(5000) }, NOW, newId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.description.length).toBe(2000);
  });
  it('weist unbekannte, deaktivierte und Admin-Akteure ab', () => {
    const list = baseList();
    const unknown = createEntry(list, user('ZZZ'), validEntry, NOW, newId);
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.status).toBe(401);
    const adm = createEntry(list, admin, validEntry, NOW, newId);
    expect(adm.ok).toBe(false);
    if (!adm.ok) expect(adm.status).toBe(403);
    const off = updateUser(list, user('IH1'), 'MA1', { active: false }, NOW);
    if (!off.ok) throw new Error('setup');
    expect(createEntry(off.list, user('MA1'), validEntry, NOW, newId).ok).toBe(false);
  });
  it('verändert die übergebene Liste nicht', () => {
    const list = baseList();
    const snapshot = JSON.stringify(list);
    createEntry(list, user('MA1'), validEntry, NOW, newId);
    expect(JSON.stringify(list)).toBe(snapshot);
  });
});

describe('updateEntry', () => {
  it('Ersteller darf eigenen offenen Eintrag ändern, rev steigt', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const r = updateEntry(list, user('MA1'), entry.id, { urgency: 'sofort' }, entry.rev, LATER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.urgency).toBe('sofort');
    expect(r.value.machine).toBe('CNC-01'); // unverändert
    expect(r.value.rev).toBe(2);
    expect(r.value.updatedBy).toBe('MA1');
    expect(r.value.createdBy).toBe('MA1');
  });
  it('Melder darf fremde Einträge nicht ändern, Instandhaltung schon', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const other = updateEntry(list, user('MB2'), entry.id, { urgency: 'niedrig' }, entry.rev, LATER);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.status).toBe(403);
    const ih = updateEntry(list, user('IH1'), entry.id, { urgency: 'niedrig' }, entry.rev, LATER);
    expect(ih.ok).toBe(true);
  });
  it('Melder darf erledigten Eintrag nicht mehr ändern', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const done = setEntryDone(list, user('IH1'), entry.id, true, 'Dichtung getauscht', entry.rev, LATER);
    if (!done.ok) throw new Error('setup');
    const r = updateEntry(done.list, user('MA1'), entry.id, { description: 'neu' }, done.value.rev, LATER);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
  it('erkennt Revisionskonflikte: zwei Änderungen mit gleicher baseRev -> genau eine gewinnt', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const first = updateEntry(list, user('IH1'), entry.id, { urgency: 'sofort' }, entry.rev, LATER);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = updateEntry(first.list, user('MA1'), entry.id, { description: 'anders' }, entry.rev, LATER);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.status).toBe(409);
    expect(second.currentEntry?.urgency).toBe('sofort');
    expect(second.currentEntry?.rev).toBe(2);
  });
  it('verlangt numerische baseRev', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    expect(updateEntry(list, user('MA1'), entry.id, { urgency: 'niedrig' }, undefined, LATER).ok).toBe(false);
    expect(updateEntry(list, user('MA1'), entry.id, { urgency: 'niedrig' }, '1', LATER).ok).toBe(false);
  });
  it('404 bei unbekanntem Eintrag, Fehler bei ungültigem Wert ändert nichts', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const nf = updateEntry(list, user('MA1'), 'nope', { urgency: 'niedrig' }, 1, LATER);
    expect(nf.ok).toBe(false);
    if (!nf.ok) {
      expect(nf.status).toBe(404);
      expect(nf.currentEntry).toBeNull();
    }
    const bad = updateEntry(list, user('MA1'), entry.id, { urgency: 'quatsch' }, entry.rev, LATER);
    expect(bad.ok).toBe(false);
  });
  it('lehnt Standort ausserhalb der Liste ab', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    expect(updateEntry(list, user('MA1'), entry.id, { location: 'Mars' }, entry.rev, LATER).ok).toBe(false);
  });
});

describe('setEntryDone', () => {
  it('nur Instandhaltung; setzt doneBy/doneAt/doneNote und kann wieder geöffnet werden', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const denied = setEntryDone(list, user('MA1'), entry.id, true, '', entry.rev, LATER);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe(403);

    const done = setEntryDone(list, user('IH1'), entry.id, true, '  Pumpe getauscht ', entry.rev, LATER);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.value.done).toBe(true);
    expect(done.value.doneBy).toBe('IH1');
    expect(done.value.doneAt).toBe(LATER);
    expect(done.value.doneNote).toBe('Pumpe getauscht');
    expect(done.value.rev).toBe(2);

    const reopened = setEntryDone(done.list, user('IH1'), entry.id, false, '', done.value.rev, LATER);
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.done).toBe(false);
    expect(reopened.value.doneBy).toBeUndefined();
    expect(reopened.value.doneAt).toBeUndefined();
    expect(reopened.value.doneNote).toBeUndefined();
  });
  it('zweimal "erledigt" mit gleicher rev -> zweites ist ein Konflikt', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const a = setEntryDone(list, user('IH1'), entry.id, true, '', entry.rev, LATER);
    if (!a.ok) throw new Error('setup');
    const b = setEntryDone(a.list, user('IH1'), entry.id, true, '', entry.rev, LATER);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.status).toBe(409);
  });
  it('lehnt nicht-boolesche Werte ab', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    expect(setEntryDone(list, user('IH1'), entry.id, 'ja', '', entry.rev, LATER).ok).toBe(false);
  });
});

describe('deleteEntry', () => {
  it('Ersteller darf eigenen offenen Eintrag löschen, fremde nicht', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const other = deleteEntry(list, user('MB2'), entry.id, entry.rev, LATER);
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.status).toBe(403);
    const own = deleteEntry(list, user('MA1'), entry.id, entry.rev, LATER);
    expect(own.ok).toBe(true);
    if (own.ok) expect(own.list.entries.length).toBe(0);
  });
  it('erledigte Einträge nur durch Instandhaltung', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const done = setEntryDone(list, user('IH1'), entry.id, true, '', entry.rev, LATER);
    if (!done.ok) throw new Error('setup');
    expect(deleteEntry(done.list, user('MA1'), entry.id, done.value.rev, LATER).ok).toBe(false);
    expect(deleteEntry(done.list, user('IH1'), entry.id, done.value.rev, LATER).ok).toBe(true);
  });
  it('veraltete rev -> 409; Nummern werden nach dem Löschen nicht neu vergeben', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const edited = updateEntry(list, user('MA1'), entry.id, { urgency: 'niedrig' }, entry.rev, LATER);
    if (!edited.ok) throw new Error('setup');
    const stale = deleteEntry(edited.list, user('MA1'), entry.id, entry.rev, LATER);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.status).toBe(409);
    const del = deleteEntry(edited.list, user('MA1'), entry.id, edited.value.rev, LATER);
    if (!del.ok) throw new Error('setup');
    const next = createEntry(del.list, user('MA1'), validEntry, LATER, newId);
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.value.number).toBe(2);
  });
  it('löschen eines schon gelöschten Eintrags -> 404', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const del = deleteEntry(list, user('MA1'), entry.id, entry.rev, LATER);
    if (!del.ok) throw new Error('setup');
    const again = deleteEntry(del.list, user('MA1'), entry.id, entry.rev, LATER);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe(404);
  });
});

describe('Benutzerverwaltung', () => {
  it('Melder darf keine Kürzel verwalten, Instandhaltung und Admin schon', () => {
    const list = baseList();
    const m = addUser(list, user('MA1'), { kuerzel: 'new', role: 'melder' }, NOW);
    expect(m.ok).toBe(false);
    if (!m.ok) expect(m.status).toBe(403);
    expect(addUser(list, user('IH1'), { kuerzel: 'new', role: 'melder' }, NOW).ok).toBe(true);
    expect(addUser(list, admin, { kuerzel: 'new', role: 'melder' }, NOW).ok).toBe(true);
  });
  it('lehnt doppelte Kürzel (auch anderer Schreibweise), ungültige Kürzel und Rollen ab', () => {
    const list = baseList();
    const dup = addUser(list, admin, { kuerzel: 'ma1', role: 'melder' }, NOW);
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.status).toBe(409);
    expect(addUser(list, admin, { kuerzel: 'x', role: 'melder' }, NOW).ok).toBe(false);
    expect(addUser(list, admin, { kuerzel: 'abc', role: 'chef' }, NOW).ok).toBe(false);
  });
  it('Aussperr-Schutz: letzte aktive Instandhaltung kann nicht entfernt/deaktiviert/herabgestuft werden', () => {
    const list = baseList(); // nur IH1 ist Instandhaltung
    expect(removeUser(list, admin, 'IH1', LATER).ok).toBe(false);
    expect(updateUser(list, admin, 'IH1', { active: false }, LATER).ok).toBe(false);
    expect(updateUser(list, admin, 'IH1', { role: 'melder' }, LATER).ok).toBe(false);
    // mit einer zweiten Instandhaltung geht es
    const two = addUser(list, admin, { kuerzel: 'ih2', role: 'instandhaltung' }, NOW);
    if (!two.ok) throw new Error('setup');
    expect(removeUser(two.list, admin, 'IH1', LATER).ok).toBe(true);
    expect(updateUser(two.list, admin, 'IH1', { active: false }, LATER).ok).toBe(true);
  });
  it('Liste ganz ohne Instandhaltung: Anlegen eines Melders ist erlaubt (Admin richtet erst ein)', () => {
    const r = createList({ code: 'LEER' }, NOW);
    if (!r.ok) throw new Error('setup');
    expect(addUser(r.list, admin, { kuerzel: 'ab', role: 'melder' }, NOW).ok).toBe(true);
  });
  it('Änderung des Namens wirkt, unbekanntes Kürzel -> 404', () => {
    const list = baseList();
    const r = updateUser(list, admin, 'ma1', { name: 'Maximilian' }, LATER);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.name).toBe('Maximilian');
    const nf = updateUser(list, admin, 'qq', { name: 'x' }, LATER);
    expect(nf.ok).toBe(false);
    if (!nf.ok) expect(nf.status).toBe(404);
  });
  it('deaktiviertes Kürzel kann nichts mehr verwalten', () => {
    const two = addUser(baseList(), admin, { kuerzel: 'ih2', role: 'instandhaltung' }, NOW);
    if (!two.ok) throw new Error('setup');
    const off = updateUser(two.list, admin, 'IH2', { active: false }, NOW);
    if (!off.ok) throw new Error('setup');
    expect(addUser(off.list, user('IH2'), { kuerzel: 'zz', role: 'melder' }, NOW).ok).toBe(false);
  });
  it('Einträge bleiben nach Löschen des Kürzels mit dem Kürzel-Text erhalten', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const rm = removeUser(list, admin, 'MA1', LATER);
    expect(rm.ok).toBe(true);
    if (rm.ok) expect(rm.list.entries[0].createdBy).toBe(entry.createdBy);
  });
});

describe('Einstellungen', () => {
  it('Standort hinzufügen und umbenennen des Listennamens', () => {
    const list = baseList();
    const r = updateSettings(list, user('IH1'), { listName: 'Neu', locations: ['Werk Nord', 'Werk Süd', 'Lager'] }, LATER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.list.locations).toEqual(['Werk Nord', 'Werk Süd', 'Lager']);
    expect(r.list.listName).toBe('Neu');
    expect(r.list.version).toBe(list.version + 1);
  });
  it('Standort, der noch verwendet wird, kann nicht entfernt werden', () => {
    const { list } = withEntry(baseList(), 'MA1'); // Eintrag in "Werk Nord"
    const r = updateSettings(list, admin, { locations: ['Werk Süd'] }, LATER);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(409);
    expect(updateSettings(list, admin, { locations: ['Werk Nord'] }, LATER).ok).toBe(true);
  });
  it('lehnt leere Standortliste, Duplikate und Melder ab', () => {
    const list = baseList();
    expect(updateSettings(list, admin, { locations: [] }, LATER).ok).toBe(false);
    expect(updateSettings(list, admin, { locations: ['A', 'a'] }, LATER).ok).toBe(false);
    expect(updateSettings(list, admin, { locations: 'A' }, LATER).ok).toBe(false);
    expect(updateSettings(list, admin, { listName: '  ' }, LATER).ok).toBe(false);
    const m = updateSettings(list, user('MA1'), { listName: 'x' }, LATER);
    expect(m.ok).toBe(false);
    if (!m.ok) expect(m.status).toBe(403);
  });
});

describe('setEntryProvisional (provisorisch behoben)', () => {
  it('nur Instandhaltung; Notiz Pflicht; Eintrag bleibt offen', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const denied = setEntryProvisional(list, user('MA1'), entry.id, true, 'Schelle', entry.rev, LATER);
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.status).toBe(403);

    const noNote = setEntryProvisional(list, user('IH1'), entry.id, true, '   ', entry.rev, LATER);
    expect(noNote.ok).toBe(false);
    if (!noNote.ok) expect(noNote.status).toBe(400);

    const ok = setEntryProvisional(list, user('IH1'), entry.id, true, ' Schlauch abgedichtet, Tausch folgt ', entry.rev, LATER);
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.value.provisional).toBe(true);
    expect(ok.value.done).toBe(false);
    expect(ok.value.provisionalBy).toBe('IH1');
    expect(ok.value.provisionalAt).toBe(LATER);
    expect(ok.value.provisionalNote).toBe('Schlauch abgedichtet, Tausch folgt');
    expect(ok.value.rev).toBe(2);
  });
  it('zurücknehmen entfernt den Vermerk', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const p = setEntryProvisional(list, user('IH1'), entry.id, true, 'x', entry.rev, LATER);
    if (!p.ok) throw new Error('setup');
    const back = setEntryProvisional(p.list, user('IH1'), entry.id, false, '', p.value.rev, LATER);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value.provisional).toBeUndefined();
    expect(back.value.provisionalNote).toBeUndefined();
    expect(back.value.done).toBe(false);
  });
  it('endgültig erledigen entfernt den Provisorium-Vermerk', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const p = setEntryProvisional(list, user('IH1'), entry.id, true, 'x', entry.rev, LATER);
    if (!p.ok) throw new Error('setup');
    const d = setEntryDone(p.list, user('IH1'), entry.id, true, 'Schlauch getauscht', p.value.rev, LATER);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.value.done).toBe(true);
    expect(d.value.provisional).toBeUndefined();
    expect(d.value.provisionalBy).toBeUndefined();
    expect(d.value.doneNote).toBe('Schlauch getauscht');
  });
  it('bei erledigtem Eintrag nicht möglich; Revisionskonflikt wird erkannt; ungültiger Wert', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const d = setEntryDone(list, user('IH1'), entry.id, true, '', entry.rev, LATER);
    if (!d.ok) throw new Error('setup');
    const onDone = setEntryProvisional(d.list, user('IH1'), entry.id, true, 'x', d.value.rev, LATER);
    expect(onDone.ok).toBe(false);
    if (!onDone.ok) expect(onDone.status).toBe(400);

    const stale = setEntryProvisional(d.list, user('IH1'), entry.id, true, 'x', entry.rev, LATER);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.status).toBe(409);

    expect(setEntryProvisional(list, user('IH1'), entry.id, 'ja', 'x', entry.rev, LATER).ok).toBe(false);
  });
  it('zwei gleichzeitige Aktionen (provisorisch + erledigt) mit gleicher rev: genau eine gewinnt', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const a = setEntryProvisional(list, user('IH1'), entry.id, true, 'x', entry.rev, LATER);
    if (!a.ok) throw new Error('setup');
    const b = setEntryDone(a.list, user('IH1'), entry.id, true, '', entry.rev, LATER);
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.status).toBe(409);
  });
});

describe('Wiedervorlage (Nachbearbeiten bis)', () => {
  it('isValidDateStr prüft Format und echte Kalenderdaten', () => {
    expect(isValidDateStr('2026-10-15')).toBe(true);
    expect(isValidDateStr('2026-02-30')).toBe(false);
    expect(isValidDateStr('15.10.2026')).toBe(false);
    expect(isValidDateStr('')).toBe(false);
    expect(isValidDateStr(20261015)).toBe(false);
  });
  it('Datum wird gespeichert, optional, und ungültiges Datum abgelehnt', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const withDue = setEntryProvisional(list, user('IH1'), entry.id, true, 'x', entry.rev, LATER, '2026-10-20');
    expect(withDue.ok).toBe(true);
    if (withDue.ok) expect(withDue.value.provisionalDue).toBe('2026-10-20');
    const noDue = setEntryProvisional(list, user('IH1'), entry.id, true, 'x', entry.rev, LATER, '');
    expect(noDue.ok).toBe(true);
    if (noDue.ok) expect(noDue.value.provisionalDue).toBeUndefined();
    const bad = setEntryProvisional(list, user('IH1'), entry.id, true, 'x', entry.rev, LATER, '2026-13-40');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe(400);
  });
  it('Frist und Notiz lassen sich bei bestehendem Provisorium ändern', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const a = setEntryProvisional(list, user('IH1'), entry.id, true, 'alt', entry.rev, LATER, '2026-10-10');
    if (!a.ok) throw new Error('setup');
    const b = setEntryProvisional(a.list, user('IH1'), entry.id, true, 'neu', a.value.rev, LATER, '2026-11-01');
    expect(b.ok).toBe(true);
    if (b.ok) {
      expect(b.value.provisionalNote).toBe('neu');
      expect(b.value.provisionalDue).toBe('2026-11-01');
    }
  });
  it('Frist verschwindet beim Zurücknehmen und beim endgültigen Erledigen', () => {
    const { list, entry } = withEntry(baseList(), 'MA1');
    const a = setEntryProvisional(list, user('IH1'), entry.id, true, 'x', entry.rev, LATER, '2026-10-10');
    if (!a.ok) throw new Error('setup');
    const back = setEntryProvisional(a.list, user('IH1'), entry.id, false, '', a.value.rev, LATER);
    expect(back.ok && back.value.provisionalDue).toBeFalsy();
    const done = setEntryDone(a.list, user('IH1'), entry.id, true, '', a.value.rev, LATER);
    expect(done.ok && done.value.provisionalDue).toBeFalsy();
  });
  it('isProvisionalOverdue: nur offen+provisorisch+Frist vor heute', () => {
    const base = { done: false, provisional: true, provisionalDue: '2026-10-10' };
    expect(isProvisionalOverdue(base, '2026-10-11')).toBe(true);
    expect(isProvisionalOverdue(base, '2026-10-10')).toBe(false); // am Stichtag noch nicht überfällig
    expect(isProvisionalOverdue(base, '2026-10-09')).toBe(false);
    expect(isProvisionalOverdue({ ...base, done: true }, '2026-12-01')).toBe(false);
    expect(isProvisionalOverdue({ ...base, provisional: false }, '2026-12-01')).toBe(false);
    expect(isProvisionalOverdue({ ...base, provisionalDue: undefined }, '2026-12-01')).toBe(false);
  });
});
