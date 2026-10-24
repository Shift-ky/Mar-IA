// Integração encerrada. Nenhuma mensagem é encaminhada nem processada.
export default {async fetch(){return new Response('WhatsApp desativado. Use o Telegram.',{status:410})},async scheduled(){}};
