// Cómo se juega un tablero desde fuera: buscando botones en el documento y
// haciéndoles clic, sin llamar a `Partida` ni mirarle el estado por dentro.
//
// Está aquí por lo mismo que `medidas.js`: desde la Fase 4 hay dos páginas que
// necesitan ordenar un tablero. `jugar.js` lo ordena para comprobar que se
// puede, y `pantalla.js` lo ordena para poder **llegar a la segunda vuelta y
// medirla**, porque a esa pantalla no se llega de otra manera: los rótulos solo
// se dan la vuelta cuando el armario ya está ordenado. Una segunda copia de
// esto acabaría siendo una segunda definición de «jugar».
//
// La regla que no se rompe aquí: nada de esto le pregunta nada al juego. Se
// leen los botones pintados y se les hace clic, que es lo único que demuestra
// que el estado, la pantalla y los toques están unidos.

export const enMonton = (raiz, id) => raiz.querySelector(`.monton [data-pieza="${id}"]`);
export const colocada = (raiz, id) => raiz.querySelector(`.huecos [data-pieza="${id}"]`);
export const huecoLibre = (raiz, casilla) => raiz.querySelector(`[data-casilla="${casilla}"]`);
export const aviso = (raiz) => raiz.querySelector('.aviso');
export const candado = (raiz) => raiz.querySelector('.resultado:not([hidden]) .candado');
export const principal = (raiz) => raiz.querySelector('.principal');
export const rotulos = (raiz) =>
  [...raiz.querySelectorAll('.armario .rotulo')].map((r) => r.textContent);

/**
 * A qué balda va cada pieza.
 *
 * Con rótulos, a la que lleva su nombre. Sin rótulos no hay nombre y lo único
 * que identifica una balda es cuántos huecos tiene, así que a la pieza le toca
 * la balda cuyo tamaño coincide con el de su grupo: eso es exactamente el
 * razonamiento del nivel 3, y por eso las capacidades salen todas distintas.
 */
export function solucion(tablero) {
  const grupo = (p) => tablero.celdaDe(p).join(' ');
  const donde = new Map();

  if (tablero.rotulos === 'visibles') {
    // Con rótulos, la balda la dice el tablero. Se le pregunta a él porque en
    // un tablero de subniveles hay dos baldas que le encajan a la misma pieza
    // y manda la más concreta, y eso no se ve comparando claves.
    for (const p of tablero.piezas) donde.set(p.id, tablero.indiceDe(p));
    return donde;
  }

  const tamano = new Map();
  for (const p of tablero.piezas) tamano.set(grupo(p), (tamano.get(grupo(p)) ?? 0) + 1);
  for (const p of tablero.piezas) {
    donde.set(p.id, tablero.casillas.findIndex((c) => c.capacidad === tamano.get(grupo(p))));
  }
  return donde;
}

/** En qué balda está cada pieza ahora, leído del documento. */
export function reparto(raiz) {
  const donde = new Map();
  [...raiz.querySelectorAll('.huecos')].forEach((balda, i) => {
    for (const ficha of balda.querySelectorAll('[data-pieza]')) donde.set(ficha.dataset.pieza, i);
  });
  return donde;
}

/** Toca la pieza y toca su hueco. Los dos toques de todo el juego. */
export function colocar(raiz, id, casilla, fallos) {
  const ficha = enMonton(raiz, id) ?? colocada(raiz, id);
  if (!ficha) return fallos.push(`no hay ninguna ficha para '${id}'`);
  ficha.click();
  const hueco = huecoLibre(raiz, casilla);
  if (!hueco) return fallos.push(`no queda hueco libre en la balda ${casilla} para '${id}'`);
  hueco.click();
}

/** La primera vuelta: sacar del montón y colocar. */
export function ordenarColocando(raiz, tablero, fallos) {
  const donde = solucion(tablero);
  for (const pieza of tablero.piezas) colocar(raiz, pieza.id, donde.get(pieza.id), fallos);
  return donde;
}

/**
 * Ordena una segunda vuelta a base de intercambios, y devuelve qué piezas ha
 * tocado.
 *
 * Aquí no hay huecos libres —las baldas no cambian de tamaño al cambiarles el
 * rótulo—, así que colocar es intercambiar. Se coge una pieza que esté donde no
 * va y se cambia por otra que tampoco esté en la suya y ocupe la balda a la que
 * la primera quiere ir: eso es seguir el ciclo, y es lo que haría alguien que
 * ve cuáles chirrían.
 *
 * Por eso el número de piezas que toca esta función tiene que ser exactamente
 * el `mover` que calculó el generador, y ese cruce es lo que hay que mirar de
 * este nivel: la nota se mide jugando y no preguntándosela al juego.
 */
export function ordenarIntercambiando(raiz, tablero, fallos) {
  const donde = solucion(tablero);
  const tocadas = new Set();

  for (let vuelta = 0; vuelta <= tablero.piezas.length; vuelta++) {
    const ahora = reparto(raiz);
    const mal = [...ahora].filter(([id, balda]) => donde.get(id) !== balda);
    if (!mal.length) return tocadas;

    const [id] = mal[0];
    const destino = donde.get(id);
    const otra = mal.find(([, balda]) => balda === destino);
    if (!otra) {
      fallos.push(`'${id}' quiere la balda ${destino} y allí no sobra nada: no es un ciclo`);
      return tocadas;
    }
    colocada(raiz, id).click();
    colocada(raiz, otra[0]).click();
    tocadas.add(id).add(otra[0]);
  }

  fallos.push('la segunda vuelta no se ha podido ordenar intercambiando');
  return tocadas;
}
