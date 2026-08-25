// El azar, que tiene que ser el mismo aquí y en `herramientas/resolver.py`.
//
// Este archivo es la mitad de un par. La otra mitad está en resolver.py, en el
// bloque con este mismo título, y las dos tienen que dar exactamente los mismos
// números: si el navegador generase otros tableros, el resolvedor estaría
// demostrando que tienen solución única unos tableros que nadie juega.
//
// Que sean los mismos no se supone: lo comprueba
// `python herramientas/comparar_generadores.py`, que genera todos los tableros
// por los dos lados y compara pieza a pieza. Es la comprobación por la que el
// contrato de datos se podía romper en silencio.
//
// mulberry32 y FNV-1a están aquí, y no una biblioteca, precisamente por eso:
// caben en cuatro líneas en los dos idiomas y no le piden nada a la biblioteca
// estándar de ninguno, así que no hay dos implementaciones que puedan
// divergir en una actualización.

/**
 * FNV-1a de 32 bits sobre los bytes UTF-8 del texto. Es lo que convierte
 * «n1-hs|aula|7» en la semilla de un tablero.
 */
export function fnv1a(texto) {
  let h = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(texto)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32: devuelve una función que da números en [0, 1).
 *
 * Math.imul no es un adorno: el `*` de JavaScript pasa por coma flotante y
 * pierde los bits bajos en cuanto el producto supera 2^53, que es justo lo que
 * hace este generador. Con `*` los primeros valores coinciden con Python y
 * luego dejan de hacerlo, que es la peor forma de romperse.
 */
export function mulberry32(semilla) {
  let estado = semilla >>> 0;
  return function siguiente() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates hacia atrás, gastando un número del generador por posición.
 * Cuántos gasta importa tanto como el resultado: el generador sigue tirando de
 * la misma secuencia después de barajar, así que una llamada de más aquí
 * descoloca todo lo que venga detrás.
 */
export function barajar(lista, rng) {
  const l = [...lista];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/**
 * Orden por punto de código, que es el de `sorted()` en Python.
 *
 * El de serie de JavaScript también lo es, pero `localeCompare` no: en español
 * ordenaría distinto y el tablero saldría con las baldas cambiadas de sitio
 * solo en el navegador. Se escribe explícito para que nadie lo «arregle».
 */
export function comparar(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Como `sorted()`: devuelve una lista nueva, sin tocar la de entrada. */
export function ordenados(iterable) {
  return [...iterable].sort(comparar);
}
