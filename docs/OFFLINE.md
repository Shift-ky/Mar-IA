# Funcionamento offline

Use o servidor da aplicação: https://financas-familia-robson.merryscout8.chatgpt.site/ . A página GitHub Pages é apenas uma entrada para esse servidor; salvar ou abrir só o index.html não instala o aplicativo offline.

Em cada computador/celular, entre uma vez com internet, selecione a família e aguarde “Aplicativo disponível offline neste navegador” no painel “Offline e sincronização”. Se a preparação falhar, o painel informa o erro e permite tentar novamente. Abra esse mesmo endereço ou instale pelo navegador.

A tela de entrada oferece “Abrir os dados salvos neste aparelho”. Sem uma cópia local anterior, o aplicativo informa que o primeiro acesso requer internet. Confirmação de conta, recuperação de senha e envio de arquivos externos exigem conexão.

A versão offline inclui a navegação e os formulários de finanças e lista de compras. Operações são gravadas em IndexedDB e sincronizadas ao reconectar com o aplicativo aberto. Mantenha o mesmo navegador/perfil e não limpe seus dados com pendências. Sair da conta limpa a cópia local após resolver as pendências.

Correções: navegações por /entrar, /nova-senha e atalhos /offline também recebem a aplicação offline; preparação iniciada na tela de acesso; confirmação de disponibilidade verifica todos os arquivos em cache; falhas deixam de ser ocultadas no painel. O indicador offline não confirma que os dados de uma família já foram baixados: confira também a última sincronização.
