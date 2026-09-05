# Plan de implementación — Registro diario v2

Documento de trabajo. Contiene todo lo necesario para implementar sin volver a
tomar decisiones de producto: las que había ya están tomadas y anotadas con su
motivo. Si algo aquí choca con la realidad del código, gana la realidad — pero
avisa en vez de improvisar una tercera opción.

Diseño aprobado (mockups de las seis pantallas, con medidas y colores):
<https://claude.ai/code/artifact/49f70d58-460d-45ef-8fc1-5721e1efb0f1>

Fuente de los mockups: `design/*.dc.html`. Son HTML plano con estilos en línea;
se pueden abrir y copiar valores exactos de ahí. **No** son la app: son la
referencia visual.

---

## 1. Qué se está construyendo y por qué cambia

Hoy la app es un servidor Express que guarda en `data/registro.json` y se abre
desde el celular por la WiFi de casa. Eso obliga a tener la computadora
encendida y en la misma red.

El objetivo es una app **estática** publicada en GitHub Pages
(`https://mikeacocoding.github.io/terapy-importance-log/`), que funcione desde
cualquier lado, guarde en el navegador y sincronice con un Gist privado de
GitHub. Un solo usuario, protegida por contraseña.

Lo nuevo respecto a hoy:

1. Sin servidor: GitHub Pages sólo sirve archivos estáticos.
2. Contraseña al entrar.
3. Descargar todos los registros como JSON **sin ids**.
4. Poder registrar en **cualquier fecha**, no sólo hoy.
5. Las actividades del día se ordenan por hora de inicio.
6. Al abrir el formulario, la hora de inicio por defecto es **la hora actual**.
7. Horas siempre en formato 12 h con `a.m.` / `p.m.`.
8. Rediseño visual mobile-first.

---

## 2. Decisiones ya tomadas (no reabrir)

| Decisión | Elegido | Motivo |
|---|---|---|
| Dónde viven los datos | `localStorage` como fuente local + sync a un **Gist privado** con token personal | Sync entre celular y laptop con la menor ceremonia; sin backend que mantener |
| Contraseña | **Pantalla de bloqueo simple**, no cifrado completo de los registros | Elección explícita del usuario: prioriza fricción baja |
| Token de GitHub | **Sí se cifra** con la contraseña (AES-GCM) | Es el único secreto real en juego; cifrarlo hace que la contraseña sirva para algo |
| Servidor Express | **Se conserva**, reducido a hosting LAN + respaldo local | El usuario quiere seguir pudiendo usarlo en casa |
| Vista de día | **Opción A — tarjetas** | Deja comparar disfrute vs importancia de un vistazo |
| Formato de hora | 12 h, `a.m.` / `p.m.` | Pedido explícito |
| Build | **Ninguno.** ES modules servidos tal cual | Pages sirve archivos crudos; un build es una pieza más que se rompe |

### Advertencias que ya se le dieron al usuario

Repetirlas si se tocan estos temas, no descubrirlas de nuevo:

- Un gist "privado" de GitHub es **secreto, no privado**: no se lista, pero
  cualquiera con la URL lo abre. El usuario lo aceptó. Si algún día quiere
  privacidad real, la alternativa es un repo privado con la misma API.
- La pantalla de bloqueo **no protege el código** (el repo es público) ni los
  registros guardados en claro en `localStorage`. Protege el token y frena a
  quien tome el teléfono desbloqueado. No la describas en la interfaz como algo
  más de lo que es.

---

## 3. Estructura de archivos

```
public/                      ← esto es lo que GitHub Pages publica
  index.html
  styles.css
  app.js                     arranque y router
  js/
    store.js                 estado, localStorage, eventos de cambio
    crypto.js                PBKDF2 + AES-GCM
    gist.js                  cliente de la API de Gists
    time.js                  formato 12 h, redondeo, duraciones
    dom.js                   helpers mínimos (el/on/fmt)
    views/
      lock.js
      day.js
      entry-form.js
      calendar.js
      settings.js
  manifest.webmanifest
  sw.js
  icons/icon-192.png, icon-512.png, apple-touch-icon.png

server.js                    modo local (LAN + respaldo)
src/db.js                    lectura/escritura atómica del documento completo
scripts/migrate-bk.mjs       convierte data/bk.json al formato nuevo
.github/workflows/pages.yml  despliegue

data/                        NO se commitea (ya está en .gitignore)
design/                      mockups .dc.html (referencia visual)
```

