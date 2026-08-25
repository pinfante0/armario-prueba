// Los dibujos de las piezas: cargar el sprite una vez y repartir nodos.
//
// Todo el contrato cabe en una frase: **el símbolo de una pieza se llama `i-` y
// su id**, y si no está en `web/datos/iconos.svg` esa pieza no tiene dibujo. De
// ahí salen las tres cosas que hacen que esto no estorbe:
//
//   - **No hay campo `icono` en el catálogo.** Sería el mismo hecho en dos
//     sitios y acabaría con dos valores, que es la regla de siempre. Y una tanda
//     de dibujos se entrega tocando un archivo, no dos.
//   - **Una pieza sin dibujo enseña su nombre y ya está.** Los iconos entran por
//     tandas y el motor no espera al contenido, igual que en el proyecto hermano
//     el botón de pista se encendía solo según entraban canciones.
//   - **El sprite se mete en el documento y no se referencia de fuera.** Con
//     `<use href="iconos.svg#i-piano">` el navegador trae el símbolo de otro
//     documento y ahí `currentColor` deja de heredarse de forma fiable: unos
//     navegadores lo resuelven contra el documento referenciado y otros contra
//     el que referencia. Metido en la página, `<use href="#i-piano">` hereda el
//     color como cualquier otro nodo, que es lo que hace que la ficha elegida
//     —blanco sobre azul— voltee el dibujo sin una segunda versión.

const RUTA = new URL('../datos/iconos.svg', import.meta.url);

// El único sitio donde este juego interpreta una cadena como marcado. No es lo
// que prohíbe `nucleo/dom.js`: aquella regla es para que el nombre de un
// instrumento no pueda romper la página, y esto no es texto del catálogo sino
// un archivo nuestro que se sirve al lado del HTML. Y se hace con DOMParser y
// no con innerHTML porque un `<symbol>` suelto dentro de un `<div>` se queda en
// el espacio de nombres equivocado y no lo encuentra ningún `<use>`.
function analizar(texto) {
  const documento = new DOMParser().parseFromString(texto, 'image/svg+xml');
  if (documento.querySelector('parsererror')) throw new Error('iconos.svg no se puede leer');
  return documento.documentElement;
}

/**
 * Carga los dibujos y devuelve con qué dibujar una pieza.
 *
 * Lo que devuelve es una función `(id) => Node | null`, y se le pasa a la
 * pantalla igual que el progreso: una pantalla que se busque los dibujos por su
 * cuenta es una pantalla que no se puede pintar en una prueba sin ellos, y
 * medir con dibujos y sin dibujos es justo lo que la Fase 6 necesita poder
 * hacer.
 *
 * Si el archivo no está, el juego sigue: se juega con nombres, que es como se
 * jugaba desde la Fase 2. Pero se dice por consola, porque eso ya no es una
 * tanda a medias sino algo roto, y las dos cosas no se pueden confundir en
 * silencio.
 *
 * `documento` no es un lujo: `comprobar_pantalla.py` mide cada teléfono dentro
 * de un `<iframe>`, y un `<use href="#i-piano">` solo encuentra su símbolo en
 * **su propio documento**. Con el sprite metido en la página de fuera, los
 * tableros del marco se medirían sin dibujos y la medición diría que cabe algo
 * que no se está pintando.
 */
export async function cargarIconos(documento = document) {
  let sprite;
  try {
    const respuesta = await fetch(RUTA);
    if (!respuesta.ok) throw new Error(`${respuesta.status}`);
    sprite = analizar(await respuesta.text());
  } catch (error) {
    console.warn(`sin dibujos: no se ha podido leer datos/iconos.svg (${error.message})`);
    return () => null;
  }

  sprite = documento.importNode(sprite, true);
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.position = 'absolute';
  sprite.style.width = '0';
  sprite.style.height = '0';
  documento.body.prepend(sprite);

  const hay = new Set(
    [...sprite.querySelectorAll('symbol[id]')].map((s) => s.id.replace(/^i-/, '')),
  );

  // El sprite va en `documento` —el del marco, si lo hay— porque `<use>` solo
  // busca en el suyo. Los nodos que se devuelven, en cambio, se crean con el
  // `document` de aquí, que es el mismo con el que `nucleo/dom.js` construye la
  // pantalla entera, y eso no es un detalle: `dom.js` decide si un hijo es un
  // nodo o un texto con `hijo instanceof Node`, y **`instanceof` va por
  // ventana**. Un elemento creado con el documento del marco no es `Node` para
  // la página de fuera, así que `añadir()` lo pasaba por
  // `String(...)` y en la ficha entraba el texto «[object SVGSVGElement]» en
  // lugar del dibujo. Se veía como dos fallos —piezas sin icono, y el tablero
  // de dos ejes desbordando 10 px— y era este.
  return (id) => {
    if (!hay.has(id)) return null;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 40 40');
    // El nombre viaja en el texto de la ficha y en su aria-label, así que el
    // dibujo no tiene nada que contarle a un lector de pantalla: repetirlo lo
    // haría decir «Piano piano».
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const uso = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    uso.setAttribute('href', `#i-${id}`);
    svg.append(uso);
    return svg;
  };
}
