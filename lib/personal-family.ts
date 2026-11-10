export async function ensurePersonalFamily(db:any,user:{userId:string,email:string},name:string,legacyOwner=false){
 // Membership is authoritative: never create a second personal space for someone
 // who already belongs to a family.
 const membership=await db.prepare('SELECT family FROM members WHERE lower(email)=? LIMIT 1').bind(user.email.toLowerCase()).first();
 if(membership)return membership.family as string;
 const left=await db.prepare('SELECT value FROM settings WHERE key=?').bind('family-left:'+user.userId).first();
 if(left)return null;
 const key='home-family:'+user.userId;
 const known=await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
 if(known)return known.value as string;
 // Only the original global administrator could create families in the previous version.
 const legacy=legacyOwner?await db.prepare("SELECT f.id FROM families f JOIN members m ON m.family=f.id WHERE m.email=? AND m.role='admin' ORDER BY f.rowid LIMIT 1").bind(user.email.toLowerCase()).first():null;
 const candidate=legacy?.id||crypto.randomUUID(),memberId=crypto.randomUUID();
 await db.batch([
 db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').bind(key,candidate),
 db.prepare('INSERT OR IGNORE INTO families(id,name) SELECT value,? FROM settings WHERE key=?').bind('Família de '+name,key),
 db.prepare("INSERT INTO members(id,family,email,role,permissions) SELECT ?,s.value,?,'admin','{}' FROM settings s WHERE s.key=? AND NOT EXISTS (SELECT 1 FROM members m WHERE m.family=s.value AND m.email=?)").bind(memberId,user.email.toLowerCase(),key,user.email.toLowerCase())
 ]);
 return (await db.prepare('SELECT value FROM settings WHERE key=?').bind(key).first()).value as string;
}
export async function isPersonalAdministrator(db:any,family:string,email:string){return !!await db.prepare("SELECT p.id FROM profiles p JOIN settings s ON s.key='home-family:'||p.id AND s.value=? WHERE p.email=? LIMIT 1").bind(family,email.toLowerCase()).first();}
