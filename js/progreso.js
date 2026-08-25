// Qué recuerda el juego de quien lo juega.
//
// El eje es **el par instrumento/sistema**, y no el instrumento a secas.
// `docs/fases.md` lo dejó apuntado como «probablemente» y esto lo cierra, con
// el motivo: la gracia del tema es que la misma pieza es fácil por un sistema y
// difícil por otro —el piano lo coloca cualquiera por uso y casi nadie por
// Hornbostel-Sachs—, así que un contador por pieza mezclaría las dos cosas en
// un número que no dice nada. Es también por lo que el esquema del proyecto
// hermano no servía: allí el par era intervalo/dirección.
//
// Lo que se guarda, y nada más:
//
//     {
//       "version": 1,
//       "piezas":   { "piano|hs":   { "bien": 3, "mal": 2 } },
//       "tableros": { "n1-hs|aula": { "comprobados": 4, "resueltos": 1 } }
//     }
//
// Y las reglas que lo hacen fiable, que son la parte que no se ve:
//
//   - **Una pieza cuenta una sola vez por tablero**, la primera vez que se la
//     juzga. Sin eso, quien pulsa Comprobar cinco veces mientras prueba se
//     apunta cinco fallos de la misma pieza, y el contador deja de medir lo que
//     sabe para medir cómo juega. El cuaderno de lo ya anotado lo lleva la
//     pantalla, porque muere con el tablero.
//   - **Se juzga por eje.** En un tablero de dos, una pieza puede estar en la
//     fila que le toca y en la columna que no: eso es un acierto de H-S y un
//     fallo de uso, y es exactamente la fricción que el juego enseña. Anotarlo
//     junto sería tirar la única medida interesante que hay aquí.
//   - **Y en un tablero de recambio, cada vuelta anota por su sistema.** Es lo
//     mismo dicho en el tiempo en vez de en el espacio: el nivel 5 es el que
//     mejor llena este esquema, porque de cada pieza deja las dos medidas que
//     el par pieza/sistema existe para separar. Lo que no se apunta dos veces
//     es el intento: el tablero es el mismo, y solo cuenta como resuelto
//     cuando se ha ordenado también después de dar la vuelta a los rótulos.
//   - **Lo que se queda en el montón no cuenta.** No se puede fallar una pieza
//     que no se ha colocado, y contarla como fallo castigaría a quien duda.
//   - **Los ids viajan aquí**, y por eso `docs/contrato_datos.md` dice que un
//     `id` no se cambia nunca. Un id que ya no esté en el catálogo se ignora al
//     leer, en vez de romper una pantalla.
//
// Y lo que **no** se guarda: el tablero. Se genera desde plantilla, armario y
// semilla, así que guardarlo sería almacenar lo derivable, que es la regla que
// ordena todo `web/datos/`. Por lo mismo no hay totales: se suman al leer.

export const VERSION = 1;
const CLAVE = 'progreso';

const vacio = () => ({ version: VERSION, piezas: {}, tableros: {} });

/**
 * Lo que se lleva anotado de este tablero. Uno por partida, y lo tira la
 * pantalla al salir: es lo que impide que la misma pieza cuente dos veces sin
 * tener que guardar en el navegador por dónde iba cada uno.
 */
export class Cuaderno {
  piezas = new Set();
  comprobado = false;
  resuelto = false;

  /**
   * Los rótulos se han dado la vuelta: las mismas piezas vuelven a contar.
   *
   * No es una excepción a «una pieza cuenta una vez por tablero». Lo que cuenta
   * una vez es el **par pieza/sistema**, y después del recambio el sistema es
   * otro: colocar el piano por Hornbostel-Sachs y colocarlo por uso son dos
   * cosas distintas, y son justamente las dos que este juego mide por separado.
   * Lo que no se reinicia es el intento, porque el tablero sigue siendo el
   * mismo.
   */
  voltear() {
    this.piezas = new Set();
  }
}

export class Progreso {
  #almacen;
  #datos;

  constructor(almacen) {
    this.#almacen = almacen;
    this.#datos = this.#cargar();
  }

  /** ¿Esto seguirá aquí mañana? Lo enseña la pantalla de ajustes. */
  get persiste() {
    return this.#almacen.persiste;
  }

