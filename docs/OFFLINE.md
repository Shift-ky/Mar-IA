# Funcionamento offline

Use o servidor da aplicação: https://financas-familia-robson.merryscout8.chatgpt.site/ . A página GitHub Pages é apenas uma entrada para esse servidor; salvar ou abrir só o index.html não instala o aplicativo offline.

Em cada computador/celular, entre uma vez com internet, selecione a família e aguarde “Aplicativo disponível offline neste navegador” no painel “Offline e sincronização”. Se a preparação falhar, o painel informa o erro e permite tentar novamente. Abra esse mesmo endereço ou instale pelo navegador.

A tela de entrada oferece “Abrir os dados salvos neste aparelho”. Sem uma cópia local anterior, o aplicativo informa que o primeiro acesso requer internet. Confirmação de conta, recuperação de senha e envio de arquivos externos exigem conexão.

A versão offline inclui a navegação e os formulários de finanças e lista de compras. Operações são gravadas em IndexedDB e sincronizadas ao reconectar com o aplicativo aberto. Mantenha o mesmo navegador/perfil e não limpe seus dados com pendências. Sair da conta limpa a cópia local após resolver as pendências.

Correções: navegações por /entrar, /nova-senha e atalhos /offline também recebem a aplicação offline; preparação iniciada na tela de acesso; confirmação de disponibilidade verifica todos os arquivos em cache; falhas deixam de ser ocultadas no painel. O indicador offline não confirma que os dados de uma família já foram baixados: confira também a última sincronização.

## Revisão Offline First de 26/10/2026

A arquitetura foi preservada: D1 no servidor, autenticação no servidor, IndexedDB `mar-ia` versão 1 no aparelho, snapshots por conta/família, fila transacional, revisões e IDs de operação no servidor. Nenhuma migração ou limpeza de dados foi executada.

### Limitação da hospedagem encontrada

A navegação pública de `/offline/index.html` é canonicalizada para `/offline/`. A instalação anterior rejeitava qualquer resposta redirecionada. A versão anterior também procurava a rede antes do cache na navegação, permitindo que uma página de erro da hospedagem substituísse a aplicação. O cache agora usa a URL canônica, aceita somente a canonicalização interna esperada e valida o marcador da aplicação; páginas de login/erro não são armazenadas como aplicativo.

### Implementação

- `offline-src/service-worker.js` é a fonte do worker. `scripts/build-offline.mjs` gera `public/sw.js` com a lista/versionamento embutidos: reiniciar o worker não exige baixar um arquivo auxiliar.
- Navegação do aplicativo é cache first. APIs e callbacks de autenticação continuam fora do cache. A página de nova senha mantém seu formulário próprio.
- O novo worker só é instalado após baixar os recursos; uma versão anterior é mantida para atualizações interrompidas e abas abertas. Nenhuma atualização apaga IndexedDB.
- A preparação verifica arquivos ausentes e exibe erro real. Com aparelho offline, verifica o worker já instalado antes de tentar registrá-lo pela rede.
- Gravações IndexedDB só são confirmadas após concluir a transação, solicitando durabilidade estrita quando disponível. Conexões podem ser reabertas após interrupção/alteração de versão, sem recriar o banco.
- Alterações continuam locais primeiro. Os IDs de operação e revisões do servidor evitam duplicações e sinalizam conflitos. Não há sobrescrita silenciosa de conflitos.
- Falhas temporárias HTTP 408/425/429/5xx preservam a fila para nova tentativa. Uma sessão expirada não marca a operação como inválida permanentemente.
- A sincronização automática ocorre ao voltar a conexão, ao voltar ao aplicativo e periodicamente enquanto estiver aberto. A plataforma não garante execução com o aplicativo encerrado; ao reabrir, a fila é retomada.

### Validação executada

| Cenário | Evidência |
| --- | --- |
| URL canônica/redirecionamento da hospedagem | Observação na página publicada e teste de regressão no worker |
| Abertura e arquivos sem rede; novo contexto do worker | `node tests/service-worker.mjs`, rede indisponível simulada |
| Hospedagem devolve página de erro; instalação incompleta | Teste de cache first e preservação da versão instalada |
| CRUD, reconexão, conflitos, isolamento de conta/família | `node tests/offline-sync.mjs`, API real compilada com SQLite e transporte simulado |
| Gravação e reabertura no IndexedDB nativo | Chrome remoto: fechar aba e abrir outra, banco isolado; transporte simulado |
| Resposta perdida depois da gravação no servidor | Testes de reenvio idempotente, sem duplicação |
| Falha temporária da hospedagem e sessão expirada | Fila preservada, recuperação em sincronização seguinte |

O teste do navegador usa `tests/browser-offline-harness.ts`, compilado com `node tests/build-browser-offline-harness.mjs` em arquivos temporários locais. Ele utiliza IndexedDB nativo em banco de QA isolado; simula a indisponibilidade do transporte e um servidor para provocar os conflitos de forma reproduzível. Os arquivos públicos de QA são removidos antes da publicação. Não houve acesso físico ao Android do usuário nem simulação de modo avião no dispositivo; esse teste específico permanece para validação no aparelho. Não foi necessário desinstalar a PWA ou limpar seus dados.

No Android: com internet, abra o endereço da aplicação no mesmo Chrome/perfil usado na instalação, atualize e espere a confirmação de arquivos offline e uma sincronização dos dados da família. Feche e abra a PWA sem rede. Cadastre/edite/exclua um registro de teste, feche e reabra novamente, reconecte e confira a fila zerada e o mesmo registro no outro aparelho. Não é necessário reinstalar nem apagar armazenamento.

Referência: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
