'use client';
import {Users,Plus,Trash2} from 'lucide-react';
import {APP_ACCESS_SECTIONS} from '../lib/section-access';

function permissionsFor(member:any){try{return JSON.parse(member.permissions||'{}')}catch{return {}}}
function memberSummary(member:any){
 if(member.role==='admin')return 'Administrador';
 const p=permissionsFor(member),rights=Object.entries(p).filter(([key,value])=>key!=='sections'&&value).map(([key])=>({view:'Visualizar',add:'Adicionar',edit:'Editar',delete:'Excluir',stock:'Estoque e Feira'} as any)[key]).filter(Boolean),areas=APP_ACCESS_SECTIONS.filter(({key})=>p.sections?.[key]!==false).length;
 return [...rights,areas+' área(s) liberada(s)'].join(' · ')||'Membro';
}

export default function FamilyPanel({snapshot:s,act,open}:{snapshot:any,act:(b:any)=>Promise<any>,open:(type:string,record?:any)=>void}){
 const family=s.families.find((f:any)=>f.id===s.family);
 return <section className="panel family-panel">
  <div className="sectiontitle"><div><h2><Users size={20}/> {family?.name||'Família'}</h2><p>Cada pessoa pode participar de apenas uma família.</p></div></div>
  <p>Cada pessoa pode estar em apenas uma família. Para entrar em outra, saia da atual primeiro.</p>
  <button onClick={()=>{void act({action:'familyLeave',family:s.family,confirmFamily:s.family})}}>Sair da família</button>
  <label>Código da família<input readOnly value={s.family}/><small>Compartilhe este código para a pessoa solicitar entrada na família.</small></label>
  <div className="sectiontitle" style={{marginTop:28}}><h3>Integrantes</h3>{s.admin&&<button onClick={()=>open('member')}><Plus size={16}/> Adicionar pessoa</button>}</div>
  {(s.members||[]).map((m:any)=>{const p=permissionsFor(m);return <div className="member" key={m.id}><span className="avatar">{(m.name||m.email||'?')[0].toUpperCase()}</span><div><strong>{m.name||m.email||'Cadastro pendente'}</strong><small>{memberSummary(m)}</small></div>{s.admin&&!(s.homeFamily===s.family&&m.email===s.email)&&<div className="actions"><button onClick={()=>open('member',{...m,...p,sections:p.sections||{}})}>Permissões</button><button aria-label={'Remover '+(m.name||m.email)} onClick={()=>{void act({action:'removeMember',id:m.id})}}><Trash2 size={16}/></button></div>}</div>})}
  {s.admin&&(s.requests||[]).length>0&&<><h3>Solicitações de entrada</h3>{s.requests.map((r:any)=><div className="member" key={r.id}><strong>{r.name}</strong><button onClick={()=>open('member',{email:r.email,requestId:r.id,role:'member',view:true,add:true,stock:true,sections:{}})}>Aprovar e definir permissões</button><button onClick={()=>act({action:'rejectRequest',requestId:r.id})}>Recusar</button></div>)}</>}
 </section>;
}