  #cargar() {
    const guardado = this.#almacen.leer(CLAVE, null);
    // Una versión que no es la de hoy se descarta entera. Hoy solo hay una y el
    // progreso de un juego no vale una migración; el día que la valga, el sitio
    // donde se escribe es este.
    if (!guardado || guardado.version !== VERSION) return vacio();
    return {
      version: VERSION,
      piezas: guardado.piezas ?? {},
      tableros: guardado.tableros ?? {},
    };
  }

  // ------------------------------------------------------------------
  // Anotar
  // ------------------------------------------------------------------

  /**
   * Una comprobación entera: las piezas colocadas, el intento y, si toca, que
   * ha salido. La pantalla llama a esto y a nada más.
   */
  anotar(tablero, huecos, correccion, cuaderno) {
    let cambia = false;

    tablero.casillas.forEach((_casilla, i) => {
      for (const pieza of huecos[i]) {
        if (!pieza || cuaderno.piezas.has(pieza.id)) continue;
        cuaderno.piezas.add(pieza.id);
        tablero.sistemas.forEach((sistema, eje) => {
          const acierta = tablero.aciertaEn(pieza, i, eje);
          this.#sumar('piezas', `${pieza.id}|${sistema}`, acierta ? 'bien' : 'mal');
        });
        cambia = true;
      }
    });

    const cual = `${tablero.plantilla.id}|${tablero.armario.id}`;
    if (!cuaderno.comprobado) {
      cuaderno.comprobado = true;
      this.#sumar('tableros', cual, 'comprobados');
      cambia = true;
    }
    // `final` y no `resuelto`: un tablero de recambio ordenado por el primer
    // sistema está a la mitad, y apuntarlo como resuelto diría que alguien sabe
    // las dos clasificaciones cuando solo ha demostrado una.
    if (correccion.final && !cuaderno.resuelto) {
      cuaderno.resuelto = true;
      this.#sumar('tableros', cual, 'resueltos');
      cambia = true;
    }

    if (cambia) this.#almacen.escribir(CLAVE, this.#datos);
    return cambia;
  }

  #sumar(donde, clave, campo) {
    const fila = (this.#datos[donde][clave] ??= {});
    fila[campo] = (fila[campo] ?? 0) + 1;
  }

  // ------------------------------------------------------------------
  // Consultar
  // ------------------------------------------------------------------

  /** Cómo se le da esta pieza por este sistema. */
  pieza(id, sistema) {
    const fila = this.#datos.piezas[`${id}|${sistema}`] ?? {};
    return { bien: fila.bien ?? 0, mal: fila.mal ?? 0 };
  }

  /** Cuántas veces se ha intentado y resuelto esta pareja de plantilla y armario. */
  tablero(plantillaId, armarioId) {
    const fila = this.#datos.tableros[`${plantillaId}|${armarioId}`] ?? {};
    return { comprobados: fila.comprobados ?? 0, resueltos: fila.resueltos ?? 0 };
  }

  /** ¿Hay algo anotado? Es lo que decide si el menú enseña una línea o ninguna. */
  get vacio() {
    return Object.keys(this.#datos.piezas).length === 0 &&
      Object.keys(this.#datos.tableros).length === 0;
  }

  /**
   * Las piezas que colocas bien por un sistema y mal por otro.
   *
   * Esto es lo que el par pieza/sistema existe para poder decir, y hasta la
   * Fase 5 el esquema lo guardaba sin que nadie lo leyera. «El piano lo colocas
   * por uso y no por Hornbostel-Sachs» es la frase que este juego entero
   * persigue: no es que la pieza sea difícil, es que **los dos sistemas no la
   * ponen en el mismo sitio**, que es literalmente el Tema 7.
   *
   * Una contradicción pide las dos mitades y las pide limpias: un sistema donde
   * la pieza no se ha fallado nunca y otro donde se falla. Con «más aciertos que
   * fallos» saldrían piezas que simplemente se van aprendiendo, y eso ya lo
   * cuenta `resistentes()`.
   *
   * No sale a la pantalla ni una clasificación: decir que el piano se resiste
   * por Hornbostel-Sachs no dice dónde va el piano. Es un dato de quien juega y
   * no del catálogo, que es lo que lo hace enseñable.
   */
  contradicciones(instrumentos, cuantas = 5) {
    const porPieza = new Map();
    for (const [clave, fila] of Object.entries(this.#datos.piezas)) {
      const corte = clave.lastIndexOf('|');
      const id = clave.slice(0, corte);
      if (!porPieza.has(id)) porPieza.set(id, []);
      porPieza.get(id).push({ sistema: clave.slice(corte + 1), ...fila });
    }

    const salida = [];
    for (const [id, sistemas] of porPieza) {
      const instrumento = instrumentos.find((i) => i.id === id);
      if (!instrumento) continue;
      // El desempate es por id y no por orden de llegada, para que dos
      // pantallas con los mismos datos digan lo mismo.
      const orden = [...sistemas].sort((a, b) => (a.sistema < b.sistema ? -1 : 1));
      const bien = orden.find((s) => (s.bien ?? 0) > 0 && !(s.mal ?? 0));
      const mal = orden
        .filter((s) => (s.mal ?? 0) > 0)
        .sort((a, b) => (b.mal ?? 0) - (a.mal ?? 0))[0];
      if (bien && mal) salida.push({ instrumento, bien: bien.sistema, mal: mal.sistema, fallos: mal.mal });
    }

    return salida
      .sort((a, b) => b.fallos - a.fallos || (a.instrumento.id < b.instrumento.id ? -1 : 1))
      .slice(0, cuantas);
  }

  /**
   * Las que más se resisten, de más a menos. Suma los fallos de todos los
   * sistemas porque quien lee esto quiere saber a qué pieza volver, no por qué
   * eje; el desglose por eje es lo que lee `contradicciones()`.
   *
   * Devuelve instrumentos del catálogo, así que un id que ya no exista se cae
   * solo por el camino. El orden se desempata por id para que dos pantallas con
   * los mismos datos digan lo mismo.
   */
  resistentes(instrumentos, cuantas = 3) {
    const fallos = new Map();
    for (const [clave, fila] of Object.entries(this.#datos.piezas)) {
      if (!fila.mal) continue;
      const id = clave.slice(0, clave.lastIndexOf('|'));
      fallos.set(id, (fallos.get(id) ?? 0) + fila.mal);
    }
    return [...fallos.entries()]
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([id]) => instrumentos.find((i) => i.id === id))
      .filter(Boolean)
      .slice(0, cuantas);
  }

  // ------------------------------------------------------------------

  /** Borrarlo. Sin rastro y sin volver a preguntar: eso lo hace la pantalla. */
  borrar() {
    this.#datos = vacio();
    this.#almacen.borrar(CLAVE);
  }
}
