import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

export type StructuredValue = string | number | boolean | null | StructuredValue[] | { [key: string]: StructuredValue };

type Props = {
  value: StructuredValue;
  onChange: (value: StructuredValue) => void;
  rootLabel?: string;
};

type ObjectValue = { [key: string]: StructuredValue };

const longTextTokens = ['text', 'description', 'bio', 'notes', 'summary', 'instructions', 'footerdescription', 'herotext', 'foundertext', 'content', 'message'];
const urlTokens = ['url', 'image', 'logo', 'to', 'link'];
const numberTokens = ['amount', 'price', 'order', 'count', 'days', 'minutes', 'months', 'goal', 'raised', 'supported', 'distributed', 'size'];

function humanize(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function emptyLike(value: StructuredValue): StructuredValue {
  if (Array.isArray(value)) return [];
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, emptyLike(child)]));
  }
  if (typeof value === 'boolean') return false;
  if (typeof value === 'number') return 0;
  return '';
}

function defaultArrayItem(key: string, current: StructuredValue[]): StructuredValue {
  if (current.length) return emptyLike(current[0]);
  const normalized = key.toLowerCase();
  if (normalized.includes('slide')) return { eyebrow: '', title: '', text: '', image: '', primaryLabel: '', primaryTo: '', secondaryLabel: '', secondaryTo: '' };
  if (normalized.includes('link')) return { label: '', to: '', order: 10, enabled: true };
  if (normalized.includes('column')) return { title: '', links: [] };
  if (normalized.includes('item') || normalized.includes('action') || normalized.includes('pillar') || normalized.includes('program')) return { title: '', text: '', icon: '', to: '' };
  return '';
}

function PrimitiveField({ fieldKey, value, onChange }: { fieldKey: string; value: string | number | boolean | null; onChange: (value: StructuredValue) => void }) {
  const normalized = fieldKey.toLowerCase();
  if (typeof value === 'boolean') {
    return <label className="structured-toggle"><span>{humanize(fieldKey)}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)}/><i aria-hidden="true"/></label>;
  }
  if (typeof value === 'number' || numberTokens.some((token) => normalized.includes(token))) {
    return <label className="structured-field"><span>{humanize(fieldKey)}</span><input type="number" step="any" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? 0 : Number(event.target.value))}/></label>;
  }
  const text = value == null ? '' : String(value);
  const isLong = text.length > 90 || longTextTokens.some((token) => normalized.includes(token));
  const type = normalized.includes('email') ? 'email' : normalized.includes('phone') ? 'tel' : urlTokens.some((token) => normalized.includes(token)) ? 'text' : 'text';
  return <label className={`structured-field ${isLong ? 'wide' : ''}`}><span>{humanize(fieldKey)}</span>{isLong ? <textarea rows={4} value={text} onChange={(event) => onChange(event.target.value)}/> : <input type={type} value={text} onChange={(event) => onChange(event.target.value)}/>}</label>;
}

function PrimitiveArrayEditor({ fieldKey, value, onChange }: { fieldKey: string; value: StructuredValue[]; onChange: (value: StructuredValue[]) => void }) {
  const isNumberList = value.every((item) => typeof item === 'number');
  return <section className="structured-array"><div className="structured-section-heading"><div><b>{humanize(fieldKey)}</b><small>Add, remove, and reorder values.</small></div><button type="button" className="admin-mini-button" onClick={() => onChange([...value, isNumberList ? 0 : ''])}><Plus/>Add</button></div><div className="structured-list">{value.map((item, index) => <div className="structured-list-row" key={`${fieldKey}-${index}`}><input type={isNumberList ? 'number' : 'text'} value={String(item ?? '')} onChange={(event) => { const next = [...value]; next[index] = isNumberList ? Number(event.target.value) : event.target.value; onChange(next); }}/><div className="structured-row-actions"><button type="button" className="icon-button" disabled={index === 0} onClick={() => { const next = [...value]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }}><ArrowUp/></button><button type="button" className="icon-button" disabled={index === value.length - 1} onClick={() => { const next = [...value]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; onChange(next); }}><ArrowDown/></button><button type="button" className="icon-button danger" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></button></div></div>)}{!value.length && <p className="structured-empty">No values added yet.</p>}</div></section>;
}

