'use client';
import {useEffect,useState} from 'react';
import {watchAppUpdates} from '../lib/offline-shell';
export default function AppUpdates(){const [available,A]=useState(false);useEffect(()=>watchAppUpdates(()=>A(true)),[]);return <div className={'app-update-control '+(available?'available':'')}>{available&&<p role="status">Uma nova versão está pronta. Conclua o formulário aberto antes de atualizar.</p>}<a className="doclink" href="/atualizar">{available?'Abrir nova versão':'Atualizar aplicativo'}</a></div>}
