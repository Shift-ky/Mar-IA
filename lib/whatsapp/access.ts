export async function actor(db:D1Database,user:string,email:string,family:string){
 const normalized=email.toLowerCase();
 // One database round trip; permissions are still revalidated for every operation and delivery.
 const access=await db.prepare(`SELECT f.id AS family_id,f.name AS family_name,p.id AS profile_id,o.value AS owner_id,m.id AS member_id,m.role,m.permissions
 FROM families f
 LEFT JOIN profiles p ON p.id=? AND p.email=? AND p.phone IS NOT NULL
 LEFT JOIN settings o ON o.key='owner'
 LEFT JOIN members m ON m.family=f.id AND m.email=?
 WHERE f.id=? LIMIT 1`).bind(user,normalized,normalized,family).first<any>();
 if(!access)throw Error('Família não encontrada.');
 if(!access.profile_id||!access.member_id)throw Error('Acesso à família não autorizado.');
 const admin=access.role==='admin';
 return {user,email:normalized,family,familyName:access.family_name,admin,permissions:admin?{view:true,add:true,edit:true,delete:true}:JSON.parse(access.permissions)};
}
export async function phoneActor(db:D1Database,phone:string,telegramState=false):Promise<any>{
 const access=await db.prepare(`SELECT l.user,l.email,l.family,f.id AS family_id,f.name AS family_name,p.id AS profile_id,o.value AS owner_id,m.id AS member_id,m.role,m.permissions
 ${telegramState?",(SELECT value FROM settings WHERE key='rev:'||l.family) AS revision,(SELECT value FROM settings WHERE key='tg-flow:'||l.phone) AS flow":''}
 FROM wa_links l
 LEFT JOIN families f ON f.id=l.family
 LEFT JOIN profiles p ON p.id=l.user AND p.email=lower(l.email) AND p.phone IS NOT NULL
 LEFT JOIN settings o ON o.key='owner'
 LEFT JOIN members m ON m.family=l.family AND m.email=lower(l.email)
 WHERE l.phone=? LIMIT 1`).bind(phone).first<any>();
 if(!access)throw Error('Vincule este número no aplicativo Mar IA antes de consultar ou registrar informações.');
 if(!access.family_id)throw Error('Família não encontrada.');
 if(access.profile_id&&!access.member_id&&telegramState){
 const home=await db.prepare('SELECT value FROM settings WHERE key=?').bind('home-family:'+access.user).first<any>();
 if(home?.value&&home.value!==access.family){await actor(db,access.user,access.email,home.value);const guard="EXISTS (SELECT 1 FROM wa_links WHERE phone=? AND user=? AND family=?) AND NOT EXISTS (SELECT 1 FROM members WHERE family=? AND email=?)";const args=[phone,access.user,access.family,access.family,access.email.toLowerCase()];const result=await db.batch([db.prepare('DELETE FROM settings WHERE key IN (?,?) AND '+guard).bind('tg-flow:'+phone,'tg-shopping-view:'+phone,...args),db.prepare('UPDATE wa_links SET family=? WHERE phone=? AND '+guard).bind(home.value,phone,...args)]);if(result[1]?.meta.changes)return phoneActor(db,phone,true);}
 }
 if(!access.profile_id||!access.member_id)throw Error('Acesso à família não autorizado.');
 const admin=access.role==='admin';
 return {user:access.user,email:access.email.toLowerCase(),family:access.family,familyName:access.family_name,admin,permissions:admin?{view:true,add:true,edit:true,delete:true}:JSON.parse(access.permissions),revision:access.revision,savedFlow:access.flow?{value:access.flow}:null};
}
