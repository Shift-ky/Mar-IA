 'use client';
import {useId,useState,type ReactNode} from 'react';
import {ChevronDown,ChevronUp} from 'lucide-react';
export default function CollapsiblePanel({title,description,badge,children}:{title:string;description?:string;badge?:ReactNode;children:ReactNode}){
 const [expanded,E]=useState(false),id=useId();
 return <section className="panel" style={{marginTop:24}} aria-label={title}><div className="sectiontitle"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div><div className="actions">{badge}<button type="button" aria-expanded={expanded} aria-controls={id} aria-label={(expanded?'Minimizar ':'Expandir ')+title} onClick={()=>E(!expanded)}>{expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/>} {expanded?'Minimizar':'Expandir'}</button></div></div><div id={id} hidden={!expanded}>{children}</div></section>;
}
