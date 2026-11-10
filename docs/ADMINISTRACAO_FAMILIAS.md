# Administração e limpeza de famílias

O administrador geral pode listar nomes e identificadores de famílias, criar
famílias e excluí-las. O cargo não concede acesso a lançamentos, documentos,
solicitações, membros ou comandos do bot de outras famílias. Esses acessos
exigem participação e seguem as permissões do membro, inclusive para o próprio
administrador geral.

A exclusão fica em Administração geral e exige conexão, sincronização concluída
e confirmação. O servidor valida o cargo, a família confirmada e a revisão global.
A mesma operação pode ser reenviada sem duplicar seus efeitos. A transação remove
registros, membros, solicitações, vínculos, códigos e estados do bot. Documentos
ficam inacessíveis imediatamente; a remoção dos arquivos privados é repetida em
acessos autenticados até o armazenamento confirmar a exclusão.

`0006_family_cleanup.sql` executa uma única vez a limpeza solicitada em 26/10/2026.
Remove os espaços antigos, lançamentos e conexões, preservando cadastros pessoais,
identidades de login, o administrador geral e recibos de operações já confirmadas.
Esses recibos impedem reaplicar operações offline antigas. No próximo acesso, o
aplicativo cria um novo espaço pessoal vazio para cada cadastro concluído.
Pendências antigas de famílias removidas ficam bloqueadas para exportar ou descartar.

Cada usuário pode participar de somente uma família. O sistema bloqueia pedidos,
aprovações, inclusões e criação de família para um administrador já vinculado a
outra. Um índice único no e-mail normalizado também protege contra concorrência.
Em Família, “Sair da família” exige conexão e confirmação, remove o vínculo e a
conexão com o bot, e permite solicitar outra família depois. O aplicativo não
recria automaticamente uma família pessoal para quem saiu. Uma família vazia,
com apenas seu administrador, é encerrada na saída. O último administrador de
uma família com registros ou outras pessoas precisa definir outro administrador
ou solicitar a exclusão ao administrador geral.

Verificação: `node tests/family-privacy.mjs`, `node tests/offline-sync.mjs`,
`node tests/personal-families.mjs`, `node tests/telegram.mjs` e
`node tests/telegram-runtime.mjs`.
