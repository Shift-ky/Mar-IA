# Mar IA — código-fonte atualizado

Commit desta entrega: f6dc35e7ff6467480f1038bd623a286635349a7f

Inclui cadastro individual, famílias/permissões, modo offline, sincronização, estoque, falteiro, histórico de preços, revisão de cupons e integração de servidor para WhatsApp.

## Enviar ao Git

Extraia o ZIP. Na pasta mar-ia, para um repositório novo e vazio, substitua URL_DO_REPOSITORIO pela URL real:

```sh
git init
git add .
git commit -m "Mar IA com WhatsApp estoque e falteiro"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

Se já houver um repositório com histórico, clone-o primeiro, copie estes arquivos e revise as mudanças antes de fazer commit. Não use envio forçado para substituir um histórico existente.

## Ativar o WhatsApp

Leia `docs/WHATSAPP_ATIVACAO.md` antes de configurar serviços externos. O receptor HTTPS separado está em `whatsapp-relay/` e precisa ser implantado. Os segredos devem ser configurados no runtime do servidor, fora do Git. O exemplo `.env.example` contém apenas nomes e campos vazios.

O número e o portfólio Meta ainda precisam de conferência. Nenhum token real nem dados financeiros estão neste arquivo. O repositório institucional não foi modificado. A leitura fiscal automática depende da contratação/conexão de um provedor que realmente valide documentos fiscais; até lá, os arquivos recebidos seguem para revisão manual.

Os testes foram realizados com dados fictícios e serviços simulados. O arquivo inclui as migrações, que preservam as tabelas já existentes. Não inclui backup do banco de produção, arquivos de comprovantes, dependências, credenciais, cache de usuários ou histórico .git.

## Executar o projeto

Consulte README.md. Requer Node >=22.13 e pnpm 11.25.0. O projeto usa Vinext/React, Cloudflare Workers/D1/R2 e autenticação fornecida pelo Sites. GitHub Pages isoladamente não executa o backend. Para desenvolvimento:

```sh
pnpm install --frozen-lockfile
node scripts/build-offline.mjs
pnpm dev
```

Aplique as migrações no ambiente local conforme README.md. O banco local é separado da produção. Antes de publicar:

```sh
node scripts/build-offline.mjs
pnpm build
```
