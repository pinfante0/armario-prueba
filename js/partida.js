// El estado de un tablero que se está jugando, y las reglas de moverlo.
//
// Está aparte de la pantalla a propósito. Aquí no hay ni un nodo del documento:
// esto sabe qué pieza está en qué hueco y qué pasa cuando se toca algo, y se
// puede razonar —y romper— sin abrir un navegador. La pantalla solo dibuja lo
// que esto diga.
//
// La interacción es «tocar la pieza y tocar el hueco», y no arrastrar. El
// motivo está en docs/fases.md y es doble: arrastrar en web táctil pelea con el
// desplazamiento del dedo, y no hay forma de arrastrar con el teclado ni con un
// lector de pantalla. Tocar y tocar es un botón y otro botón.

/** Una pieza colocada, o un hueco vacío. */
const VACIO = null;

export class Partida {
  constructor(tablero) {
    this.tablero = tablero;
    // Un array por casilla, con tantas posiciones como huecos tenga
    this.huecos = tablero.casillas.map((c) => Array(c.capacidad).fill(VACIO));
    this.monton = [...tablero.piezas];
    this.seleccion = null;
    // Lo del recambio, y solo después de darle la vuelta a los rótulos
    this.volteado = false;
    this.mover = 0;         // cuántas tenían que moverse, que es la nota
    this.movidas = null;    // cuáles ha movido quien juega
    this.origen = null;     // en qué balda estaba cada pieza al empezar a contar

    // El nivel 7 empieza con el armario lleno y mal: lo dejó ordenado alguien
    // que no sabía. Es el mismo sitio al que llega el recambio después de
    // voltear —baldas llenas, montón vacío—, así que se entra por la misma
    // puerta y se cuenta con la misma cuenta.
    if (tablero.inicial) {
      tablero.inicial.forEach((balda, i) => {
        balda.forEach((pieza, hueco) => {
          this.huecos[i][hueco] = pieza;
        });
      });
      this.monton = [];
      this.#sinMonton(tablero.mover);
    }
  }

