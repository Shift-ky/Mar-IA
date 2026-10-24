# Revisão funcional — Mar IA

Repositório de atualização: https://github.com/Shift-ky/Mar-IA (main). As alterações feitas nesta conversa devem ser enviadas ao repositório, preservando mudanças remotas. A conexão não é um monitor de pastas nem uma automação em segundo plano.

## Correções

- Página inicial apresenta entrada por e-mail quando a sincronização identifica ausência de sessão; a cópia offline de contas conhecidas continua disponível.
- Formulários separados ao alternar entrada, cadastro e recuperação evitam reaproveitar campos e validações de outro fluxo.
- Últimos lançamentos ordenados por data antes de limitar a cinco registros.
- Busca sem resultados apresenta estado vazio.
- index.html da raiz oferece acesso ao servidor da aplicação; GitHub Pages não executa APIs, D1 ou autenticação do servidor.
- Logo, ícone de instalação, manifesto, fontes locais e cache offline preservados.

## Verificação

Testes de autenticação com provedor simulado, cadastro e permissões por família, sincronização offline, conflitos, parcelas, estoque/falteiro e webhook simulado. Checagem TypeScript, build de produção, navegação visual na entrada/cadastro/recuperação e verificação HTTP dos recursos.

## Dependências externas pendentes

- Supabase: URLs de redirecionamento, templates e SMTP; envio real e confirmação precisam ser homologados. Veja CADASTRO_EMAIL.md.
- WhatsApp: ativação Meta, credenciais, webhook e extrator fiscal precisam ser configurados e testados. Veja WHATSAPP_ATIVACAO.md.
- Não há integração bancária real; os lançamentos são registros de controle financeiro.
