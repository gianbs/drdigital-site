# Site Dr Digital Gráfica

Site da Dr Digital Gráfica (Acopiara-CE). Feito só com HTML, CSS e JavaScript, sem nada para instalar.

## Arquivos
- `index.html`: textos e seções do site
- `style.css`: cores e visual (as cores da marca ficam no topo, em `:root`)
- `script.js`: botões de WhatsApp. O número fica na 1ª linha (`WHATSAPP`)
- `assets/`: logos em SVG

## Como editar
- **Trocar o número do WhatsApp:** edite `const WHATSAPP = "5588996061140";` em `script.js`
- **Adicionar opções a um produto:** em `index.html`, copie uma linha `<option>...</option>` dentro do produto
- **Mensagem dos botões simples:** altere o atributo `data-wa="..."`

## Publicar grátis no GitHub Pages
1. Abra o repositório no GitHub → **Settings** → **Pages**
2. Em *Source* escolha **Deploy from a branch**, branch **main**, pasta **/ (root)** → **Save**
3. Em 1 a 2 minutos o site fica em `https://gianbs.github.io/drdigital-site/`
