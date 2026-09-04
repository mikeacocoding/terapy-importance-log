# Registro diario (activación conductual)

App web local para llevar un registro diario de actividades: hora de inicio/fin,
nombre de la actividad, disfrute (1-10), importancia (1-10) y una reflexión libre
por día. Todo se guarda en `data/registro.json`, sin base de datos externa ni login.

## Instalación

```bash
npm install
```

## Uso

```bash
npm run dev
```

Esto levanta el servidor en `http://localhost:3000` y lo deja escuchando en
todas las interfaces de red (`0.0.0.0`). Al arrancar, la consola muestra algo así:

```
Servidor corriendo en http://localhost:3000
Accesible desde el celular en la misma red WiFi:
  http://192.168.1.23:3000
```

`npm run dev` reinicia el servidor automáticamente al guardar cambios en el código
(usa `node --watch`). Para producción, usa `npm start`.

## Acceder desde el celular

1. Asegúrate de que el celular esté conectado a la **misma red WiFi** que la
   computadora donde corre el servidor.
2. Abre en el navegador del celular la URL que aparece en la consola bajo
   "Accesible desde el celular en la misma red WiFi" (por ejemplo
   `http://192.168.1.23:3000`).
3. Si no carga, revisa que el firewall de la computadora no esté bloqueando el
   puerto 3000, y que ambos dispositivos estén en la misma subred.

## Datos

- El archivo `data/registro.json` se crea automáticamente la primera vez que
  arranca el servidor, con la estructura `{ "days": [] }`.
- Cada guardado se escribe primero en un archivo temporal y luego se renombra
  sobre el archivo final, para evitar corromper el JSON si el proceso se
  interrumpe a mitad de una escritura.
- No hay base de datos externa ni sincronización en la nube: todo vive en ese
  archivo, dentro de este mismo directorio.

## Estructura del proyecto

```
importance-log/
├── server.js              # arranca Express, escucha en 0.0.0.0
├── src/
│   ├── db.js               # lectura/escritura atómica de data/registro.json
│   └── routes/days.js      # endpoints /api/days...
├── data/
│   └── registro.json       # se crea automáticamente
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```
