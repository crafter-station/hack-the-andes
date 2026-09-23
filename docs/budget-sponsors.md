# Presupuesto y tier sheet — Hack the Andes

Cuánto cuesta correr el evento y, en consecuencia, qué se le pide a un sponsor.
Los tiers de este documento **se derivan del presupuesto**; no son una escala
inventada. Si cambian los costos, cambian los tiers.

- **Owner:** Emmy Pardo · **Última revisión:** 14 sep 2026
- **Insumo de:** [`docs/sponsorship-deck-brief.md`](./sponsorship-deck-brief.md)
- **Regla:** este archivo es la **única** fuente de los números de tier. El deck
  y la landing leen de aquí. Ver §6.

> ⚠️ **Los costos unitarios son estimados, no cotizados.** Ninguna línea tiene
> todavía una cotización firmada. Están marcados y hay que reemplazarlos con
> cifras reales antes de comprometer un tier con un sponsor.

---

## 1. Supuestos (explícitos, para poder discutirlos)

| Supuesto | Valor | Estado |
| --- | --- | --- |
| Asistentes | 100 | **confirmado** — `seatCount` y publicado en la landing |
| Sede | Lima, una sola | decidido |
| Duración | 30 h continuas, con pernocte | decidido |
| Fechas | 17–18 oct 2026 | **resuelto** — consistente en toda `content.ts` |
| Tipo de cambio | S/ 3.35 / US$ | implícito en `prizeAmountsPen` |
| Premios | US$2.500 | `prizeAmountsUsd`, cerrado |

> El pool de viajes de US$300 **ya no existe**: `prizeAmountsUsd` quedó en
> `first` y `second`. Los premios bajaron de $2.800 a $2.500.

El pernocte es lo que separa este presupuesto de un hackathon de un día: obliga
a siete servicios de alimentación, seguridad nocturna y sede tomada 30 horas
seguidas. Es la razón de que el costo por hacker sea más alto que el de un
evento de 12 h.

---

## 2. Operación

| Concepto | Unitario | Cant. | USD | Nota |
| --- | ---: | ---: | ---: | --- |
| Alimentación (7 servicios) | $39 | 100 | **$3.900** | desglose en §3 |
| Swag (polo, stickers, lanyard) | $10 | 100 | **$1.000** | ⚠️ estimado |
| Sede 30 h + seguridad nocturna | — | — | **$1.200** | ⚠️ candidato a in-kind |
| Internet dedicado, energía, regletas | — | — | **$400** | no negociable técnicamente |
| Señalética, banners, impresión | — | — | **$350** | incluye piezas de sponsors |
| Mobiliario extra y limpieza nocturna | — | — | **$300** | |
| Producción audiovisual (foto/video) | — | — | **$500** | insumo del recap y del deck 2027 |
| Botiquín, seguro y contingencia | — | — | **$600** | ~8% del subtotal |
| **Subtotal operación** | | | **$8.250** | |

## 3. Desglose de alimentación

Siete servicios, porque el evento cruza una noche:

| Servicio | USD/pax |
| --- | ---: |
| Día 1 · almuerzo | $8 |
| Día 1 · snacks tarde | $3 |
| Día 1 · cena | $8 |
| Madrugada · café y snacks | $4 |
| Día 2 · desayuno | $5 |
| Día 2 · almuerzo | $8 |
| Día 2 · snacks de cierre | $3 |
| **Total por hacker** | **$39** |

## 4. Total a financiar

| | USD | PEN |
| --- | ---: | ---: |
| Operación | $8.250 | S/ 27,638 |
| Premios | $2.500 | S/ 8,375 |
| **Total** | **$10.750** | **S/ 36,013** |

**Costo de operación por hacker: $82,50.** Si el cupo se mueve, esta cifra es la
que hay que multiplicar — no el total.

---

## 5. Los dos sheets

Hay **dos decks y dos escaleras**, y mezclarlas es cómo se manda una propuesta
que no cierra.

### Devtools — sin efectivo, sin cifra

Un devtool elige cuánto crédito da por persona. El tier no fija ese monto:
define si el aporte se queda en Basic o suma podio o merch.

| Tier | Lo que da | Lo que recibe |
| --- | --- | --- |
| **Basic** | Créditos para los 100, en el monto que el sponsor elija | Logo en la landing · assets de anuncio · reporte de claims |
| **Pro** | Basic + créditos para 1º, 2º y 3º | Todo Basic · mención en la premiación · reporte de créditos asignados |
| **Premium** | Basic + merch para participantes | Todo Basic · distribución en el evento · reporte de entrega |

Basic es la base. Pro y Premium son extensiones alternativas: Premium no incluye
Pro por defecto. Ningún tier pide efectivo al devtool.

**Una herramienta por categoría** —inferencia, datos, auth, infra,
observabilidad— para que los créditos de un partner no se diluyan entre cuatro
de lo mismo.

### Efectivo — para todo el resto

Una empresa que quiere poner dinero, un lugar de comida, merch, la sede. No
tienen créditos y no les sirve un reporte de uso, así que compran otra cosa:
presencia, y su producto en la mano de 100 personas durante 30 horas.

Acá sí hay montos, y son los que financian el presupuesto de §4.