  /**
   * A partir de aquí no hay montón, y de eso salen las dos cosas que hacen que
   * la nota mida algo: **cada movimiento es un intercambio** —las baldas están
   * llenas y siguen llenas— y **se puede contar cuánto se revuelve**, porque
   * hay un sitio de partida para cada pieza.
   *
   * Pasa en dos niveles distintos y por el mismo motivo, así que se entra por
   * aquí desde los dos: el 5 al dar la vuelta a los rótulos y el 7 desde el
   * primer momento.
   */
  #sinMonton(mover) {
    this.mover = mover;
    this.origen = new Map();
    this.huecos.forEach((balda, i) => {
      for (const pieza of balda) if (pieza) this.origen.set(pieza.id, i);
    });
    this.movidas = new Set();
    this.seleccion = null;
  }

  get piezasColocadas() {
    return this.huecos.flat().filter(Boolean).length;
  }

  get total() {
    return this.tablero.piezas.length;
  }

  /** ¿Está seleccionada esta pieza? */
  elegida(pieza) {
    return this.seleccion?.pieza === pieza;
  }

  // ------------------------------------------------------------------
  // Los tres gestos que existen
  // ------------------------------------------------------------------

  /**
   * Tocar una pieza del montón: la elige, o la suelta si ya estaba elegida.
   *
   * Si lo que había elegido estaba en el armario, se queda donde está. Mover
   * una pieza porque se ha tocado otra sería una sorpresa, y en un tablero las
   * sorpresas se pagan teniendo que deshacerlas.
   */
  tocarEnMonton(pieza) {
    this.seleccion = this.elegida(pieza) ? null : { donde: 'monton', pieza };
  }

  /**
   * Tocar un hueco del armario. Es donde está toda la mecánica:
   *
   *   - con algo elegido y el hueco libre, la pieza se muda;
   *   - con algo elegido y el hueco ocupado, las dos se cambian el sitio;
   *   - sin nada elegido y con una pieza dentro, esa pieza queda elegida;
   *   - tocar otra vez la pieza que ya estaba elegida la devuelve al montón.
   */
  tocarHueco(casilla, hueco) {
    const dentro = this.huecos[casilla][hueco];
    const elegida = this.seleccion;

    if (!elegida) {
      if (dentro) this.seleccion = { donde: 'tablero', casilla, hueco, pieza: dentro };
      return;
    }

    if (elegida.donde === 'tablero' && elegida.casilla === casilla && elegida.hueco === hueco) {
      this.devolverAlMonton();
      return;
    }

    this.#sacar(elegida);
    this.huecos[casilla][hueco] = elegida.pieza;
    // Lo que hubiera dentro se va justo a donde estaba lo que entra, que es lo
    // que hace que intercambiar dos piezas mal puestas sea un gesto y no tres.
    if (dentro) this.#meter(dentro, elegida);
    this.seleccion = null;
    this.#apuntarMovidas();
  }

  /** Tocar el montón con algo elegido del armario: la pieza vuelve. */
  devolverAlMonton() {
    const elegida = this.seleccion;
    if (!elegida) return;
    if (elegida.donde === 'tablero') {
      this.huecos[elegida.casilla][elegida.hueco] = VACIO;
      this.monton.push(elegida.pieza);
    }
    this.seleccion = null;
    this.#apuntarMovidas();
  }

  #sacar(sitio) {
    if (sitio.donde === 'monton') {
      const i = this.monton.indexOf(sitio.pieza);
      if (i >= 0) this.monton.splice(i, 1);
    } else {
      this.huecos[sitio.casilla][sitio.hueco] = VACIO;
    }
  }

  #meter(pieza, sitio) {
    if (sitio.donde === 'monton') this.monton.push(pieza);
    else this.huecos[sitio.casilla][sitio.hueco] = pieza;
  }

  // ------------------------------------------------------------------
  // Dar la vuelta a los rótulos
  // ------------------------------------------------------------------

  /** ¿Le queda a este tablero una segunda vuelta? */
  get sePuedeVoltear() {
    return this.tablero.recambio !== null && this.tablero.recambio !== undefined;
  }

  /**
   * Las etiquetas de las baldas se dan la vuelta, y ya está.
   *
   * Nada se mueve de sitio, y eso no es una comodidad: **cuáles hay que mover
   * es justo la pregunta**. Un juego que sacara solas las piezas que ya no
   * encajan estaría respondiéndola antes de hacerla.
   *
   * Las baldas no cambian de tamaño —eso lo garantiza el generador—, así que en
   * la segunda vuelta no hay montón y cada movimiento es un intercambio. De ahí
   * sale que «cuántas piezas has movido» mida algo: quien sabe cuáles son las
   * que chirrían toca solo esas, y quien no, revuelve de más.
   */
  voltear() {
    if (!this.sePuedeVoltear) return false;
    this.#sinMonton(this.tablero.mover);
    this.tablero = this.tablero.recambio;
    this.volteado = true;
    return true;
  }

  /**
   * Apunta lo que se ha movido de su balda de partida, aunque después vuelva.
   *
   * Se mira después de cada gesto y no al final a propósito. Al final la
   * respuesta es única —el tablero tiene una sola solución—, así que todo el
   * mundo acabaría habiendo movido exactamente las que había que mover y el
   * número no diría nada de nadie. Lo que distingue a quien lo ve de quien lo
   * prueba es cuánto revuelve por el camino.
   */
  #apuntarMovidas() {
    if (!this.movidas) return;
    for (const pieza of this.monton) this.movidas.add(pieza.id);
    this.huecos.forEach((balda, i) => {
      for (const pieza of balda) {
        if (pieza && this.origen.get(pieza.id) !== i) this.movidas.add(pieza.id);
      }
    });
  }

  // ------------------------------------------------------------------
  // El candado
  // ------------------------------------------------------------------

  /**
   * El código del candado: cuántas piezas hay en cada balda, de arriba abajo.
   *
   * Es lo que queda del escape room que se descartó en `docs/juego.md`, y queda
   * solo lo bueno: **el momento de que se abra el armario, sin el género
   * entero**. No es un puzle más ni retrasa a nadie —quien ha ordenado bien
   * puede leer estos números contando— y eso es exactamente lo que tiene que
   * ser: un premio y no una cerradura de verdad.
   *
   * Lo calcula el juego a partir del tablero, así que no hay nada escrito a
   * mano y sigue habiendo uno distinto por cada semilla. Con dos ejes son las
   * filas, que es como se lee un armario: por baldas.
   */
  get cerradura() {
    const t = this.tablero;
    if (t.sistemas.length === 1) return t.casillas.map((c) => c.capacidad);
    const [filas] = t.valores;
    return filas.map((f) =>
      t.casillas.filter((c) => c.claves[0] === f).reduce((n, c) => n + c.capacidad, 0),
    );
  }

  // ------------------------------------------------------------------
  // Corregir
  // ------------------------------------------------------------------

  /**
   * Qué está mal. Devuelve lo que la pantalla necesita para marcarlo, y nada
   * que diga a dónde iba una pieza: eso es la respuesta.
   *
   * Con rótulos hay una respuesta por pieza, así que se marcan las piezas. Sin
   * rótulos no la hay —una balda no dice de qué es— y lo que se marca es la
   * balda que lleva dentro cosas de dos grupos distintos, que es el único error
   * que se puede señalar sin destripar el puzle.
   *
   * `resuelto` es esta vuelta y `final` es el tablero entero. Se separan porque
   * un tablero de recambio ordenado por el primer sistema no está terminado:
   * está a la mitad, y contarlo como resuelto en el progreso diría que alguien
   * sabe las dos clasificaciones cuando solo ha demostrado una.
   */
  corregir() {
    const t = this.tablero;
    const colocadas = this.piezasColocadas;
    const completo = colocadas === this.total;
    const piezasMal = new Set();
    const baldasMal = new Set();

    t.casillas.forEach((casilla, i) => {
      const dentro = this.huecos[i].filter(Boolean);
      if (t.rotulos === 'visibles') {
        // A qué balda va una pieza lo dice el tablero y no la pieza, porque en
        // un tablero de subniveles hay dos que le encajan y manda la más
        // concreta. Comparar aquí las claves a mano sería una segunda
        // definición de «dónde va esto», y las dos acabarían discrepando.
        for (const pieza of dentro) {
          if (t.indiceDe(pieza) !== i) piezasMal.add(pieza.id);
        }
      } else {
        const grupos = new Set(dentro.map((p) => t.celdaDe(p).join(' ')));
        if (grupos.size > 1) baldasMal.add(i);
      }
    });

    const resuelto = completo && piezasMal.size === 0 && baldasMal.size === 0;
    return {
      colocadas,
      total: this.total,
      completo,
      piezasMal,
      baldasMal,
      resuelto,
      final: resuelto && !this.sePuedeVoltear,
      volteado: this.volteado,
      // Este tablero se puntúa con un número, y no todos: hace falta que las
      // piezas hayan partido de algún sitio. Lo cumplen los dos niveles que
      // juegan sin montón, y por eso la nota es una sola y no dos.
      conNota: this.movidas !== null,
      mover: this.mover,
      movidas: this.movidas ? this.movidas.size : 0,
    };
  }
}
