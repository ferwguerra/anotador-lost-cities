# Anotador de expediciones

Hoja de puntaje digital e individual para un roll & write de expediciones que se juega con dados físicos.
Cada jugador usa su propio teléfono. Ver `README.md` para el uso general.

## Convenciones

- Todo en español rioplatense (voseo): textos de la interfaz, comentarios, commits.
- No incluir dados virtuales, material ni nombres o arte del juego original: el nombre visible es "Expediciones".
- HTML + JS sin dependencias ni build. ES5 (`var`, `function`), sin frameworks.

## Estructura

Todo el código vive en `app/src/main/assets/`:

- `logic.js`: reglas y puntaje, sin DOM. Exporta para node (`module.exports`) y para el navegador (`window.Logic`).
- `app.js`: interfaz (render de la grilla, modales, eventos). Estado guardado en `localStorage` (`anotador-expediciones-v1`).
- `style.css`, `index.html`.
- `sw.js`, `manifest.webmanifest`: instalación y modo sin conexión de la versión web.

El resto del repo (Gradle, `MainActivity.java`) solo envuelve esos archivos en una WebView para el APK.

## Reglas implementadas (resumen)

- 6 expediciones de 9 casilleros, números no decrecientes; el 0 solo marca el círculo ×2 de una expedición sin empezar.
- Casilleros especiales (`SPECIAL` en `logic.js`): artefacto (tacha uno en la columna de artefactos) y aceleración (avanza gratis repitiendo el último número).
- "Pasar" tacha un dado; con 9 quedás agotado (esa columna vale 0).
- 8 puentes (6 expediciones + artefactos + dados) en el 7.º casillero: +20 solo si sos el primero.
  - Al llegar se pregunta si fuiste el primero (estado `pending`).
  - Antes de llegar, tocar el 20 lo tacha (otro jugador cruzó primero) y ya no se pregunta; otro toque lo destacha.
  - Después de cruzarlo, tocar el 20 alterna ganado / sin bono.
- El puntaje queda oculto hasta "Terminar"; la hoja se bloquea hasta reabrirla desde el menú.
- `fotos/` (no versionada) tiene fotos de la hoja de papel original usadas como referencia.

## Probar

- Lógica: con node, por ejemplo `node -e "var L=require('./app/src/main/assets/logic.js'); ..."`. No hay suite de tests.
- Interfaz: abrir `app/src/main/assets/index.html` en el navegador.

## Publicar

La versión web (https://ferwguerra.github.io/anotador-lost-cities/) se sirve desde la rama `gh-pages`, que contiene solo la carpeta de assets:

```
git push origin main
git subtree push --prefix app/src/main/assets origin gh-pages
```

- Al cambiar archivos de la app, subir la versión de `CACHE` en `sw.js` (`anotador-vN`).
- Si cambian los íconos, renombrarlos (por ejemplo `icon-v3-*`) porque los teléfonos los cachean fuerte.
- El APK (`./gradlew assembleDebug`, con el SDK local en `.android-sdk/`) solo se genera si se pide explícitamente.
