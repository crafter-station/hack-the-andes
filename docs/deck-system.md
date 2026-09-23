# El sistema de decks — motor

Cómo está montado el sistema con el que se producen, publican y exportan los
decks de patrocinio de Hack the Andes.

- **La doctrina** (qué se escribe y en qué orden): [`deck-best-practices.md`](./deck-best-practices.md)
- **La piel** (color, tipografía, retícula): [`deck-design-system.md`](./deck-design-system.md)
- **Los números** (tiers, presupuesto): [`budget-sponsors.md`](./budget-sponsors.md)

> **Origen.** Portado de `~/Documents/the-next-craft` (42 decks, 480 slides en
> producción). Se portaron el motor y la doctrina; **no** el contenido ni el
> sistema visual. El deck de patrocinio viste `terrain`, la piel que fija la base
> de diseño: negro, monocromo y con láminas de terreno — la misma dirección que
> la landing, que también es negra por su propia vía (`dark.css`). Los estilos de
> papel siguen declarados pero hoy no los usa ningún deck.

---

## 1. La idea en una frase

Un deck **no es un PDF**: es una carpeta de slides MDX dentro de la propia app
Next.js. Se publica como URL privada (`/deck/<slug>`), se navega con teclado como
un Keynote, y el PDF —cuando hace falta— se genera por screenshot desde esa misma
URL. Una sola fuente de verdad, dos formatos de entrega.

---

## 2. Mapa de archivos

| Archivo | Rol |
| --- | --- |
| `apps/web/lib/decks/loader.ts` | Lee el filesystem: enumera decks, parsea slides y frontmatter. |
| `apps/web/app/deck/[...slug]/page.tsx` | Ruta estática: compila el MDX y arma el `<head>`. |
| `apps/web/app/deck/[...slug]/deck-pager.tsx` | El reproductor: teclado, swipe, wheel, índice. Client Component. |
| `apps/web/app/deck/layout.tsx` | Layout del deck: fuentes de la landing, stylesheet, fallback sin JS. |
| `apps/web/app/deck/deck.css` | Chrome y vocabulario visual. |
| `apps/web/components/decks/slide-components.tsx` | Los componentes de slide. |
| `apps/web/components/decks/mdx-components.ts` | El mapa que se inyecta al MDX (vocabulario cerrado). |
| `apps/web/content/decks/<slug>/` | El contenido de cada deck. El slug es la ruta, así que puede llevar barra (`main/en`). |
| `scripts/export-deck-pdf.mjs` | Deck web → PDF. |

---

## 3. Anatomía de un deck

Una carpeta:

```
apps/web/content/decks/main/
├── deck.json          ← obligatorio: sin él, la carpeta no es un deck
├── 01-cover.mdx
├── 02-what.mdx
├── …
└── en/                ← la traducción, si la hay
    ├── deck.json
    └── NN-*.mdx
```

### `deck.json`

```json
{
  "title": "Hack the Andes — Patrocinio",
  "description": "Hackathon selectivo de IA en Lima…",
  "style": "editorial"
}
```

Campos reconocidos: `title`, `description`, `image` (og), `icon`, `appleIcon`,
`style`, `lang`. El tipo lleva `& Record<string, unknown>`, así que un campo
extra no rompe nada.

### Traducciones

Una traducción **no es un deck aparte**: vive dentro del deck que traduce, en
una carpeta con su código de idioma, con su propio `deck.json` y sus propios
slides. La URL calca el filesystem.

| Carpeta | URL |
| --- | --- |
| `content/decks/main/` | `/deck/main` |
| `content/decks/main/en/` | `/deck/main/en` |

`lang` (`es` por defecto, o `en`) no traduce nada —los slides están escritos en
el idioma en que están escritos—. Elige el chrome que los rodea: el índice, las
etiquetas del pager, el `lang` que lleva la página para un lector de pantalla.
Está en `chrome-copy.ts`.

El nombre de la carpeta y el `lang` de su `deck.json` tienen que coincidir, y el
loader lo verifica: copiar `en/` a `pt/` y olvidar el campo serviría un deck
inglés bajo una URL portuguesa, y nada más abajo podría notarlo.

Solo un nivel: un deck tiene traducciones, una traducción no.

### Los slides

Frontmatter mínimo y cuerpo JSX:

```mdx
---
title: Tiers de patrocinio
---

<SlideTitle label="Patrocinios" size="sm">Elige el nivel</SlideTitle>
```

El `title` del frontmatter es lo que aparece en el índice. Si falta, cae al
nombre del archivo.

**Regla dura: un slide no puede usar `import`.** Todos los componentes llegan por
el mapa inyectado. Mantiene el chrome irrompible y evita que un slide se traiga
media librería.

---

## 4. El pipeline

```
apps/web/content/decks/<slug>/
   │  listDecks()  ── enumera carpetas con deck.json, más sus traducciones
   │  loadDeck()   ── deck.json + glob NN-*.mdx + gray-matter
   ▼
generateStaticParams()          [build time]
   │  dynamicParams = false
   ▼
compileMDX({ components: mdxComponents })   next-mdx-remote/rsc
   ▼
<DeckPager />  →  HTML estático, sin fs en runtime
```

### Detalles que importan

- **Orden por número de archivo**, no alfabético (`slides.sort((a,b) => a.number - b.number)`).
  Para reordenar, renombras. Para desactivar un slide sin borrarlo, le quitas el
  prefijo numérico y el regex `/^(\d{2,})-.+\.mdx$/` lo ignora.
- **`robots: { index: false, follow: false }`** en todos los decks. Son
  artefactos privados que se mandan por link a una empresa.
- **`remark-gfm`** en `compileMDX`. `mdx-components.ts` mapea `table`, `thead`,
  `tbody`, `tr`, `th` y `td`, y sin el plugin el parser nunca emite un nodo de
  tabla: los seis componentes no podían dispararse y una tabla en markdown salía
  como una fila de pipes literales. Trae además tachado, listas de tareas y
  autolinks, que el mapa no estiliza y caen a los defaults del navegador.
- **`blockJS: false`** en `compileMDX` es obligatorio. next-mdx-remote v6 bloquea
  la evaluación de expresiones por defecto, y los slides pasan arrays y objetos
  como props (`items={[…]}`); sin esa opción los componentes reciben `undefined`
  en silencio. Es seguro porque las fuentes se escriben en este repo, nunca
  vienen del usuario.
- **`outputFileTracingIncludes`** en `next.config.js` fija `content/decks/**`:
  el tracer no ve el directorio a través de lecturas de `fs`.
- **`/deck/` está exento del middleware de Clerk** (`apps/web/proxy.ts`). Quien
  abre el link no tiene cuenta; pasarlo por auth solo rompe el handshake.
- **Un deck nuevo requiere redeploy.** Aceptable: agregar un deck ya es un commit.

---

## 5. El reproductor

| Entrada | Acción |
| --- | --- |
| `←` `↑` `PageUp` | Slide anterior |
| `→` `↓` `PageDown` `Espacio` | Slide siguiente |
| `Home` / `End` | Primero / último |
| `G` | Abrir índice · `Esc` / `G` cierra |
| Swipe horizontal | Anterior / siguiente |
| Wheel / trackpad | Anterior / siguiente |

Todos los slides están en el DOM y se muestran con `data-active`; no hay
montaje/desmontaje por slide. Las láminas de fondo son la excepción en red: el
CSS solo habilita la actual y la siguiente, así la navegación secuencial queda
precargada sin descargar el deck entero al abrirlo. `Photos` usa el mismo
límite; no emite el `src` de una foto hasta que su slide entra en ese par.

**`canScrollWithinSlide()`** comprueba, antes de pasar de slide, si el cursor está
sobre un `.deck-slide-inner` que todavía tiene scroll en esa dirección. Sin eso,
un slide con tabla larga es inalcanzable.

**El swipe exige dominancia horizontal** (`|dx| > |dy|`) para no robarle el scroll
vertical al slide en móvil.

**Sin JavaScript** el deck degrada a scroll vertical apilado, vía un `<noscript>`
con su propio stylesheet en `layout.tsx`. Se hace así, y no con una clase que el
cliente quita al arrancar, porque el navegador lo aplica solo cuando no hay
scripting: no hay estado que deshacer antes de hidratar ni flash de entrada.

---

## 6. El vocabulario de slides

`mdx-components.ts` inyecta exactamente esto; nada más existe dentro de un slide:

**Estructura y texto** — `SlideTitle` · `Lead` · `Wordmark` · `Ready` · `Rule`