> **Rutas relativas, obligatorio.** El sitio vive bajo `/terapy-importance-log/`,
> no en la raíz del dominio. Todo `src`/`href`/`fetch` debe ser `./algo`, nunca
> `/algo`. El `index.html` actual usa `/styles.css` y `/app.js` — eso rompe en
> Pages y hay que cambiarlo.

---

## 4. Modelo de datos

Un solo documento, que es **exactamente** lo que se exporta y lo que se sube al
Gist. Sin ids: el día se identifica por su fecha (única) y la actividad por su
posición dentro del día.

```json
{
  "version": 1,
  "updatedAt": "2026-09-04T23:41:07.812Z",
  "days": [
    {
      "date": "2026-09-04",
      "reflection": "Me costó arrancar la mañana…",
      "entries": [
        {
          "start": "07:30",
          "end": "08:15",
          "activity": "Correr en el parque",
          "enjoyment": 8,
          "importance": 7
        }
      ]
    }
  ]
}
```

Invariantes que el store debe garantizar en cada escritura:

- `date` es `YYYY-MM-DD` en hora **local**, nunca UTC. No uses
  `toISOString().slice(0,10)`: en zonas al oeste de Greenwich devuelve el día
  equivocado por la noche. Construye la cadena con `getFullYear/getMonth/getDate`.
- `days` ordenado por `date` **descendente** (lo más reciente primero).
- `entries` ordenado por `start` **ascendente**, reordenado en cada guardado.
- `start` / `end` en 24 h `"HH:MM"` — el formato 12 h es sólo presentación.
- `enjoyment` / `importance`: entero 1–10, o `null` si no se puso nada.
- `activity`: string, puede quedar vacío.
- `reflection`: string, `""` cuando está vacía.
- Un día sin entradas y sin reflexión se **elimina** del array al guardar.
- `updatedAt` es ISO-8601 UTC, se refresca en cada mutación; es lo que decide
  quién gana en el sync.

**Exportación**: el archivo descargado es este documento sin `updatedAt`
(`{version, days}`), con indentación de 2 espacios. Nombre sugerido:
`registro-2026-09-04.json`.

**Importación**: acepta tanto el formato nuevo como el **viejo con ids** (los
ignora). Combina por fecha, no reemplaza a ciegas: si una fecha existe en ambos
lados, se quedan las entradas de ambos deduplicadas por
`start|end|activity`; la reflexión importada sólo pisa la local si la local
está vacía. Al terminar, muestra un resumen ("12 días nuevos, 3 combinados").

---

## 5. Horas — reglas exactas

`js/time.js`, sin dependencias.

```js
// Almacenamiento: siempre 24 h "HH:MM". Presentación: siempre 12 h.

to12h("07:30")   // → "7:30 a.m."
to12h("00:05")   // → "12:05 a.m."
to12h("12:00")   // → "12:00 p.m."
to12h("18:15")   // → "6:15 p.m."

formatRange("10:00", "12:30")  // → "10:00 a.m. – 12:30 p.m."
```

- Sin cero a la izquierda en la hora (`7:30`, no `07:30`); los minutos sí van
  con dos dígitos.
- Separador de rango: guion largo `–` (U+2013) con un espacio a cada lado.
- **Se escriben los dos periodos aunque coincidan**: `5:00 p.m. – 6:00 p.m.`,
  no `5:00 – 6:00 p.m.`. Regla única, sin casos especiales.
- `a.m.` / `p.m.` en minúsculas con puntos, precedido de un espacio normal.

```js
nowRounded(15)   // hora actual redondeada al múltiplo de 15 más cercano → "18:15"
addMinutes("18:15", 60)  // → "19:15"
duration("10:00", "12:30")  // → "2 h 30 m"   (también "45 m", "1 h")
```

Si `end <= start`, se asume que la actividad cruza la medianoche: la duración se
calcula sumando 24 h y la tarjeta muestra un `termina al día siguiente` discreto
bajo el rango. No lo bloquees.

