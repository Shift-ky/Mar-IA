export function recordAuthorName(record:any,snapshot:any):string{
 const email=String(record.author||'').trim().toLowerCase();
 if(email&&email===String(snapshot.email||'').trim().toLowerCase()&&snapshot.profile?.name?.trim())return snapshot.profile.name.trim();
 const name=record.authorName?.trim()||snapshot.members?.find((m:any)=>String(m.email||'').trim().toLowerCase()===email)?.name?.trim();
 return name||'Nome indisponível';
}
