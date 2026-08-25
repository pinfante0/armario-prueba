// Cuatro ayudas para construir pantallas sin plantillas ni innerHTML.
//
// Copiado tal cual de Intervalos (Videojuegos/Piloto_videojuego), donde llevaba
// desde el 31/07/2026. Es de lo poco que no sabe nada de aquel juego, así que
// viaja entero y sin cambios salvo este comentario.
//
// No es un framework y no quiere serlo: esto son unas pocas pantallas y un
// tablero. Lo único que hacía falta era dejar de escribir
// createElement/appendChild cuatro veces por botón.
//
// Nada de esto interpreta cadenas como HTML. El texto entra siempre por
// textContent, que es lo que hace imposible que el nombre de un instrumento con
// un símbolo raro rompa la página.

/**
 * Un elemento. El nombre admite clases al estilo CSS:
 *
 *     el('button.principal', { onclick: jugar }, 'Empezar')
 *     el('p.nota', {}, 'Sin alumnos delante')
 */
export function el(nombre, props = {}, ...hijos) {
  const [etiqueta, ...clases] = nombre.split('.');
  const nodo = document.createElement(etiqueta || 'div');
  if (clases.length) nodo.className = clases.join(' ');

  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'clase') nodo.classList.add(...String(valor).split(' ').filter(Boolean));
    else if (clave === 'datos') Object.assign(nodo.dataset, valor);
    else if (clave === 'estilo') estilar(nodo, valor);
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else if (clave in nodo) nodo[clave] = valor;
    else nodo.setAttribute(clave, valor);
  }

  añadir(nodo, hijos);
  return nodo;
}

/**
 * Estilos en línea. Las propiedades personalizadas —`--color`, que es como
 * llega aquí el color de la cualidad desde intervalos.json— hay que ponerlas
 * con setProperty: asignarlas sobre `style` no hace nada y falla en silencio.
 */
function estilar(nodo, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) {
    if (propiedad.startsWith('--')) nodo.style.setProperty(propiedad, valor);
    else nodo.style[propiedad] = valor;
  }
}

/** Mete hijos en un nodo: cadenas, números, nodos o listas de todo eso. */
export function añadir(nodo, hijos) {
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

/** Deja un nodo vacío. */
export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

/** Segundos en «1:04», para el reloj del contrarreloj. */
export function reloj(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Milisegundos en «2,4 s». Con coma decimal, que esto está en español. */
export function segundos(ms, decimales = 1) {
  return `${(ms / 1000).toFixed(decimales).replace('.', ',')} s`;
}

/** Una promesa que se cumple sola. Para las pausas entre ítems. */
export const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
