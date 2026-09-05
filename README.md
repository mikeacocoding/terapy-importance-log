# Registro diario

App para llevar un registro diario de actividades: hora de inicio/fin, nombre
de la actividad, disfrute (1-10), importancia (1-10) y una reflexión libre por
día. Un solo usuario, protegida por contraseña.

Publicada como app estática en GitHub Pages:
`https://mikeacocoding.github.io/terapy-importance-log/`

## Dónde viven los datos

- **`localStorage`** del navegador es la fuente principal — todo funciona sin
  conexión.
- Si conectas un **Gist privado de GitHub** (con un token personal, scope
  `gist`) desde Ajustes, los datos sincronizan entre dispositivos.
- Una contraseña protege ese token (cifrado con AES-GCM) y actúa como pantalla
  de bloqueo. No cifra los registros ni el código de la app — el repo es
  público.

## Uso en GitHub Pages

Abre la URL publicada. La primera vez, crea una contraseña — no hay forma de
recuperarla si la olvidas. Desde Ajustes puedes conectar un Gist para
sincronizar entre el celular y la laptop.

## Modo local (opcional)

El servidor Express sirve la misma app por la WiFi de casa y guarda un
respaldo en `data/registro.json`.

```bash
npm install
npm run dev
```

Levanta el servidor en `http://localhost:3000`, accesible también desde el
celular en la misma red (la consola imprime la IP). Si el Gist está
conectado, manda el Gist y el archivo local sólo actúa de espejo de respaldo.
Si no hay Gist configurado, el archivo local es la fuente de datos al
arrancar.

## Migrar datos viejos

Si tienes un `data/bk.json` con el formato antiguo (con `id`), este comando lo
convierte al formato nuevo:

```bash
npm run migrate-bk
```

Genera `data/registro-export.json`, que se importa desde Ajustes → Importar
JSON.

## Estructura del proyecto

```
importance-log/
├── public/                 # esto es lo que publica GitHub Pages
│   ├── index.html
│   ├── styles.css
│   ├── app.js               # arranque y router
│   ├── js/
│   │   ├── store.js         # estado, localStorage, invariantes del modelo
│   │   ├── crypto.js        # PBKDF2 + AES-GCM
│   │   ├── gist.js          # cliente de la API de Gists
│   │   ├── local-server.js  # espejo con el servidor local (modo LAN)
│   │   ├── time.js          # formato 12 h, duraciones
│   │   ├── dom.js           # helpers mínimos
│   │   └── views/           # lock, day, entry-form, calendar, settings
│   ├── manifest.webmanifest
│   ├── sw.js
│   └── icons/
├── server.js                # modo local: sirve public/ + /api/data
├── src/db.js                # lectura/escritura atómica de data/registro.json
├── scripts/migrate-bk.mjs   # convierte data/bk.json al formato nuevo
├── .github/workflows/pages.yml
└── design/                  # mockups de referencia visual, no se despliegan
```

## Despliegue

En Settings → Pages del repo, configura **Source: GitHub Actions**. El
workflow en `.github/workflows/pages.yml` publica `public/` en cada push a
`main`.

## Datos

- `data/*.json` nunca se commitea (está en `.gitignore`).
- Cada escritura del servidor local se hace primero en un archivo temporal y
  luego se renombra sobre el final, para no corromper el JSON si el proceso se
  interrumpe a mitad de una escritura.
