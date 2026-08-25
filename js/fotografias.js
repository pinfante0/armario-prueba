// Las fotografías de las piezas: saber cuáles hay y repartir nodos.
//
// Es el gemelo de `iconos.js` y hace lo mismo con otra materia, así que lo que
// conviene leer aquí es **en qué se diferencia**, que son dos cosas:
//
//   - **Hay que preguntar qué archivos existen.** El sprite se resuelve solo
//     porque es un archivo único: se trae entero y ya se sabe qué símbolos
//     lleva. Aquí son 59 archivos sueltos y **un navegador no puede listar una
//     carpeta**. Las dos salidas eran pedirlas todas y esconder las que dan 404
//     —o sea 53 peticiones fallidas por tablero, la consola llena y un salto de
//     alto cuando llegan las que sí están— o leer una lista. Se lee una lista, y
//     la escribe `preparar_fotografias.py` mirando la carpeta en cada pasada:
//     `web/datos/fotografias/indice.json`. Que una pieza tenga fotografía sigue
//     derivándose de que exista su archivo; lo que hay al lado es su índice, no
//     un campo nuevo en el catálogo.
//   - **El recurso no hereda el color.** Un `<use>` voltea a blanco sobre azul
//     con `currentColor` y una fotografía no: la ficha elegida le cambia el
//     fondo alrededor y la fotografía se queda como es. No es un defecto que
//     haya que compensar —una fotografía de un violín es la misma en las cuatro
//     situaciones de la ficha— pero es la razón por la que aquí no hace falta
//     nada del cuidado que se le puso al sprite con `importNode`.
//
// Y una que no se ve y es la que puede romper la medición: **un `<img>` sí
// tiene tamaño propio**. Un `<svg>` con `viewBox` y sin `width` no le impone
// nada a su columna; un `<img>` de 512 px sí, y en la rejilla de dos ejes el
// mínimo de una columna `1fr` **es** el min-content de su celda. Eso es lo que
// en la tanda 1 hizo que el tablero pidiera 330 px de los 320 que hay. Aquí se
// resuelve en el CSS —`width` y `max-width: 100%`— y lo comprueba
// `web/pruebas/medidas.js`, que mide el min-content de cada ficha con el recurso
// dentro y sin él y exige que sea el mismo.
//
// ## El índice trae dos listas desde la entrega 6.5
//
// `fotografias` son las miniaturas de 512 px, que las tiene toda pieza con
// recurso; `detalles` son los WebP de 1024 px que abre «Ver de cerca», y esa la
// tiene solo la pieza cuya fuente los da sin ampliar. Por eso este módulo dejó
// de devolver una función para devolver un objeto: la ficha sigue pidiendo un
// `nodo`, pero el visor pregunta además si hay detalle y por la URL de la que se
// carga bajo demanda. El violonchelo tiene miniatura y no detalle, y el visor lo
// resuelve cayendo a la miniatura sin pedir un 404, porque la lista se lo dice.

const RUTA = new URL('../datos/fotografias/', import.meta.url);

/**
 * El `<img>` de una pieza para la ficha, con los mismos cuidados de siempre.
 */
function miniaturaNodo(id) {
  const img = document.createElement('img');
  img.src = new URL(`${id}.webp`, RUTA).href;
  // El nombre viaja en el texto de la ficha y en su `aria-label`, así que la
  // fotografía no tiene nada que contarle a un lector de pantalla: repetirlo
  // le haría decir «Violín violín». Es la misma decisión que en el sprite.
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  // La ficha es un botón. Sin esto, arrastrar la fotografía con el ratón
  // empieza un arrastre del navegador en vez de un toque.
  img.draggable = false;
  // Que no se cargue tarde: las fichas de un tablero están todas a la vista,
  // así que `lazy` solo serviría para que la medición midiera fichas vacías.
  img.loading = 'eager';
  img.decoding = 'async';
  return img;
}

/** El mismo objeto que si no hubiera ninguna: la ficha cae a dibujos y nombres. */
function sinNinguna() {
  return {
    nodo: () => null,
    tieneFoto: () => false,
    tieneDetalle: () => false,
    miniatura: () => null,
    detalle: () => null,
  };
}

/**
 * Carga el índice y devuelve con qué enseñar y con qué ampliar una pieza.
 *
 * Lo que devuelve es un objeto y no una función, porque hay dos preguntas: la
 * ficha pide `nodo(id)` —igual que `cargarIconos()`, un `Node` o `null`— y el
 * visor pregunta `tieneDetalle(id)` y pide la URL de `detalle(id)` o, cuando no
 * la hay, la de `miniatura(id)`, que se cargan bajo demanda al abrir la lupa.
 * Quién gana cuando una pieza tiene dibujo y fotografía se decide en
 * `recursos.js` y no aquí.
 *
 * Si el índice no está, se devuelve el objeto vacío: el juego sigue con dibujos
 * y con nombres, que es como se jugaba antes de esta materia, y la lupa no
 * aparece porque ninguna pieza tiene fotografía. Es justo lo que hace el archivo
 * único, que apaga la lectura a propósito hasta la 6.8. Se dice por consola
 * porque un índice que falta no es un lote a medias: es algo roto, y las dos
 * cosas no se pueden confundir en silencio.
 */
export async function cargarFotografias() {
  let hayFoto = new Set();
  let hayDetalle = new Set();
  try {
    const respuesta = await fetch(new URL('indice.json', RUTA));
    if (!respuesta.ok) throw new Error(`${respuesta.status}`);
    const indice = await respuesta.json();
    if (!Array.isArray(indice?.fotografias)) throw new Error('no trae la lista «fotografias»');
    hayFoto = new Set(indice.fotografias);
    hayDetalle = new Set(Array.isArray(indice.detalles) ? indice.detalles : []);
  } catch (error) {
    console.warn(`sin fotografías: no se ha podido leer el índice (${error.message})`);
    return sinNinguna();
  }

  return {
    nodo: (id) => (hayFoto.has(id) ? miniaturaNodo(id) : null),
    tieneFoto: (id) => hayFoto.has(id),
    tieneDetalle: (id) => hayDetalle.has(id),
    miniatura: (id) => (hayFoto.has(id) ? new URL(`${id}.webp`, RUTA).href : null),
    // El detalle vive en la subcarpeta y solo lo tiene quien está en la lista.
    detalle: (id) => (hayDetalle.has(id) ? new URL(`detalle/${id}.webp`, RUTA).href : null),
  };
}
