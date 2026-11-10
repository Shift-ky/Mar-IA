# Estoque e Feira

Produtos e divisões aproveitam os registros existentes `product`, `productGroup` e `stockMovement`. Não é necessária uma nova base Supabase. O servidor usa D1 e mantém os dados separados por família.

O estoque atual é a quantidade inicial somada às movimentações. A reposição é `max(0, mínimo - atual)`. `mergeFeira` calcula as reposições de forma determinística a cada leitura e alteração local, sem depender de uma trigger que não funcionaria offline. O identificador `replenish-<productId>` mantém as seleções sincronizadas com o Telegram. Itens avulsos continuam como `shoppingItem` independentes.

`feiraSave` registra o histórico (`feiraPurchase`) e, se houver pagamento, a despesa paga, os itens/preços e as entradas de estoque em um único batch condicionado à revisão da família. Dinheiro, Alimentação e Refeição usam respectivamente as carteiras Dinheiro, Vale-alimentação e Vale-refeição. Não lançar arquiva somente uma cotação, preservando lista, estoque e finanças, sem atualizar o último preço pago.

Compras parciais deixam o déficit residual. Produtos novos recebem padrão igual à quantidade comprada; produtos existentes preservam o padrão. O último preço pago vem de `purchaseItem`, por data e instante da atualização, desconsiderando cotações.

Edição substitui apenas os efeitos vinculados à compra, preservando outras compras e consumos. Exclusão por administrador desfaz os efeitos financeiros e de estoque. Reversões que agravariam saldo negativo são recusadas antes de gravar. Os lançamentos vinculados não podem ser alterados ou apagados diretamente em Finanças; a correção deve ocorrer no Histórico da Feira.

`feiraOperation` junto ao identificador da operação de sincronização torna a projeção idempotente após perda de resposta. Conflitos com outro dispositivo exigem revisão, mantendo as alterações locais. A permissão `stock: false` remove produtos, divisões, movimentações, histórico detalhado e reposições das respostas da API e bloqueia alterações; as permissões gerais de adicionar/editar/excluir continuam aplicáveis. Administradores da família possuem acesso. Integrantes anteriores sem flag explícita mantêm acesso.

A ordenação pode ser feita pelo puxador de arrastar no desktop e pelas setas no celular/teclado; a troca de divisão usa seletor. A organização é sincronizada.

Cupons do Telegram continuam com leitura apenas do total financeiro. Não há extração automática de produtos nesta entrega.

Validação: `node tests/feira-offline.mjs`, `node tests/feira-telegram.mjs`, regressão de sincronização offline, TypeScript, build offline e service worker. A prévia foi verificada com dados sintéticos em desktop e largura de celular; nenhuma compra real foi criada na validação.