function ObjectEditor({ value, onChange, pathLabel = 'Content' }: { value: ObjectValue; onChange: (value: ObjectValue) => void; pathLabel?: string }) {
  const [newField, setNewField] = useState('');
  const entries = useMemo(() => Object.entries(value), [value]);
  function update(key: string, child: StructuredValue) { onChange({ ...value, [key]: child }); }
  function remove(key: string) { const next = { ...value }; delete next[key]; onChange(next); }
  function addField() {
    const key = newField.trim().replace(/\s+/g, '_');
    if (!key || Object.prototype.hasOwnProperty.call(value, key)) return;
    onChange({ ...value, [key]: '' });
    setNewField('');
  }
  return <div className="structured-object"><div className="structured-object-grid">{entries.map(([key, child]) => {
    if (Array.isArray(child)) {
      const objectList = child.some((item) => item && typeof item === 'object' && !Array.isArray(item));
      if (!objectList) return <PrimitiveArrayEditor key={key} fieldKey={key} value={child} onChange={(next) => update(key, next)}/>;
      return <section className="structured-array object-array" key={key}><div className="structured-section-heading"><div><b>{humanize(key)}</b><small>Manage each item as a simple form.</small></div><button type="button" className="admin-mini-button" onClick={() => update(key, [...child, defaultArrayItem(key, child)])}><Plus/>Add item</button></div><div className="structured-card-list">{child.map((item, index) => <details className="structured-item-card" open={index === 0} key={`${key}-${index}`}><summary><span>{humanize(key)} {index + 1}</span><ChevronDown/></summary><div className="structured-item-body"><ObjectEditor pathLabel={`${pathLabel} / ${humanize(key)} ${index + 1}`} value={(item && typeof item === 'object' && !Array.isArray(item) ? item : {}) as ObjectValue} onChange={(nextItem) => { const next = [...child]; next[index] = nextItem; update(key, next); }}/><div className="structured-item-actions"><button type="button" className="admin-mini-button" disabled={index === 0} onClick={() => { const next = [...child]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; update(key, next); }}><ArrowUp/>Move up</button><button type="button" className="admin-mini-button" disabled={index === child.length - 1} onClick={() => { const next = [...child]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; update(key, next); }}><ArrowDown/>Move down</button><button type="button" className="admin-mini-button danger" onClick={() => update(key, child.filter((_, itemIndex) => itemIndex !== index))}><Trash2/>Remove</button></div></div></details>)}{!child.length && <p className="structured-empty">No items added yet.</p>}</div></section>;
    }
    if (child && typeof child === 'object') {
      return <details className="structured-nested" key={key}><summary><span>{humanize(key)}</span><ChevronDown/></summary><ObjectEditor pathLabel={`${pathLabel} / ${humanize(key)}`} value={child as ObjectValue} onChange={(next) => update(key, next)}/></details>;
    }
    return <div className="structured-field-shell" key={key}><PrimitiveField fieldKey={key} value={child as string | number | boolean | null} onChange={(next) => update(key, next)}/><button type="button" className="structured-delete-field" onClick={() => remove(key)} aria-label={`Remove ${humanize(key)}`}><Trash2/></button></div>;
  })}</div><div className="structured-add-field"><input value={newField} onChange={(event) => setNewField(event.target.value)} placeholder="Add another field, e.g. subtitle"/><button type="button" className="admin-mini-button" onClick={addField}><Plus/>Add field</button></div></div>;
}

export function StructuredEditor({ value, onChange, rootLabel = 'Content fields' }: Props) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return <PrimitiveField fieldKey={rootLabel} value={value as string | number | boolean | null} onChange={onChange}/>;
  }
  return <div className="structured-editor"><div className="structured-editor-heading"><b>{rootLabel}</b><span>Technical JSON stays in the database; edit it here through normal fields.</span></div><ObjectEditor value={value as ObjectValue} onChange={onChange}/></div>;
}