**Entrada de hora en el formulario**: tres `<select>` nativos en línea — hora
(1–12), minuto (00, 05, …, 55) y periodo (a.m. / p.m.). Los selects nativos abren
la rueda del sistema en móvil, son accesibles y no cuestan código. No uses
`<input type="time">`: en `es` lo pinta el sistema en 24 h y no se puede
controlar.

---

## 6. Sistema visual

Todos los valores salen de los mockups. Define los tokens en `:root` y no
inventes colores fuera de esta lista.

### Tipografía

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

- `Instrument Serif` (fallback `Georgia, serif`) — la fecha del encabezado, los
  promedios del día, la reflexión, la cifra grande de los sliders. Nunca en
  interfaz funcional.
- `Manrope` (fallback `ui-sans-serif, system-ui, sans-serif`) — todo lo demás.
- Los números que se comparan en columna llevan `font-variant-numeric: tabular-nums`.

Se van `Fraunces`, `Karla` e `IBM Plex Mono`.

### Color

```css
:root {
  --bg:            #f6f2ea;   /* papel */
  --surface:       #fffdf9;   /* tarjeta */
  --surface-sunk:  #efe9dd;   /* reflexión, fondos hundidos */
  --surface-alt:   #ece5d8;   /* segmentados, botones terciarios */

  --ink:           #3a352d;
  --ink-soft:      #6b6353;   /* texto secundario  — 5.3:1 sobre --bg */
  --ink-faint:     #756d5e;   /* etiquetas 9–11 px — 5.0:1 sobre --bg */
  --ink-disabled:  #8d8474;   /* días futuros, duraciones */

  --line:          #e7dfd2;
  --line-soft:     #f0e9dd;
  --track:         #ede2d4;   /* segmento vacío de los medidores */

  --sage:          #4a8a76;   /* IMPORTANCIA + acción primaria */
  --sage-tint:     #e6efea;
  --sage-ink:      #3f7561;

  --clay:          #b5704e;   /* DISFRUTE */
  --clay-tint:     #f7e9de;
  --clay-ink:      #8a5638;

  --danger:        #a05b45;

  --radius-card:   16px;
  --radius-ctl:    14px;
  --radius-lg:     17px;
}
```

Modo oscuro — mismos nombres, redefinidos bajo
`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
**y** bajo `:root[data-theme="dark"]`, para que el selector de tema de Ajustes
gane en ambas direcciones. Valores en `design/Oscuro.dc.html`; los principales:

```
--bg #191713   --surface #232019   --surface-sunk #221f19   --surface-alt #2b2721
--ink #ece5d8  --ink-soft #b5ad99  --ink-faint #9a927f      --ink-disabled #7d7566
--line #322c23 --track #3a342a
--sage #7cc0a8 --sage-tint #1e332c --clay #dd9a72 --clay-tint #3a2a1f
```

**El color significa algo y no se negocia**: terracota = disfrute, salvia =
importancia. En toda la app, siempre.

### Reglas de composición

- Ancho de referencia 390 px. Todo fluido; nada con ancho fijo en px.
- Ningún objetivo táctil por debajo de **44 × 44 px**.
- Agrupa hermanos con `display: flex` / `grid` + `gap`. Nada de márgenes por
  elemento ni espaciado por espacios en blanco del HTML.
- Iconos: SVG en línea, trazo 1.6–2, `stroke="currentColor"`, caja de 24.
  Cero emoji.
- Sombras sólo en lo que flota (botón primario, día seleccionado, hoja modal).
- Respeta `prefers-reduced-motion`.
- Los medidores de 10 segmentos son 10 `<span>` en un flex con `gap: 2px`: los
  primeros `n` en el color del acento, el resto en `--track`. No uses un ancho
  porcentual — los segmentos hacen legible el "sobre 10" sin escribirlo.

---

## 7. Pantallas

Cinco vistas más el modo oscuro. Una sola página, sin router de URL: un estado
`view` en memoria basta. Sí conviene reflejar la fecha abierta en el hash
(`#2026-09-04`) para poder recargar sin perder el día.

### 7.1 Bloqueo — `views/lock.js`

Artboard **Bloqueo**. Es la primera pantalla siempre que no haya sesión abierta.

- Logotipo: tres barras redondeadas de largos distintos (salvia, terracota,
  arena). Está dibujado en el mockup.
