import { itemFor, getDocument } from './items.js';

const CAPACITY = 14;

export class Inventory {
  constructor() {
    this.slots = [];       // { id, count }
    this.documents = [];   // document ids (journal — does not use slots)
    this.version = 0;
  }

  get used() { return this.slots.length; }
  get capacity() { return CAPACITY; }

  count(id) {
    const s = this.slots.find((x) => x.id === id);
    return s ? s.count : 0;
  }
  has(id) { return this.count(id) > 0; }
  hasAny(ids) { return ids.some((i) => this.has(i)); }

  add(id, count = 1) {
    const def = itemFor(id);
    if (def.kind === 'documents') {
      if (!this.documents.includes(id)) {
        this.documents.push(id);
        this.version++;
        return { ok: true, document: true, name: def.name };
      }
      return { ok: false, duplicate: true, name: def.name };
    }
    const existing = this.slots.find((s) => s.id === id);
    if (existing && (def.stack || def.kind === 'batteries' || def.kind === 'medicines')) {
      existing.count += count;
      this.version++;
      return { ok: true, name: def.name, count: existing.count };
    }
    if (this.slots.length >= CAPACITY) return { ok: false, full: true, name: def.name };
    this.slots.push({ id, count });
    this.version++;
    return { ok: true, name: def.name };
  }

  remove(id, count = 1) {
    const i = this.slots.findIndex((s) => s.id === id);
    if (i < 0) return false;
    this.slots[i].count -= count;
    if (this.slots[i].count <= 0) this.slots.splice(i, 1);
    this.version++;
    return true;
  }

  hasDocument(id) { return this.documents.includes(id); }

  toJSON() {
    return { slots: this.slots.map((s) => ({ ...s })), documents: [...this.documents] };
  }
  fromJSON(data) {
    this.slots = (data?.slots || []).filter((s) => itemFor(s.id));
    this.documents = [...new Set(data?.documents || [])];
    this.version++;
  }

  list() {
    return this.slots.map((s) => ({ ...s, def: itemFor(s.id) }));
  }
  documentList() {
    return this.documents.map((id) => ({ id, def: itemFor(id), doc: getDocument(id) }));
  }
}
