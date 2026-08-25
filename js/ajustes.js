// Lo poco que se puede decidir, y dónde se guarda.
//
// Son tres ajustes y son tres a propósito. Un ajuste que no arregla un problema
// que le pasa a alguien es una pantalla más que mantener y una decisión más que
// tomar antes de jugar:
//
//   - **El tema**, porque el automático no siempre acierta. Un aula con el
//     proyector encendido pide el claro aunque el móvil venga en oscuro, y a
//     última hora de la tarde pasa justo lo contrario.
//   - **De quién es el armario**, que aquí no es decoración: decide los empates,
//     o sea si la guitarra es escolar o popular. Se guarda porque es la elección
//     que se repite en cada partida.
//   - **Avanzado**, desde la 6.6: la ficha enseña solo la fotografía y no el
//     nombre, con tres pistas persistentes por tablero para quien lo pida. Es
//     la familia de `rotulos: ocultos` del propio contrato de datos, y por eso
//     vive aquí y no es un modo nuevo: cambia *cuánto* se enseña de cada pieza,
//     no *cómo* se juega. El detalle está en `docs/juego.md`.
//
// Y dos que no están, porque quitarlos también es una decisión: **el tamaño de
// la letra**, que en este juego cuelga de `vh` para que el tablero se encoja con
// la pantalla, y subirlo a mano rompería la única regla que aquí se mide —que
// ninguna pantalla se desplace—; y **quitar las animaciones**, que ya lo dice el
// sistema con `prefers-reduced-motion` y no hay por qué preguntarlo dos veces.
//
// El tema se resuelve aquí y se escribe en `data-tema` del <html> **también
// cuando es automático**. Así la paleta oscura está escrita una sola vez en la
// hoja de estilo en lugar de dos —la de la media query y la de la elección a
// mano—, que es la duplicación por la que un color acaba cambiado en un sitio y
// no en el otro. El precio es que sin JavaScript no hay tema oscuro, y este
// juego sin JavaScript no es nada.

export const TEMAS = ['auto', 'claro', 'oscuro'];

const CLAVE = 'ajustes';

// `armario` en null quiere decir «el primero de la lista». El id no se escribe
// aquí porque los armarios los pone `web/datos/armarios.json`, y un id de datos
// copiado dentro del código son dos sitios donde dice lo mismo.
const POR_DEFECTO = { tema: 'auto', armario: null, avanzado: false };

const OSCURO = '(prefers-color-scheme: dark)';

export class Ajustes {
  #almacen;
  #valores;
  #medio;
  #raiz;

  /**
   * `raiz` y `medio` se pueden pasar para poder comprobar esto sin tocar la
   * página de verdad ni el tema real de quien está mirando.
   */
  constructor(almacen, { raiz = document.documentElement, medio = null } = {}) {
    this.#almacen = almacen;
    this.#raiz = raiz;
    this.#medio = medio ?? globalThis.matchMedia?.(OSCURO) ?? { matches: false };

    const guardado = this.#almacen.leer(CLAVE, null);
    this.#valores = { ...POR_DEFECTO, ...(guardado && typeof guardado === 'object' ? guardado : {}) };
    if (!TEMAS.includes(this.#valores.tema)) this.#valores.tema = POR_DEFECTO.tema;
    this.#valores.avanzado = Boolean(this.#valores.avanzado);

    // Con el tema automático, cambiar el del sistema tiene que cambiar el del
    // juego sin recargar: en un móvil eso pasa solo al anochecer.
    this.#medio.addEventListener?.('change', () => this.aplicar());
    this.aplicar();
  }

  get tema() {
    return this.#valores.tema;
  }

  set tema(cual) {
    if (!TEMAS.includes(cual)) throw new Error(`no hay ningún tema '${cual}'`);
    this.#valores.tema = cual;
    this.#guardar();
    this.aplicar();
  }

  /** El id del armario elegido, o null mientras nadie haya elegido. */
  get armario() {
    return this.#valores.armario;
  }

  set armario(id) {
    this.#valores.armario = id;
    this.#guardar();
  }

  /**
   * El ajuste avanzado de la 6.6: la ficha enseña solo la fotografía y no el
   * nombre, con tres pistas persistentes por tablero. No aplica al voltear
   * ni durante una partida ya empezada —cambiar de ajuste pide volver a
   * abrir un tablero—, así que no hace falta que esta clase avise a nadie.
   */
  get avanzado() {
    return this.#valores.avanzado;
  }

  set avanzado(cual) {
    this.#valores.avanzado = Boolean(cual);
    this.#guardar();
  }

  /** Escribe en el <html> el tema que toca, ya resuelto. */
  aplicar() {
    const cual = this.#valores.tema;
    this.#raiz.dataset.tema = cual === 'auto' ? (this.#medio.matches ? 'oscuro' : 'claro') : cual;
  }

  #guardar() {
    this.#almacen.escribir(CLAVE, this.#valores);
  }
}

/**
 * El armario que toca abrir: el guardado si sigue existiendo, y si no el
 * primero. Que un ajuste viejo apunte a un armario que ya no está no puede
 * dejar el menú sin armario.
 */
export function armarioElegido(ajustes, armarios) {
  const lista = Object.values(armarios);
  return armarios[ajustes.armario] ?? lista[0];
}
