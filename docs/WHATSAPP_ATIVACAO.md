# Mar IA — ativação do WhatsApp

## Estado desta entrega

O aplicativo financeiro recebeu estoque, falteiro, histórico de preços, revisão de documentos, vínculo individual do WhatsApp e processamento idempotente. O backend foi testado com Meta, armazenamento de objetos e extrator simulados; nenhum token real foi usado nem mensagem real enviada. A ativação do número, as restrições do portfólio e o acesso de produção ainda precisam ser verificados na conta Meta. O receptor externo abaixo tem código pronto para implantação, mas não foi publicado nem ligado à conta real.

O site institucional e o repositório público `Shift-ky/Mar-IA` não foram modificados. O código do backend foi mantido separado do repositório institucional. Não há dados financeiros, credenciais nem arquivos `.git` no ZIP de distribuição.

## Componentes

1. **App privado:** contém D1 (`DB`), comprovantes no R2 (`BUCKET`), autenticação, famílias, permissões e arquivos do modo offline.
2. **Receptor exclusivo:** `whatsapp-relay/worker.js`, um Worker HTTPS separado. Expõe somente `/webhook`. Não hospeda interface, banco ou consultas financeiras públicas.
3. **Ligação entre serviços:** o receptor envia o corpo original e a assinatura da Meta ao app em `/api/whatsapp/webhook`. Usa a credencial de serviço do próprio Site no cabeçalho `OAI-Sites-Authorization`, mantida somente como segredo do receptor. Essa credencial é obtida pelo proprietário nos recursos de acesso de serviço do Site; não é o token da Meta nem um código de usuário. Nunca retire a proteção do site financeiro para fazer o webhook funcionar.
4. **Recuperação de filas:** o cron do receptor chama `/api/whatsapp/jobs` a cada minuto, autenticado com credencial de serviço e uma assinatura adicional. O recebimento só é confirmado à Meta após persistência na caixa de entrada do app. Reenvios por ID não geram nova despesa.

## 1. Conferir o número na Meta

No portfólio Mar IA e no aplicativo Carteira Financeira, confira se o número pertence à conta WhatsApp Business correta, se completou o registro da Cloud API e se não há pendências ou restrições exibidas pelo WhatsApp Manager/Account Quality. A verificação por SMS/ligação, isoladamente, não comprova que o registro da API está pronto. Confira também as instruções da Meta para nome de exibição, verificação em duas etapas, cobrança e limites aplicáveis à sua conta.

Não existe um procedimento universal que resolva todo status “Pendente”. Consulte a mensagem específica do painel e a documentação de registro. Operações de registro ou alteração do PIN não foram executadas nesta entrega.

## 2. Configurar os segredos do app privado

Configure como segredos de runtime, fora dos arquivos e fora do Git:

| Nome | Conteúdo |
| --- | --- |
| `WA_APP_SECRET` | App Secret do aplicativo Carteira Financeira |
| `WA_VERIFY_TOKEN` | Segredo aleatório escolhido por você para o desafio de verificação do webhook |
| `WA_ACCESS_TOKEN` | Token de usuário de sistema autorizado para a conta/número do negócio |
| `WA_PHONE_NUMBER_ID` | ID do número da Cloud API, não o telefone nem o WABA ID |
| `WA_GRAPH_VERSION` | Versão vigente e suportada da Graph API, no formato `vNN.N` |
| `WA_JOB_SECRET` | Segredo aleatório longo, diferente do Verify Token, para as tarefas de recuperação |

O token deve ter as permissões e acesso aos ativos necessários. A documentação oficial distingue `whatsapp_business_messaging` e `whatsapp_business_management`. Confira a necessidade de modo de produção, revisão e acesso avançado no seu cenário; requisitos para um desenvolvedor usando o próprio negócio e para um provedor atendendo outros negócios podem diferir.

A publicação do app provisiona as tabelas novas e o bucket privado. Valores reais não são incluídos em `.env.example`. Após alterar segredos no Sites, publique uma versão para aplicá-los.

## 3. Implantar o receptor HTTPS separado