| Tier | Aporte | PEN | Slots |
| --- | ---: | ---: | :---: |
| **Title** | $2.500 | S/ 8,375 | 1 |
| **Core** | $1.000 | S/ 3,350 | 2 |
| **Apoyo** | $500 | S/ 1,675 | 6 |
| **En especie** | producto | — | ∞ |

**Chofex ocupa el slot Title**: la landing ya lo llama "Sponsor principal".

$500 está fijado a propósito: es el umbral que en la mayoría de las empresas
entra en presupuesto discrecional sin pasar por legal. Bajarlo no acelera el sí;
subirlo lo manda a un comité.

> Estos montos ya existían en este sheet y se habían reescrito a créditos cuando
> el modelo de devtools cambió. Nunca fueron del deck de devtools — son de este.

### Cuántos slots abre la landing

**9 slots nombrados** (1 Title + 2 Core + 6 Apoyo), más in-kind sin límite.

⚠️ **La grilla de sponsors ya no existe.** El rediseño de la landing eliminó
`sponsorSlots`; hoy hay una sola marca ("Sponsor principal · Chofex",
`sponsorsCopy`). Prometer "logo en la grilla" en el tier Apoyo exige
**reconstruir esa sección**, no actualizar un array. Es trabajo pendiente y hay
que hacerlo antes de cobrar un Apoyo.

---

## 6. ¿Cierra?

Cash con el sheet **lleno**: $2.500 + $2.000 + $3.000 = **$7.500**.
Total a financiar: **$10.750**. Cash solo no alcanza — y eso es por diseño, no
un error: la brecha se cierra con in-kind.

**In-kind objetivo — $3.700:**

| Pieza | USD absorbidos | Candidato |
| --- | ---: | --- |
| Sede | $1.200 | universidad o corporativo con auditorio |
| Alimentación parcial | $1.500 | marca de comida o bebida |
| Swag | $1.000 | imprenta o sponsor de marca |

| | USD |
| --- | ---: |
| Total a financiar | $10.750 |
| − In-kind objetivo | −$3.700 |
| **Necesidad en cash** | **$7.050** |
| Cash si el sheet se llena | $7.500 |
| **Margen** | **+$450** |

Cierra con un margen pequeño. Eso significa que **el sheet tiene poca holgura**:
si falla una pieza de in-kind o no se venden los 6 Apoyo, hay déficit.

### Escenario realista (no el lleno)

Si se venden 3 Apoyo de 6 y falta el in-kind de comida:

| | USD |
| --- | ---: |
| Cash (Title + 2 Core + 3 Apoyo) | $6.000 |
| In-kind logrado (sede + swag) | $2.200 |
| Cubierto | $8.200 |
| **Déficit** | **−$2.550** |

**Palancas, en orden de preferencia:**

1. **Sede in-kind es la de mayor retorno individual** ($1.200 y además da
   legitimidad institucional). Priorizar universidades antes que cash.
2. **Reducir el cupo.** Cada 10 hackers menos son $825 de operación. Es la
   palanca más rápida y la menos popular.
3. **Subir Apoyo de 6 a 10 slots.** +$2.000. Costo: la grilla de la landing
   empieza a verse como un directorio, no como un cartel.
4. **Premio adicional pagado por un partner** en vez de por el evento. No baja
   el costo, lo traslada.

> **Lo que no es palanca: recortar los premios.** Los US$2.500 están publicados
> en la landing y son argumento de convocatoria.

---

## 7. Pendientes que mueven estos números

1. **Reconstruir la grilla de sponsors.** El rediseño la eliminó. Los tres tiers
   prometen logo en la grilla y "espacio mayor en la web", y hoy esa sección
   tiene una sola marca. Bloquea cobrar cualquiera de los tres.
2. **Cotizar de verdad** las cinco líneas marcadas ⚠️.
3. **Definir las categorías del kit antes de vender la primera.** Al cerrar un
   partner se cierra su categoría para todo el evento (`deck-best-practices.md`
   §9). Vender por orden de llegada, sin decidir qué categorías se abren, es
   cómo se termina con dos proveedores de inferencia y una promesa de
   exclusividad imposible de cumplir.
4. **Montar el reporte antes de prometerlo.** Los tres tiers lo incluyen y es lo
   que separa esto de un logo en una web. Lo que contamos nosotros —kits
   reclamados, cuentas creadas, proyectos que lo nombran— hay que instrumentarlo;
   lo que sale de los sistemas del partner —créditos consumidos, API calls— hay
   que pedirlo en el trato, no darlo por hecho.

> El cupo de 100 y las fechas ya no son pendientes: `seatCount` está publicado y
> el 17–18 oct es consistente en toda `content.ts`.

---

## 8. Regla de fuente única

Este archivo es la única fuente de las dos ofertas. Cuando cambien:

1. Se edita **aquí** primero.
2. Se actualiza la sección de sponsors de la landing (hoy `sponsorsCopy`; una
   grilla multi-slot todavía está por construirse).
3. Para devtools, se actualiza `apps/web/content/decks/main/09-tiers.mdx`.
4. Para aportes en efectivo o especie, se actualiza
   `apps/web/content/decks/partners/08-tiers.mdx`.

> El sistema del que se portó este documento tiene el mismo tier sheet escrito
> con tres números distintos en tres archivos (Silver ×3, ×5 y ×8). No es un
> descuido evitable con cuidado: es lo que pasa sin una regla de fuente única.
