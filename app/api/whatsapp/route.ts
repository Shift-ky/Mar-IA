const disabled=()=>Response.json({error:'Integração com WhatsApp desativada. Use o Telegram.'},{status:410});
export const GET=disabled;
export const POST=disabled;
