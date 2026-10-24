import {parseCommand as parseLegacy} from '../whatsapp/commands';
export {help,summary,money} from '../whatsapp/commands';
export function parseCommand(text:string,date?:string){
 let normalized=text.trim().replace(/^\/(\w+)(?:@[a-zA-Z0-9_]+)?(?=\s|$)/,'$1');
 normalized=normalized.replace(/^start\s+([a-zA-Z0-9_-]{20,100})$/i,'vincular $1');
 const command=parseLegacy(normalized,date);
 if(command.data)command.data.source='telegram';
 return command;
}