- Campo de contraseña + botón de mostrar/ocultar + botón **Entrar**.
- Interruptor **Mantener abierto en este dispositivo**.
- Nota al pie explicando dónde viven los datos. Mantén el texto honesto.
- **Primer arranque** (no hay contraseña guardada): la misma pantalla en modo
  "crear contraseña", con confirmación en un segundo campo y una advertencia de
  que no hay forma de recuperarla.
- Contraseña incorrecta: sacude el campo, mensaje bajo el input, sin contador de
  intentos ni bloqueo — es un solo usuario en su propio dispositivo.

### 7.2 Día — `views/day.js`

Artboard **Día**. Es la pantalla principal.

- **Encabezado**: cintillo `REGISTRO DIARIO`, la fecha en serif (`Viernes 4 de
  septiembre`, primera letra en mayúscula, sin el año), y un botón de 44 px a
  ajustes. Si la fecha abierta es hoy, añade un `· Hoy` en `--ink-faint`
  después de la fecha.
- **Tira de la semana**: flecha ‹, siete pastillas (lunes primero), flecha ›.
  Cada pastilla lleva la inicial del día, el número y un punto debajo si ese día
  tiene registros. El día abierto va en pastilla oscura con sombra; los días
  futuros en `--ink-disabled` y sin punto. Las flechas mueven la semana entera.
  Tocar la fecha del encabezado abre el calendario.
- **Resumen**: dos tarjetas, disfrute (terracota) e importancia (salvia), con el
  promedio del día en serif y un medidor de 10 segmentos redondeado al entero.
  Promedio sobre las entradas que tengan valor; `—` si no hay ninguna.
- **Lista de actividades**: encabezado `ACTIVIDADES` + `4 bloques · 5 h 15 m`
  (suma de duraciones). Luego una tarjeta por actividad, ordenadas por hora:
  - fila 1: rango de horas a la izquierda, duración a la derecha;
  - fila 2: nombre de la actividad;
  - fila 3: los dos medidores lado a lado con su etiqueta y su número.
  - Toque en la tarjeta → editar. Deslizar a la izquierda o pulsación larga →
    eliminar con confirmación.
- **Reflexión**: bloque hundido, icono de bocadillo, etiqueta `LO QUE MÁS PESÓ
  HOY`, texto en serif. Editable en su sitio (`contenteditable` o textarea que
  crece), guardado con debounce de 800 ms.
- **Día vacío**: en lugar de la lista, un estado vacío con una línea corta y el
  botón de registrar. No pongas ilustraciones.
- **Barra inferior fija**: botón salvia a ancho completo **Registrar actividad**
  con `+`. Deja `padding-bottom` suficiente para el área segura del iPhone
  (`env(safe-area-inset-bottom)`).

### 7.3 Registrar actividad — `views/entry-form.js`

Artboard **Registrar actividad**. Hoja modal que sube desde abajo y ocupa casi
toda la pantalla.

- Tirador, título `Nueva actividad` (o `Editar actividad`), botón de cerrar.
- **Selector de fecha**: botón con la fecha del día abierto y un `Cambiar` que
  abre el calendario. Que se pueda cambiar la fecha desde aquí es la mitad del
  requisito "registrar en otra fecha".
- **Desde / Hasta**: los tres selects descritos en §5. El campo `Desde` lleva
  una insignia `AHORA` en terracota **cuando su valor sigue siendo el que se
  puso por defecto**; en cuanto el usuario lo toca, la insignia desaparece.
- Valores por defecto al abrir en modo creación:
  - `Desde` = **hora actual redondeada a 15 minutos**, siempre, sin importar qué
    fecha esté abierta. Esto es un requisito explícito.
  - `Hasta` = `Desde` + 1 h.
- **Actividad**: textarea que crece con el contenido, `placeholder` "¿Qué
  hiciste?".
- **Disfrute** e **Importancia**: etiqueta, cifra grande en serif a la derecha,
  y un slider con pista de 8 px y pulgar de 30 px (área táctil de 44). Bajo el
  slider, `1 · nada` y `10 · muchísimo`. Usa `<input type="range" min="1"
  max="10" step="1">` con estilos propios: es accesible y arrastra bien en móvil.
  Empiezan sin valor; hasta que el usuario toca, la cifra muestra `—` y se
  guarda `null`.
