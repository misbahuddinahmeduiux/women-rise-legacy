import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function ApiStatus(){const [offline,setOffline]=useState(false);useEffect(()=>{let live=true;api('/health').then(()=>live&&setOffline(false)).catch(()=>live&&setOffline(true));const onOnline=()=>setOffline(false);const onOffline=()=>setOffline(true);window.addEventListener('online',onOnline);window.addEventListener('offline',onOffline);return()=>{live=false;window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline)}},[]);return offline?<div className="api-status" role="status">The secure service is temporarily unavailable. Public pages remain available.</div>:null}
