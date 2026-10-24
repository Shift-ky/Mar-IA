# Identidade Mar IA aplicada ao aplicativo

Referência: painel de branding fornecido pelo usuário, com símbolo de ondas/M, acabamentos em azul e prata, Montserrat e o posicionamento “Soluções inteligentes”.

## Paleta

| Uso | Cor |
| --- | --- |
| Azul profundo | `#0A1E3A` |
| Azul oceano | `#006DFF` |
| Ciano | `#00E0FF` |
| Prata | `#E6EAF1` |
| Branco | `#FFFFFF` |

O aplicativo usa fundos escuros e superfícies azuis em camadas. Ciano indica foco, seleção e progresso; prata/branco organizam os textos e valores. Estados de alerta e despesas usam cores semânticas discretas para leitura financeira. Os padrões de ondas são decorativos e não ficam sobre os números.

## Tipografia e modo offline

Montserrat está hospedada no próprio projeto em `public/fonts/`, nos pesos 300, 400, 500, 600, 700 e 800. A licença SIL OFL acompanha os arquivos. Fontes, símbolo, ícone e padrão de ondas fazem parte do precache do service worker: a identidade não depende de fontes externas para funcionar depois da preparação offline.

## Ativos

- `public/brand/mar-symbol.png`: símbolo com transparência preparado a partir do painel de referência.
- `public/brand/mar-app-icon.png`: ícone quadrado para aplicação/PWA e favoritos.
- `public/brand/waves.svg`: padrão decorativo em código vetorial, com linhas azul/ciano.
- `public/manifest.webmanifest`: cores e ícone atualizados.
- `app/globals.css`: layout responsivo, identidade, formulários, tabelas, menus e estados de interação.

Os bitmaps foram preparados com a ferramenta integrada de imagens, preservando a direção da referência. São derivados do painel enviado e não substituem um arquivo vetorial oficial de marca que eventualmente exista. A imagem de referência completa não foi publicada junto à interface.

## Prompts usados para os ativos

Símbolo: “Extract ONLY the existing blue/cyan/silver sculptural wave M symbol shown in the top-right cell labeled SÍMBOLO. Preserve its distinctive folded ocean-wave M silhouette, the two peaks and central trough, layered navy/cyan blue ribbons and silver-white leading fold. Remove surrounding material, typography, panels, borders, backgrounds and mockups. A single isolated symbol on a genuinely transparent background. No new logo design.”

Ícone: “Precisely preserve the folded layered ocean-wave M symbol shown in the top-right ÍCONE APP/REDES example. Square app-icon composition, full-bleed deep ocean navy #0A1E3A, blue/cyan/silver mark centered, no typography, no labels, no mockup or surrounding board. Preserve the supplied identity rather than designing a new logo.”

Painel e tela de acesso foram conferidos em largura de computador e em viewport de 390 pixels com dados fictícios. As páginas temporárias de verificação foram removidas antes de empacotar.