**Datos y números** — `Stat` · `StatRow` · `DataGrid` · `DataCell` · `MiniMatrix` · `PrizePodium`

**Oferta comercial** — `SponsorTier` · `BenefitGrid` · `ContrastGrid` · `FlowMap` · `PersonaGrid`

**Evento** — `TrackCard` · `Timeline` · `TimelineRow` · `PhaseTimeline`

**Fotografías** — `Photos`

**Logos** — `Logo` · `LogoRow` · `LogoWall`

**Listas** — `BulletList` · `ChipGrid`

**Markdown base** — `h1 h2 h3 p ul ol li strong a hr blockquote table thead tbody
tr th td` apuntan a `Mdx*`, así que el markdown plano también sale con el estilo
del sistema.

### La retícula compartida

Todo el look nace de dos clases en `deck.css`:

```css
.deck-table { border-top: 1px …; border-left: 1px …; }
.deck-cell  { border-right: 1px …; border-bottom: 1px …; }
```

El contenedor pone arriba e izquierda, cada celda pone derecha y abajo → una
retícula de 1px compartido, sin gaps y sin radius.

---

## 7. Las dos variantes tipográficas

`deck.json → "style"`, tipo `DeckStyle = "plain" | "editorial" | "terrain"`. Baja
al DOM como `data-deck-style` en `.deck-pager`.

| Estilo | Cuándo | Qué cambia |
| --- | --- | --- |
| `editorial` (default de facto) | La mayoría | Barlow Condensed en títulos sobre IBM Plex Mono en chrome. Papel claro. |
| `plain` | Decks institucionales | Una sola familia (IBM Plex Mono). El condensed a escala de titular lee como marketing; para una universidad o un fondo público, no sirve. |
| `terrain` | El deck de patrocinio | Invierte la página a negro, retira todo el croma, pone los títulos en la cara de marca y pinta las láminas de fondo. Redeclara los roles en vez de usar `.brand-light` de `@chofex/ui/globals.css` — ver [`deck-design-system.md`](./deck-design-system.md). |

`terrain` agrega tres campos al frontmatter de un slide: `backdrop` (qué lámina),
`veil` (cuánto se la tapa) y `layout` (cuál de las cuatro plantillas). Los otros
dos estilos los ignoran.

---

## 8. Cómo crear un deck nuevo

1. `mkdir apps/web/content/decks/<partner>` y escribe `deck.json`.
2. Si hay logo, ponlo en `apps/web/public/deck/brand-assets/<partner>/` y
   referencia con `/deck/…` (los assets van en `public/`, no en `content/`).
3. Escribe los slides `NN-nombre.mdx` siguiendo el flujo de
   [`deck-best-practices.md`](./deck-best-practices.md). Copia la estructura de
   `main`.
4. Sin `import`. Solo el vocabulario inyectado.
5. Máximo 40 palabras de prosa por slide.
6. Pasa el checklist de `deck-best-practices.md` §11.
7. Commit y deploy: los decks son estáticos, sin redeploy no existen.
8. PDF si hace falta (ver §9).

---

## 9. Exportar a PDF

```sh
# una vez
bun add -d playwright && bunx playwright install chromium

# con el server corriendo
bun run deck:pdf http://localhost:3000/deck/main hack-the-andes-deck.pdf
```

Captura cada slide desde la página viva y las arma en un PDF 16:9. Es screenshot,
no print CSS: lo que se ve en la web es exactamente el PDF, así que un deck nunca
tiene dos layouts divergentes.

> A diferencia del script del que se portó, este resuelve Playwright por
> `import` normal (el original tenía una ruta absoluta al home de otra máquina) y
> arma el PDF con el propio Chromium, así que **no necesita ImageMagick**.

---

## 10. Estado actual y límites conocidos

- **Cuatro rutas estáticas:** `main` y `partners`, cada una en ES y EN. En total
  son 44 slides.
- **`deck.json` no tiene validación de schema.** Se hace `JSON.parse` y se envuelve
  el error nombrando el deck, pero un campo mal escrito no avisa cuál es.
- **Assets locales:** las láminas y las fotografías viven en `public/deck/` en
  AVIF. Las fotos entran con `Photos`, nunca como backdrop, y cargan de forma
  diferida.
- **Rutas estáticas:** un deck o idioma nuevo requiere build y redeploy; no
  aparece durante la vida de un proceso ya arrancado.
