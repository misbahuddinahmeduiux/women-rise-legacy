import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useWebsiteContent<T extends Record<string, any>>(contentKey:string,fallback:T):T{
  const [content,setContent]=useState<T>(fallback);
  useEffect(()=>{
    let active=true;
    api<{value:Partial<T>}>(`/phase4/content/${encodeURIComponent(contentKey)}`)
      .then(row=>{if(active)setContent({...fallback,...row.value})})
      .catch(()=>undefined);
    return()=>{active=false};
  },[contentKey]);
  return content;
}
