# WhatsApp da Mar IA pela Evolution

Esta integração é adicional. Nenhum serviço, token, webhook, fila ou tela existente do Telegram precisa ser substituído. As novas tabelas usam o prefixo `ev_` e as rotas usam `/api/evolution`.

## Arquitetura

WhatsApp ↔ Evolution local ↔ ponte local ↔ servidor da Mar IA ↔ banco D1 / arquivos R2.

A ponte recebe os eventos dentro da rede privada do Docker e os encaminha por HTTPS com HMAC SHA-256 e timestamp. A resposta é retirada pela ponte em consultas a cada cinco segundos. Não há túnel público nem encaminhamento de portas no roteador. Os painéis só são publicados em `127.0.0.1`.

O servidor continua exigindo identidade autenticada e vínculo com a família nas operações da interface. A ponte usa uma chave própria, independente dos segredos do Telegram. As rotas antigas `/api/whatsapp` continuam desativadas.

## Iniciar no Windows

1. Instale o Docker Desktop pelo [site oficial](https://docs.docker.com/desktop/setup/install/windows-install/) e habilite contêineres Linux. Abra-o e aguarde o motor iniciar.
2. A configuração inicial preparada nesta entrega fica em `%LOCALAPPDATA%/MarIA/WhatsApp/config.env`, fora do projeto e da pasta do OneDrive. Não compartilhe esse arquivo. Para outra máquina, configure a mesma `EVOLUTION_BRIDGE_SECRET` usada no servidor e execute `configurar.ps1`; as demais chaves são geradas localmente.
3. Na pasta `whatsapp-local`, execute `powershell -ExecutionPolicy Bypass -File iniciar.ps1`.
4. Aguarde o primeiro download dos serviços. Abra `http://localhost:8790` e clique em **Mostrar QR Code**. Use o WhatsApp do número dedicado à Mar IA → Aparelhos conectados → Conectar aparelho.
5. Na aplicação Mar IA, abra **WhatsApp**, gere um código pessoal e envie a mensagem em conversa privada para o número da Mar IA. O código expira em dez minutos e só pode ser usado uma vez.
6. Para um grupo, o administrador primeiro vincula sua conta pessoal, depois adiciona o número da Mar IA ao grupo e envia o código de grupo. Cada participante precisa vincular uma conta autorizada na mesma família. Respostas no grupo são visíveis a todos os seus participantes; use um grupo privado da família.

O Docker precisa permanecer aberto e o computador ligado, sem suspensão. Use `parar.ps1` para parar preservando os dados. `docker compose --env-file "$env:LOCALAPPDATA/MarIA/WhatsApp/config.env" ps` mostra o estado dos serviços. `docker compose --env-file "$env:LOCALAPPDATA/MarIA/WhatsApp/config.env" logs --tail 50 bridge` mostra mensagens genéricas de diagnóstico sem exibir chaves ou conteúdo financeiro. Não use `docker compose down -v`, pois isso remove os dados persistentes.

## Funções

- `despesa 32,50 supermercado` e `receita 1500 salário` registram valores no dia atual de Fortaleza.
- `saldo` mostra receitas menos despesas registradas; não representa saldo bancário real.
- `movimentações` lista os últimos dez lançamentos.
- `relatório 2026-10` resume o mês solicitado.
- Nos grupos, comece com `Maria,`, por exemplo `Maria, saldo`.
- JPEG, PNG e PDF de até 10 MB são salvos separadamente para revisão na aba WhatsApp. Nos grupos, use `Maria, comprovante` na legenda. PDF com texto pode sugerir dados, limitado a dez páginas. O usuário informa/confere valor, data, tipo e forma de pagamento antes de registrar. Não há OCR de imagem nem interpretação de áudio incluídos.

## Operação e segurança

O servidor revalida vínculo e permissões antes de registrar e antes de liberar respostas financeiras. Grupo e família precisam corresponder à conta do remetente. Identidades LID só são aceitas quando o evento também informa o identificador de telefone alternativo; sem ele, não se presume a identidade.

Eventos repetidos usam o mesmo identificador. Cada lançamento, mudança de revisão e confirmação é salvo em um batch D1. Mudanças simultâneas aguardam o próximo ciclo. Uma entrega cuja confirmação foi perdida não é reenviada automaticamente: fica para conferência. A fila local preserva eventos recebidos durante indisponibilidade do servidor; eventos com timestamp de mais de 24 horas são ignorados para evitar importar histórico antigo como novos pedidos.

A ponte precisa se reconectar manualmente por QR quando a sessão é revogada. A conexão é não oficial e pode sofrer desconexões ou bloqueios. Não há garantia de disponibilidade ou de ausência de bloqueio.

Faça backup seguro dos volumes `instances`, `postgres`, `redis` e `bridge`, além da configuração local. Esses backups contêm sessões e dados privados; mantenha-os criptografados. O prefixo R2 `evolution/` pertence apenas ao WhatsApp. A exclusão de família remove vínculos e filas `ev_` por trigger e marca os arquivos para limpeza no próximo ciclo da ponte.

## Publicação

Migração: `drizzle/0007_evolution.sql`. Segredos do servidor: `EVOLUTION_BRIDGE_SECRET` (64 caracteres hexadecimais aleatórios) e `EVOLUTION_INSTANCE` (`mar-ia`). A chave global da Evolution fica apenas no computador, sem ser enviada ao navegador ou à Mar IA. Nenhum segredo `TELEGRAM_*` deve ser alterado.

Se o site futuramente mudar para acesso privado, configure uma credencial de serviço suportada pela hospedagem em `MAR_SITE_SERVICE_TOKEN` na ponte; não torne o site público para contornar autenticação.

## Verificação

`node tests/evolution.mjs` verifica assinatura, vínculo único, família, grupos, duplicidade, revogação, retirada de respostas, confirmação de envio e exclusão de família. `node tests/evolution-api.mjs` verifica autenticação da interface e revisão de documentos. A conexão real exige Docker funcionando e leitura do QR Code pelo proprietário.