- Pie: **Cancelar** (secundario) y **Guardar** (salvia). Guardar cierra la hoja
  y desplaza la lista hasta la tarjeta afectada, resaltándola un momento.
- Al editar, un tercer botón de **Eliminar** en `--danger`, en texto, arriba del
  pie.

### 7.4 Elegir fecha — `views/calendar.js`

Artboard **Elegir fecha**.

- Rejilla de mes, semana empezando en **lunes**, encabezado `L M X J V S D`.
- Celdas de 52 px en `grid-template-columns: repeat(7, minmax(0, 1fr))`.
- Punto bajo el número si ese día tiene registros; borde punteado si el día ya
  existe pero está vacío; días de otro mes en gris muy claro; el día abierto en
  pastilla oscura.
- Leyenda de dos entradas bajo la rejilla.
- Atajos **Hoy / Ayer / Anteayer**.
- Botón inferior **Abrir viernes 4**, que refleja el día seleccionado.
- **Fechas futuras**: se ven apagadas pero **se pueden seleccionar**. No las
  bloquees: puede querer anotar algo planificado.

### 7.5 Ajustes — `views/settings.js`

Artboard **Ajustes**. Cuatro grupos.

- **Tus datos**
  - `Descargar JSON` — subtítulo con el recuento real (`24 días · 118
    actividades · sin ids`). Genera un Blob y un `<a download>`.
  - `Importar JSON` — abre un `<input type="file" accept="application/json">`,
    combina según §4 y muestra el resumen.
- **Sincronización** — la tarjeta del Gist, detallada en §8.
- **Acceso**
  - `Cambiar contraseña` — pide la actual, deriva de nuevo y **vuelve a cifrar
    el token** con la clave nueva. Si esto falla, el token se pierde: hazlo en
    ese orden y no borres el cifrado viejo hasta que el nuevo esté escrito.
  - `Bloquear ahora` — descarta la clave en memoria y vuelve al bloqueo.
- **Tema** — segmentado Automático / Claro / Oscuro; escribe `data-theme` en
  `<html>` y lo guarda en `localStorage`.
- Pie con la versión y una línea sobre dónde viven los datos.

---

## 8. Sincronización con el Gist

`js/gist.js`. Todo contra `https://api.github.com`, que permite CORS con
`Authorization` desde el navegador — funciona desde Pages sin proxy.

### Conexión

El usuario crea un **token clásico** en
<https://github.com/settings/tokens> con el scope **`gist`** y nada más, y lo
pega en Ajustes. Pon ese enlace y el scope requerido en la interfaz: es el paso
donde la gente se atasca. Los tokens *fine-grained* no cubren gists; no los
sugieras.

Al conectar:

1. Valida el token con `GET /gists` (si devuelve 401, dilo claramente).
2. Busca entre los gists uno cuyo `description` sea `registro-diario`.
3. Si no existe, créalo:

```http
POST /gists
{ "description": "registro-diario", "public": false,
  "files": { "registro-diario.json": { "content": "…" } } }
```

4. Guarda el `id` del gist en claro y el token **cifrado** (§9).

Cabeceras en toda petición:

```
Authorization: Bearer <token>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28
```

### Bajar y subir

- Bajar: `GET /gists/{id}` → `files["registro-diario.json"].content`.
  Si `truncated` es `true`, vuelve a pedirlo por `raw_url`. Con 128 actividades
  no pasa, pero cuesta cinco líneas y evita corrupción silenciosa dentro de un
  año.
- Subir: `PATCH /gists/{id}` con el mismo cuerpo que el POST.

### Cuándo

- **Al desbloquear**: baja. Compara `updatedAt` remoto contra local.
  - Remoto más nuevo → adopta el remoto y repinta.
  - Local más nuevo → sube.
  - Iguales → nada.
- **En cada mutación**: marca sucio, y sube con debounce de 3 s.
- **Al volver a primer plano** (`visibilitychange`) si pasaron más de 5 min:
  baja.
- Sin conexión: encola y reintenta al volver `online`. Los datos locales nunca
  esperan al Gist — `localStorage` se escribe primero, siempre.

