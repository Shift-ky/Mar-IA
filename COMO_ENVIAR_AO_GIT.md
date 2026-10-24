# Mar IA — Branding e cadastro individual

Código-fonte da versão publicada: 31f43e0ed00672c143877a84e4e33af8f0dc9be7.

## Enviar ao Git

Extraia o ZIP. Para um repositório novo e vazio, abra a pasta mar-ia no terminal e substitua URL_DO_REPOSITORIO pela URL real:

```sh
git init
git add .
git commit -m "Mar IA com branding e cadastro por email"
git branch -M main
git remote add origin URL_DO_REPOSITORIO
git push -u origin main
```

Se já houver um repositório, clone-o primeiro, copie estes arquivos e revise as alterações antes de fazer commit. O pacote não contém senhas, tokens privados, registros financeiros, comprovantes reais, dependências instaladas ou histórico .git.

## Guias incluídos

- `docs/BRANDING_MAR_IA.md`: paleta, tipografia, símbolos e aplicação da identidade.
- `docs/CADASTRO_EMAIL.md`: configuração do Supabase Auth, confirmação de e-mail e recuperação de senha.
- `docs/WHATSAPP_ATIVACAO.md`: configuração do WhatsApp, receptor separado e leitura de documentos.

## Situação das integrações

Branding e campo de telefone foram implementados. O fluxo de e-mail/senha está preparado e testado com provedor simulado, mas o projeto Supabase real ainda não foi acessado/configurado. O acesso existente continua disponível e a audiência da hospedagem não foi alterada. E-mails reais, liberação do acesso exclusivamente por e-mail e configuração do projeto precisam ser concluídos antes de liberar o cadastro para terceiros.

WhatsApp continua dependendo da ativação e configuração descritas no seu guia. Nenhum segredo deve ser enviado ao repositório institucional. O campo de telefone é contato; não autoriza recuperar uma senha sem confirmação de identidade.

## Desenvolvimento

Requisitos declarados: Node >= 22.13 e pnpm 11.25.0. Leia README.md para configuração do banco local.

```sh
pnpm install --frozen-lockfile
node scripts/build-offline.mjs
pnpm dev
```

O projeto usa Cloudflare Workers/D1/R2 e integração de autenticação. GitHub Pages isoladamente não executa a API. As migrações preservam as tabelas existentes; são a estrutura do banco, não um backup dos registros.
