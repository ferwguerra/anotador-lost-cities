# Anotador de expediciones

Hoja de puntaje digital, individual, para jugar con los dados físicos de un roll & write de expediciones.
No incluye dados virtuales ni material del juego.

**Usarla:** https://ferwguerra.github.io/anotador-lost-cities/

- iPhone: abrir en Safari → Compartir → "Agregar a pantalla de inicio".
- Android: abrir en Chrome → menú → "Instalar app".

Después de la primera carga funciona sin conexión.

## Desarrollo

La app es HTML + JS sin dependencias y vive en `app/src/main/assets/`:

- `logic.js`: reglas y puntaje (sin DOM).
- `app.js`, `style.css`, `index.html`: interfaz.
- `sw.js`, `manifest.webmanifest`: instalación y modo sin conexión de la versión web.

Para probar, abrir `app/src/main/assets/index.html` en un navegador.

La versión web se publica desde la rama `gh-pages`, que contiene solo esa carpeta:

```
git subtree push --prefix app/src/main/assets origin gh-pages
```

El mismo código se empaqueta como APK de Android (una WebView): `./gradlew assembleDebug`.