### Conflictos

Gana el `updatedAt` más reciente, **pero nunca en silencio**: si al bajar el
remoto es más nuevo *y* había cambios locales sin subir, muestra un aviso con la
opción de descargar el estado local como JSON antes de adoptar el remoto. Es un
solo usuario: el caso real es "el celular estuvo sin red", no una edición
concurrente.

### Estado en la interfaz

Punto de color + texto: `Sincronizado hace 3 min` (salvia), `Sincronizando…`
(arena), `Sin conexión — 4 cambios pendientes` (terracota), `Error de
sincronización` (danger, con el mensaje real de la API detrás de un desplegable).
El mismo punto, en pequeño, en el encabezado de la vista de día.

---

## 9. Contraseña y cifrado del token

`js/crypto.js`, sólo WebCrypto. Sin librerías.

### Derivación

```
PBKDF2-SHA-256, 310 000 iteraciones, salt de 16 bytes aleatorios
  → clave AES-GCM de 256 bits
```

En un celular tarda 200–500 ms. Muestra un estado de carga en el botón Entrar.

### Verificador

No se guarda ningún hash de la contraseña. Al crearla se cifra la cadena fija
`registro-diario-v1` con la clave derivada y se guarda:

```json
{ "salt": "<base64>", "iv": "<base64>", "ct": "<base64>" }
```

Al desbloquear se deriva con el `salt` guardado y se intenta descifrar: si la
etiqueta de autenticación de AES-GCM falla, la contraseña es incorrecta. Eso es
todo el mecanismo.

### Token

Se cifra con la misma clave y su propio `iv`. **Nunca** se escribe en claro en
`localStorage`, ni se registra en consola, ni aparece en un mensaje de error.

### Sesión

- Interruptor **apagado** (por defecto): la clave derivada vive sólo en memoria.
  Recargar la pestaña vuelve a pedir la contraseña.
- Interruptor **encendido**: se exporta la clave (`crypto.subtle.exportKey`) y
  se guarda en `localStorage`. Esto anula la protección del token frente a quien
  tenga el dispositivo — es la elección del usuario y está bien, pero que el
  texto junto al interruptor lo diga sin adornos.

### Claves de `localStorage`

Todas con prefijo `rd.`:

```
rd.doc          el documento (§4)
rd.auth         { salt, iv, ct }        verificador
rd.token        { iv, ct }              token cifrado
rd.gistId       string en claro
rd.session      clave exportada, sólo si "mantener abierto"
rd.theme        "auto" | "light" | "dark"
rd.lastSync     ISO
```

---

## 10. Modo local (servidor Express)

Se conserva, reducido. Sirve para dos cosas: abrir la app desde el celular en la
WiFi de casa sin internet, y tener un respaldo en disco.

- `server.js`: sirve `public/` y expone exactamente dos endpoints —
  `GET /api/data` (devuelve el documento o `{version:1,updatedAt:null,days:[]}`)
  y `PUT /api/data` (lo reemplaza entero, con la escritura atómica que ya está).
- `src/db.js`: quítale la cola de transacciones por entidad; con un documento
  completo basta leer, escribir a `.tmp` y renombrar.
- **Borra `src/routes/days.js`.** La API por entidad con ids desaparece.
- En el cliente: al arrancar, `GET ./api/data`. Si responde, hay servidor local.
  - **Precedencia, para que no haya tres fuentes de verdad**: si el Gist está
    configurado, manda el Gist; el archivo local es un espejo al que se escribe
    en cada cambio y que no se lee nunca. Si el Gist **no** está configurado, el
    archivo local es la fuente al arrancar.
  - En Pages el `fetch` falla con 404 y el modo local simplemente no existe. Que
    ese fallo sea silencioso, no un error en consola.

---

## 11. Despliegue

`.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: public }
      - id: deployment
        uses: actions/deploy-pages@v4
```

Publicar desde `public/` con Actions evita duplicar la app en `docs/` y deja que
el servidor Express siga sirviendo exactamente los mismos archivos.

**Paso manual, avísale al usuario**: en Settings → Pages hay que poner *Source:
GitHub Actions*. El workflow no puede hacerlo solo.

### PWA

Para que se instale en la pantalla de inicio del celular:

