# Telegram da Mar IA

A integração ativa passa a ser Telegram. As rotas `/api/whatsapp` e seus webhooks retornam HTTP 410; o relay antigo deve receber a versão desativada deste repositório. Comprovantes e registros anteriores são preservados. As tabelas `wa_*` são mantidas por compatibilidade, mas o Telegram usa identidades `tg:<id>` e processa apenas a própria fila. Telefones antigos não são enviados ao Telegram.

## Criar o bot

1. Abra o perfil oficial [@BotFather](https://t.me/BotFather) no Telegram.
2. Use `/newbot`, informe o nome Mar IA e escolha um usuário disponível terminado em `bot`.
3. Guarde o token no gerenciador de segredos do servidor como `TELEGRAM_BOT_TOKEN`. Não coloque o token no código, em arquivos publicados nem no chat.
4. Configure `TELEGRAM_BOT_USERNAME` sem `@` e dois segredos aleatórios independentes: `TELEGRAM_WEBHOOK_SECRET` e `TELEGRAM_JOB_SECRET`. O primeiro aceita letras, números, `_` e `-` e até 256 caracteres.

## Hospedagem

O GitHub Pages publica apenas a interface. **Não executa o bot, login, banco de dados ou sincronização.** Publique o Worker da aplicação com DB (D1), BUCKET (R2 privado) e autenticação já configurados antes de ativar o Telegram. Não configure um webhook apontando para `github.io`.

No servidor, registre o webhook pela Bot API com `setWebhook`, usando `url: https://SEU-SERVIDOR/api/telegram/webhook`, `secret_token` igual ao segredo do servidor e `allowed_updates: ["message"]`. Não use `drop_pending_updates` para evitar perder mensagens. Verifique `getWebhookInfo` e teste uma conversa privada antes de considerar a ativação concluída. O token não deve aparecer em logs, histórico do terminal ou capturas de tela.

Configure uma tarefa no servidor a cada minuto para POST `/api/telegram/jobs`, com JSON `{ "at": <timestamp em milissegundos> }` assinado por HMAC SHA-256 usando `TELEGRAM_JOB_SECRET`, no cabeçalho `X-Mar-Job-Signature: sha256=<hex>`. Isso permite retomar filas após falhas transitórias. O webhook também dispara o processamento imediatamente.

## Vincular e testar

1. Entre na aplicação hospedada no servidor, complete o cadastro e selecione a família.
2. Na aba Telegram, gere um código com validade de dez minutos. Envie `vincular CODIGO` ao bot, em conversa privada. `/start CODIGO` também funciona.
3. Teste `despesa 32,50 supermercado`, `receita 1500 salario`, `/saldo`, `/movimentacoes` e `/relatorio 2026-10`. Confirme que aparecem na família correta.
4. Envie JPEG, PNG ou PDF de até 10 MB. PDFs com texto (até dez páginas) têm leitura local do valor, sem enviar o documento a outro serviço. O valor aparece como sugestão: confira descrição, data e tipo antes de confirmar. Na aba Telegram, use “Ler PDF novamente” para documentos anteriores. Fotos e PDFs digitalizados precisam de um extrator/OCR configurado ou preenchimento manual. Valores ambíguos não são escolhidos automaticamente. A validação fiscal continua exigindo o provedor fiscal configurado.
5. Desvincule a conta e confirme que novas consultas financeiras são recusadas. Conversas de grupos, canais e bots são ignoradas.

As respostas não usam templates da Meta. O bot só envia respostas aos comandos recebidos e exige vínculo e permissões atuais. Entregas com confirmação incerta ficam para revisão, sem reenvio automático que possa duplicá-las.

## Encerrar WhatsApp

Publique o Worker e o relay desativado antes de remover os segredos `WA_*` do servidor. Remova a assinatura/webhook da aplicação no painel da Meta e desligue o agendamento antigo. Essa ação externa só está concluída após a alteração na conta Meta; editar o repositório não remove uma assinatura já cadastrada. Não apague documentos ou históricos para fazer a troca.

Referência: [Telegram Bot API](https://core.telegram.org/bots/api).
