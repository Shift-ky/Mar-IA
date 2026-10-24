# Cadastro individual por e-mail — Mar IA

## Implementação desta versão

O código inclui telas de entrada, cadastro, confirmação, reenvio de confirmação, recuperação e nova senha, com identidade visual Mar IA. Cada cadastro pede nome, telefone com país/DDD, e-mail e senha. Nome e telefone são dados de contato; o telefone não confirma identidade nem libera uma recuperação de senha por si só.

A integração usa `@supabase/ssr` 0.12.7 e `@supabase/supabase-js` 2.118.0, fixados no lockfile. Senhas são gerenciadas pelo Supabase, não gravadas no banco financeiro. Sessões usam cookies HttpOnly, SameSite=Lax e Secure em produção. A identidade é verificada no servidor com `auth.getUser()`, exigindo e-mail confirmado. Não se usa `getSession()` ou `user_metadata` como autorização. Nome e telefone no metadata servem somente para completar o próprio perfil após autenticação.

Os dados financeiros permanecem em D1, com as permissões e separação entre famílias já existentes. Nenhuma tabela financeira foi transferida para Postgres. A tabela local `auth_identities` mantém o identificador anterior ao vincular uma identidade Supabase confirmada com o mesmo e-mail, quando não há ambiguidade. Uma identidade já vinculada não é cedida automaticamente a outra conta que reutilize o e-mail. O administrador inicial é identificado por um e-mail explícito de configuração, não pelo primeiro cadastro externo.

O perfil ganhou um campo de telefone. A migração adiciona esse campo como nullable para preservar cadastros antigos; a aplicação pede que o usuário complete o contato antes de continuar. Nenhum dado financeiro é apagado.

## Estado da ativação

O projeto **Mar IA** foi criado em São Paulo (`elzwlqniyuhobayatgyf`) e sua URL e chave publicável foram configuradas no ambiente de produção, fora do Git. O site está público na hospedagem, mas as APIs financeiras exigem autenticação e autorização por família. Visitantes sem sessão recebem o formulário da Mar IA.

Ainda é necessário configurar/verificar no painel Supabase os URLs e templates abaixo e a entrega de e-mails. O conector disponível não expõe alterações dessas configurações. Nenhum e-mail real foi enviado nesta revisão; não considerar a confirmação e recuperação homologadas antes desse teste. O serviço padrão de e-mail do Supabase tem restrições para destinatários e produção; configure SMTP próprio para os membros da família.

## Configuração necessária

Configure no runtime do servidor, sem gravar valores reais no Git:

| Variável | Valor |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto escolhido |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável `sb_publishable_...`; nunca service_role nem `sb_secret_...` |
| `MAR_ADMIN_EMAIL` | E-mail confirmado do administrador geral que será preservado/criado |

O cliente do Supabase é criado por requisição no servidor. O navegador chama somente os endpoints da Mar IA. As respostas de autenticação e das APIs financeiras são `no-store`. A atualização de sessão acontece nas rotas das APIs que verificam o usuário; não há consulta de sessão Supabase em páginas estáticas ou renderizações cacheáveis.

No painel do projeto Supabase:

1. Ative autenticação por e-mail/senha e exija confirmação do e-mail.
2. Configure a Site URL como a origem real que servirá a aplicação.
3. Cadastre os Redirect URLs exatos `/auth/callback` e `/auth/callback?next=/nova-senha` nessa origem.
4. Verifique o remetente e a configuração de envio de e-mail do projeto. Teste envio de confirmação e recuperação para os destinatários reais antes de liberar o cadastro da família.
5. Configure validade de sessão, expiração de JWT, limites de envio e proteção contra abuso adequados ao projeto. A aplicação depende também das proteções e limites do provedor.
6. Configure os templates abaixo para permitir o fluxo por token hash. Isso evita depender de o link ser aberto no mesmo navegador que iniciou o pedido.

## Template de confirmação de cadastro

```html
<h2>Confirme seu e-mail na Mar IA</h2>
<p>Olá! Confirme seu e-mail para começar a usar sua conta.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmar meu e-mail</a></p>
<p>Se você não pediu este cadastro, pode ignorar esta mensagem.</p>
```

## Template de recuperação de senha

```html
<h2>Redefina sua senha na Mar IA</h2>
<p>Recebemos um pedido para redefinir a senha da sua conta.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Criar uma nova senha</a></p>
<p>Se você não fez este pedido, ignore esta mensagem.</p>
```

O provedor verifica os links e sua validade. O servidor só redireciona para destinos internos fixos: confirmação para `/`, recuperação para `/nova-senha`. Parâmetros que tentem redirecionar para outro site são ignorados. Após redefinir a senha, a aplicação solicita logout global ao Supabase e pede novo login. A duração residual de tokens de acesso depende das regras e da expiração configuradas no provedor; não se afirma invalidação instantânea de todos os JWTs.

A recuperação retorna a mesma mensagem de sucesso para e-mails desconhecidos e conhecidos. O login rejeita a ausência de confirmação. O formulário usa senha nova de pelo menos 12 caracteres, sem armazená-la no IndexedDB ou no banco financeiro. Cadastro, login, confirmação e recuperação exigem internet. O uso offline já preparado continua disponível para dados baixados e alterações locais de uma conta conhecida.

## Testes

`node tests/account-auth.mjs` valida os fluxos com o provedor simulado: campos, e-mail confirmado, recuperação genérica, definição de senha, links inválidos, redirecionamentos internos, preservação de identidade antiga e ausência de privilégios vindos do metadata. Os testes não substituem a configuração nem o teste de envio no projeto Supabase real.

`node tests/offline-sync.mjs` continua cobrindo famílias, permissões, cadastro, sincronização, estoque e WhatsApp.

## Documentação consultada

- https://supabase.com/changelog.md
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/server-side/creating-a-client

O changelog foi revisado; não se usa o pacote `@supabase/server` nem os adapters depreciados. O projeto mantém dependências e lockfile fixados. Nenhuma chave de serviço está presente no frontend ou neste guia.