- `manifest.webmanifest` con `"start_url": "./"`, `"scope": "./"`,
  `"display": "standalone"`, `"background_color": "#f6f2ea"`,
  `"theme_color": "#f6f2ea"` e iconos de 192 y 512.
- `<meta name="theme-color">` con un valor por esquema, claro y oscuro.
- `sw.js`: cachea el esqueleto con una constante de versión, `cache-first` para
  los estáticos y **nunca** para `api.github.com`. Sube la versión en cada
  despliegue o el usuario se queda con una app vieja y no entenderá por qué.

---

## 12. Migración de los datos actuales

`data/bk.json` tiene 15 días y 128 actividades, del 2026-08-20 al 2026-09-03,
en el formato viejo con ids. `data/registro.json` es idéntico.

`scripts/migrate-bk.mjs`: lee `data/bk.json`, quita los `id`, ordena las
entradas por `start` y los días por fecha descendente, y escribe
`data/registro-export.json`. El usuario lo importa desde Ajustes con el mismo
flujo de "Importar JSON" — así se prueba el importador con datos reales de paso.

**Ningún archivo de `data/` se commitea.** Ya está en `.gitignore`; déjalo así.

---

## 13. Orden de trabajo

Cada paso deja la app en un estado que se puede abrir y probar.

1. `time.js` + `store.js` con las invariantes de §4. Pruébalos en la consola
   antes de dibujar nada.
2. `index.html` + `styles.css` con los tokens de §6 y las rutas relativas.
3. Vista de día completa con datos de prueba: encabezado, tira de semana,
   resumen, tarjetas, reflexión, barra inferior. Es la pantalla que más se ve.
4. Hoja de registrar/editar, con los valores por defecto de hora de §7.3.
5. Calendario y navegación entre fechas.
6. Exportar e importar. Aquí ya se pueden meter los datos reales (§12).
7. `crypto.js` + pantalla de bloqueo.
8. `gist.js` + la tarjeta de sincronización.
9. Modo oscuro y selector de tema.
10. PWA y `sw.js`.
11. Adaptar `server.js` / `src/db.js`, borrar `src/routes/days.js`.
12. Workflow de Pages. Reescribir el `README.md`, que hoy describe la app vieja.

---

## 14. Criterios de aceptación

- [ ] Con la contraseña puesta, recargar pide contraseña; con el interruptor
      encendido, no.
- [ ] Contraseña incorrecta nunca da acceso, y el token no se puede descifrar
      sin ella.
- [ ] Se puede abrir un día de hace tres semanas y añadirle una actividad.
- [ ] Al abrir el formulario, `Desde` trae la hora actual redondeada a 15 min,
      aunque el día abierto sea de la semana pasada.
- [ ] Toda hora visible está en 12 h con `a.m.` / `p.m.`; ningún `18:15` en
      pantalla.
- [ ] Las actividades se reordenan solas por hora al guardar una intercalada.
- [ ] Ningún objeto del JSON descargado tiene una clave `id` (compruébalo
      recorriendo el árbol, no con un buscar-y-ver: el texto de una actividad
      puede contener «id» por casualidad).
- [ ] Importar `data/registro-export.json` reproduce los 15 días y las 128
      actividades.
- [ ] Un cambio en el celular aparece en la laptop tras recargar.
- [ ] Ningún objetivo táctil por debajo de 44 px, verificado a 390 px de ancho.
- [ ] Claro y oscuro correctos, y el segmentado de tema gana sobre el sistema en
      ambos sentidos.
- [ ] La app carga sin errores de consola en
      `https://mikeacocoding.github.io/terapy-importance-log/`.

---

## 15. Qué no hacer

- No añadir un framework, un bundler ni un gestor de estado. Son seis pantallas.
- No añadir gráficas, rachas, insignias, ni "logros". Es un registro de terapia,
  no una app de hábitos.
- No poner analítica, ni telemetría, ni ninguna petición a un tercero que no sea
  `api.github.com` y Google Fonts.
- No inventar campos nuevos en el modelo. Si algo parece que hace falta,
  pregunta antes.
- No escribir el token en un log, un mensaje de error, ni la URL.
- No commitear nada de `data/`.
- No tocar `design/` — son la referencia visual, no código de la app.