O projeto inclui o código e a configuração do receptor; ele precisa ser implantado em sua conta Cloudflare Workers. Use um nome exclusivo e um ambiente separado do site institucional. Os comandos abaixo são para o proprietário executar localmente, autenticado na conta correta:

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put WA_APP_SECRET --config whatsapp-relay/wrangler.jsonc
pnpm exec wrangler secret put WA_VERIFY_TOKEN --config whatsapp-relay/wrangler.jsonc
pnpm exec wrangler secret put WA_JOB_SECRET --config whatsapp-relay/wrangler.jsonc
pnpm exec wrangler secret put MAR_PRIVATE_ORIGIN --config whatsapp-relay/wrangler.jsonc
pnpm exec wrangler secret put MAR_SERVICE_TOKEN --config whatsapp-relay/wrangler.jsonc
pnpm exec wrangler deploy --config whatsapp-relay/wrangler.jsonc
```

Os comandos `secret put` recebem os valores de forma interativa, sem colocá-los no comando, no README ou no histórico Git. `MAR_PRIVATE_ORIGIN` é a origem HTTPS atual do app privado, sem caminho. `MAR_SERVICE_TOKEN` é a credencial de serviço desse Site. Os três segredos `WA_*` do receptor precisam corresponder aos usados no app privado. O Access Token da Meta permanece apenas no app privado.

Depois de obter a URL real do Worker, use **a URL publicada seguida de `/webhook`** como Callback URL no painel da Meta. Use o mesmo Verify Token configurado. Assine os eventos `messages` e confira que o aplicativo está inscrito no WABA correto. O código não automatiza alterações no portfólio nem inscrição de ativos.

Faça um teste real de recebimento antes de considerar a integração ativa. O desafio GET confirma a configuração do receptor; também é necessário testar o encaminhamento para o aplicativo privado, o processamento e a resposta da Meta. Falhas no encaminhamento retornam 503 para permitir que a Meta tente de novo.

## 4. Vincular membros

Cada pessoa conclui seu cadastro individual e precisa ter acesso aprovado à família. Na aba WhatsApp, seleciona a família, gera um código de uso único e envia `vincular CODIGO` pelo próprio WhatsApp ao número empresarial. O código dura 10 minutos, fica armazenado apenas como hash e não substitui a permissão do membro. Um número fica associado a uma conta/família ativa; novo vínculo troca a família ativa desse número.

O servidor verifica novamente perfil, associação e permissões em cada operação. Consultas exigem permissão de visualização; receitas, despesas e confirmação de cupons exigem adição. O destinatário é revalidado antes do envio de informações financeiras.

## 5. Comandos e confirmação

```text
despesa 32,50 supermercado
receita 1500 salario
saldo
movimentações
relatório 2026-10
confirmar IDENTIFICADOR
cancelar IDENTIFICADOR
```

Valores devem ser escritos sem separador de milhar. Sem data explícita na interface, os comandos financeiros usam o dia corrente no fuso America/Fortaleza. O saldo soma os lançamentos registrados; não consulta saldos bancários. A leitura de linguagem natural livre ou áudio não foi incluída: mensagens ambíguas recebem instruções em vez de lançamentos estimados.

O ID original da mensagem impede repetição por reentrega. Uma nova mensagem com descrição, valor, tipo e data iguais a um registro existente pede confirmação antes de lançar outra movimentação. Um cupom com a mesma chave fiscal ou o mesmo arquivo na mesma família não é lançado novamente. Quando os dados extraídos cabem na mensagem, a revisão também oferece `confirmar ID`/`cancelar ID` pelo WhatsApp; caso contrário, a revisão é feita no aplicativo.

Relatórios nesta entrega são solicitados pelo usuário. Envios fora da janela de atendimento ficam em `needs_template`, sem envio indevido. Não foi criada uma rotina de relatório proativo com template: ela requer template aprovado, consentimento e definição de frequência. Se a entrega de uma resposta for incerta, ela fica em `needs_review` e não é repetida automaticamente, evitando mensagens duplicadas. Os lançamentos financeiros já confirmados não são repetidos. O cron tenta processamentos pendentes, não reenvios de resposta com resultado incerto.

## 6. Fotos, PDFs e leitura fiscal

JPEG, PNG e PDF são baixados da Meta com autenticação, limite de 10 MB, validação de host e hash quando informado. O original fica no R2 privado, e sua consulta exige login e acesso à família. Os originais precisam de conexão para baixar nesta versão; os dados extraídos, a revisão e as alterações pendentes permanecem na cópia local do aplicativo.

Sem um serviço de extração configurado, o documento é recebido e conservado, mas seus campos são preenchidos na revisão. **Não há OCR fiscal ativo ou fornecedor contratado nesta entrega.** Existe um adaptador para um provedor confiável que faça extração e validação fiscal, configurado com `RECEIPT_EXTRACTOR_URL` e `RECEIPT_EXTRACTOR_TOKEN` como segredos. O endpoint deve ser HTTPS e recebe somente o arquivo do comprovante, seu tipo MIME e `X-Document-SHA256`; o token é enviado como Bearer. Nunca configure URLs fornecidas por mensagens do WhatsApp.

Contrato esperado do extrator:

```json
{
  "confidence": 0.99,
  "verification": {
    "status": "verified",
    "documentSha256": "HASH_SHA256_HEXADECIMAL_DO_ARQUIVO"
  },
  "receipt": {
    "store": "Mercado",
    "date": "2026-10-24",
    "total": 20,
    "discount": 0,
    "extra": 0,
    "fiscalKey": "CHAVE_FISCAL_COM_44_DIGITOS",
    "items": [
      { "name": "Arroz", "quantity": 4, "unit": "un", "unitPrice": 5, "lineTotal": 20 }
    ]
  }
}
```

`verification.status=verified` deve significar validação fiscal real feita pelo fornecedor, não uma inferência de OCR. O arquivo precisa ser identificado pelo hash, a chave deve passar na validação de dígito e os preços/quantidades/descontos/acréscimos devem conferir com o total em centavos. Só a soma correta ou a confiança do OCR não autorizam lançamento automático. O serviço ainda deve ser integrado e validado com documentos reais antes de ativar essa opção.

Em dúvidas, erros ou ausência de validação, o documento fica para revisão. Comprovantes bancários sem produtos usam o modo “Comprovante financeiro sem produtos” e não alteram estoque. Documentos são dados, nunca instruções executáveis.

## 7. Estoque e regras preservadas

- Estoque = inicial + soma das entradas − consumos; não é substituído pelo valor de uma compra.
- Mínimo configurado permanece fixo após compras. Só uma edição explícita o altera.
- Falteiro = máximo entre 0 e mínimo menos estoque atual.
- Cada compra gera uma transação financeira pelo total; itens e entradas de estoque ficam em registros distintos, sem somar despesas adicionais.
- Produtos são associados pelo nome normalizado e pela unidade. Na revisão, ajuste o nome quando o cupom usar outra descrição para um produto existente; descrições ou unidades diferentes criam produtos separados, com mínimo inicial zero.
- Histórico registra quantidade, unidade, preço unitário, total do item, loja e data. Descontos globais permanecem no documento, sem rateio implícito do preço unitário.
- O histórico de compras/estoque é preservado. A API bloqueia edição ou exclusão isolada de uma transação derivada de cupom. Consumos e ajustes são movimentações explícitas; não foi adicionada uma rotina de estorno completo de compra nesta entrega.

A confirmação grava transação, itens, produtos novos, estoque e estado do documento no mesmo batch D1 protegido pela revisão da família. Conflitos offline seguem o fluxo de revisão já existente. O servidor recebe e processa os eventos independentemente de os aparelhos estarem conectados.

## 8. Testes executados

```sh
node tests/offline-sync.mjs
node tests/service-worker.mjs
pnpm exec tsc --noEmit
```

Os testes usam SQLite e armazenamento simulados, eventos assinados sintéticos e respostas simuladas da Meta/extrator. Cobrem assinatura inválida, código descartável, replay, confirmação, arquivo repetido, chave fiscal repetida, cupom validado, revisão de documento sem validação, comprovante sem produtos, permissões, estoque 1+4=5, mínimo 2, falteiro, consumo offline, cron autenticado e encaminhamento privado. A interface de revisão também foi conferida em uma página temporária com dados fictícios, removida antes da publicação.

## Documentação oficial consultada

- Registro do número: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/registration
- Permissões: https://developers.facebook.com/documentation/business-messaging/whatsapp/permissions/
- Tokens: https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/
- Assinaturas de webhook: https://developers.facebook.com/docs/graph-api/webhooks/getting-started/
- Webhooks: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
- Inscrição do aplicativo: https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api
- Mensagens de serviço e janela de atendimento: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages

Consulte esses documentos durante a ativação, pois permissões, políticas e versões podem mudar. O status da sua conta não foi inferido a partir de documentação pública.
