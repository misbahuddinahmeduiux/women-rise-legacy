import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export interface ContentOption { id: string; label: string; value: string; display_order: number }

export function useContentOptions(group: string, fallback: Array<[string, string]> = []) {
  const [options, setOptions] = useState<ContentOption[]>(fallback.map(([value, label], index) => ({ id: `fallback-${group}-${index}`, value, label, display_order: index })));
  useEffect(() => {
    let active = true;
    api<ContentOption[]>(`/phase4/options/${encodeURIComponent(group)}`)
      .then((rows) => { if (active && rows.length) setOptions(rows); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [group]);
  return options;
}

export function DynamicOptions({ group, fallback = [] }: { group: string; fallback?: Array<[string, string]> }) {
  const options = useContentOptions(group, fallback);
  return <>{options.map((option) => <option value={option.value} key={option.id}>{option.label}</option>)}</>;
}
