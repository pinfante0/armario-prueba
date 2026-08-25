// La pantalla de un tablero: el armario, el montón y la barra de abajo.
//
// Lo que decide qué se puede mover está en `partida.js`; aquí solo se dibuja lo
// que aquello diga y se le pasan los toques. La separación no es ceremonia: la
// regla «tocar la pieza y tocar el hueco» es lo que docs/fases.md marca como no
// delegable, y conviene poder leerla sin CSS delante.
//
// Y una regla del contrato que a partir de aquí ya se puede romper: de
// `web/datos/` solo sale a la pantalla el campo `nombre`. Ni la clasificación
// de una pieza, ni su diapositiva, ni el `porque`, ni el `revisar`, que es una
// duda del profesor escrita en primera persona. Tampoco en un atributo: una
// ficha con su grupo en un `data-` es la respuesta escrita en el propio tablero
// para cualquiera que abra las herramientas del navegador. Lo comprueba
// `python herramientas/medir_pantalla.py`, y la comprobación existe porque el
// proyecto hermano pagó este error cuatro veces.
//
// El ajuste avanzado, desde la 6.6: si `ajustes.avanzado` es verdadero, la
// ficha enseña la fotografía y no el nombre —salvo que la plantilla lleve
// `nombres_forzados`, que es del nivel 3 y de ningún otro— y cada tablero
// da tres pistas persistentes: pedir una revela el nombre de la pieza elegida
// para lo que quede de partida y no penaliza. El nombre sigue viajando
// **siempre** en el `aria-label` de cada ficha, esté oculto o no en pantalla:
// un lector de pantalla no ve dibujos ni fotografías, así que quitárselo no
// haría el juego más difícil, lo haría imposible; y dárselo no regala nada,
// porque a reconocer una silueta no se puede jugar sin verla. El detalle
// completo está en `docs/juego.md` y en el apartado de la Fase 6b de
// `docs/fases.md`.

import { el, vaciar } from './nucleo/dom.js';
import { disponiblesPara } from './datos.js';
import { ARBOL, generar } from './generador.js';
import { Partida } from './partida.js';
import { Cuaderno } from './progreso.js';
import { enumerar, segun } from './texto.js';
import { crearVisor } from './visor.js';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * El dibujo de la lupa, en el estilo de trazo del juego y con `currentColor`
 * para que se lea igual en los dos temas. No es un instrumento, así que no vive
 * en el sprite: es un control.
 */
function iconoLupa() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const lente = document.createElementNS(SVG, 'circle');
  lente.setAttribute('cx', '10');
  lente.setAttribute('cy', '10');
  lente.setAttribute('r', '6');
  const asa = document.createElementNS(SVG, 'line');
  asa.setAttribute('x1', '14.5');
  asa.setAttribute('y1', '14.5');
  asa.setAttribute('x2', '20');
  asa.setAttribute('y2', '20');
  for (const parte of [lente, asa]) {
    parte.setAttribute('fill', 'none');
    parte.setAttribute('stroke', 'currentColor');
    parte.setAttribute('stroke-width', '2');
    parte.setAttribute('stroke-linecap', 'round');
  }
  svg.append(lente, asa);
  return svg;
}

/**
 * El dibujo de la pista, desde la 6.6: un círculo con una «i» de información,
 * en el mismo estilo de trazo que la lupa. Tampoco es un instrumento, así que
 * tampoco vive en el sprite.
 */
function iconoPista() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const circulo = document.createElementNS(SVG, 'circle');
  circulo.setAttribute('cx', '12');
  circulo.setAttribute('cy', '12');
  circulo.setAttribute('r', '9');
  circulo.setAttribute('fill', 'none');
  circulo.setAttribute('stroke', 'currentColor');
  circulo.setAttribute('stroke-width', '2');
  const palo = document.createElementNS(SVG, 'line');
  palo.setAttribute('x1', '12');
  palo.setAttribute('y1', '11');
  palo.setAttribute('x2', '12');
  palo.setAttribute('y2', '16.5');
  palo.setAttribute('stroke', 'currentColor');
  palo.setAttribute('stroke-width', '2');
  palo.setAttribute('stroke-linecap', 'round');
  const punto = document.createElementNS(SVG, 'circle');
  punto.setAttribute('cx', '12');
  punto.setAttribute('cy', '7.3');
  punto.setAttribute('r', '1.15');
  punto.setAttribute('fill', 'currentColor');
  svg.append(circulo, palo, punto);
  return svg;
}

// Los rótulos de las baldas. Esto no es cocina que se escapa: es la mecánica.
// El tablero enseña el nombre del grupo, que es la pregunta; lo que no puede
// enseñar es a qué grupo pertenece cada pieza, que es la respuesta.
const ROTULOS = {
  hs: {
    idiofono: 'Idiófonos',
    membranofono: 'Membranófonos',
    cordofono: 'Cordófonos',
    aerofono: 'Aerófonos',
    electrofono: 'Electrófonos',
  },
  uso: {
    sinfonico: 'Sinfónicos',
    popular: 'Populares',
    escolar: 'Escolares',
  },
  familia: {
    cuerda: 'Cuerda',
    'viento-madera': 'Viento madera',
    'viento-metal': 'Viento metal',
    percusion: 'Percusión',
  },
};

/**
 * Cómo se llama cada balda de este tablero.
 *
 * Los tres sistemas cerrados caben en la tabla de arriba, que son doce nombres
 * que no cambian. Los del árbol no: cuáles hay es una decisión de contenido
 * —qué subniveles sabe nombrar el juego— y vive en `tableros.json`, porque el
 * generador tiene que leer la misma lista para saber qué baldas puede sacar.
 * Aquí de esa lista sale solo el `nombre`, que es el rótulo; el código no, que
 * es de dónde sale la respuesta.
 */
function rotulosDe(plantilla) {
  const arbol = new Map((plantilla.subniveles ?? []).map((b) => [b.codigo, b.nombre]));
  return (sistema, clave) =>
    (sistema === ARBOL ? arbol.get(clave) : ROTULOS[sistema]?.[clave]) ?? clave;
}

/**
 * Una pantalla de tablero, lista para colgar del documento.
 *
 * `semilla` no vale cualquiera: solo las que ha enumerado `resolver.py` están
 * demostradas, y una que no lo esté puede ser un puzle sin solución o con dos.
 * Por eso se comprueba aquí y no se recorta en silencio.
 *
 * `progreso` puede no venir, y las páginas de `web/pruebas/` pintan tableros
 * sin él: lo que miden es la pantalla y no lo que se lleva jugado, y anotar
 * setecientos veinte tableros medidos como si alguien los hubiera jugado sería
 * escribir en el navegador de quien está comprobando.
 *
 * `recursos` tampoco: es lo que devuelve `cargarRecursos()` y llega por
 * argumento y no por su cuenta, para que se pueda pintar el mismo tablero con
 * recursos y sin ellos. Eso no es comodidad, es la Fase 6 entera:
 * `medir_iconos.py` explora cuánto dibujo cabe pintando sin ninguno e
 * inyectando uno de mentira, y `comprobar_pantalla.py` mide los de verdad. Sin
 * este argumento las dos cosas medirían lo mismo.
 *
 * Y desde la 6.4 se llama `recursos` y no `iconos` porque puede devolver un
 * `<svg>` o un `<img>`: **quién gana cuando una pieza tiene las dos cosas se
 * decide en `recursos.js`**, que es donde está escrito el porqué. Aquí no se
 * mira de qué materia es lo que llega, y eso es lo que hace que la convivencia
 * se pueda cambiar tocando un archivo.
 *
 * `foto` es lo otro que devuelve `cargarRecursos()`, y desde la 6.5 es lo que
 * necesita «Ver de cerca»: saber si una pieza tiene fotografía —para ofrecer la
 * lupa— y de dónde cargar su detalle. Va aparte de `recursos` porque `recursos`
 * ya es la política de convivencia resuelta y no dice de qué materia es cada
 * cosa; el visor sí necesita distinguir la fotografía. Si no llega, no hay lupa.
 *
 * `ajustes` tampoco viene siempre: sin él, `ajustes?.avanzado` es `undefined`
 * y esta pantalla juega en principiante, que es lo que las páginas de
 * `web/pruebas/` necesitan medir por defecto. Con él, `ajustes.avanzado`
 * decide si la ficha esconde el nombre —salvo que la plantilla lleve
 * `nombres_forzados`— y si esta pantalla ofrece las tres pistas del tablero.
 *
 * `fichas` es lo que devuelve `cargarFichas()`, desde la 6.7: sin él no hay
 * «Ver ficha», igual que sin `foto` no hay lupa. El candado es que el tablero
 * esté `final` —resuelto y, en los niveles con recambio, también por la
 * segunda vuelta—, y por eso «Ver ficha» no vive en la lupa de la cabecera
 * sino en la pantalla del resultado, en `pintarResultado()`: solo se pinta
 * cuando `correccion.final` ya es verdadero, y sus botones abren el visor por
 * `visor.abrirFicha()` sin pasar por seleccionar nada de `Partida`. El
 * porqué —seleccionar borraría el propio candado— está en `visor.js`.
 */
export function pantallaTablero({
  plantilla,
  armario,
  semilla,
  instrumentos,
  progreso = null,
  recursos = null,
  foto = null,
  fichas = null,
  ajustes = null,
  ir,
  atras,
}) {
  if (!Number.isInteger(semilla) || semilla < 0 || semilla >= plantilla.semillas) {
    throw new Error(
      `la semilla ${semilla} de '${plantilla.id}' no la ha demostrado nadie: ` +
        `resolver.py enumera de 0 a ${plantilla.semillas - 1}`,
    );
  }

  const rotulo = rotulosDe(plantilla);
  const partida = new Partida(
    generar(plantilla, armario, disponiblesPara(plantilla, instrumentos), semilla),
  );
  // `let` y no `const`: al dar la vuelta a los rótulos, la partida pasa a jugar
  // otro tablero —las mismas piezas y las mismas baldas, otros nombres— y esta
  // pantalla dibuja el de ahora. Se reasigna en un solo sitio, que es `voltear`.
  let tablero = partida.tablero;
  // Lo que ya se ha anotado de este tablero. Muere con la pantalla, que es
  // justo lo que hace que una pieza cuente una vez y no una por cada toque en
  // Comprobar. El porqué está en progreso.js.
  const cuaderno = new Cuaderno();
  let correccion = null;
  let ultimoFoco = null;

  // El ajuste avanzado y su excepción, leídos una vez: no hay forma de
  // cambiarlos sin abandonar esta pantalla, así que no hace falta releerlos en
  // cada repintado. `nombresForzados` es del nivel 3 y de ningún otro: sus
  // baldas van sin rótulo y se resuelven contando piezas por grupo, así que
  // sin nombre el nivel no se pone difícil, se queda sin mecanismo.
  const avanzado = Boolean(ajustes?.avanzado);
  const nombresForzados = Boolean(plantilla.nombres_forzados);
  // Qué piezas ha revelado ya una pista, y cuántas quedan. Persistentes «por
  // tablero»: viven aquí y no en `progreso.js` ni en el ajuste, así que
  // sobreviven a dar la vuelta a los rótulos —la misma partida— y mueren con
  // la pantalla, igual que `falladas` y por lo mismo.
  const reveladas = new Set();
  let pistasRestantes = 3;

  /**
   * Si el nombre de esta pieza se enseña ahora mismo. En principiante y en el
   * nivel 3 siempre; en avanzado, solo tras pedir una de las tres pistas.
   */
  function nombreVisible(pieza) {
    return !avanzado || nombresForzados || reveladas.has(pieza.id);
  }

  const raiz = el('main.pantalla');
  const armazon = el('section.armario', { 'aria-label': 'El armario' });
  const monton = el('section.monton', {
    'aria-label': 'Piezas por colocar',
    // Tocar el hueco vacío del montón devuelve lo que estuviera elegido. Va en
    // el contenedor y no en un botón porque el sitio natural para soltar algo
    // es el sitio de donde salió, no un botón que diga «soltar».
    onclick: (evento) => {
      if (evento.target === monton) hacer(() => partida.devolverAlMonton());
    },
  });
  // Lo que se ha fallado en este armario, para poder decirlo al final. Muere
  // con la pantalla, igual que el cuaderno del progreso y por lo mismo: es de
  // esta partida y no de quien juega.
  const falladas = new Set();

  // El resultado ocupa el sitio del montón, que está vacío justo cuando el
  // armario está lleno. Así el armario resuelto se queda a la vista, que es lo
  // que hay que mirar: una pantalla aparte enseñaría el resultado tapando lo
  // único que lo explica.
  const resultado = el('section.resultado', { hidden: true });
  const aviso = el('p.aviso', { role: 'status' });
  const barra = el('footer.barra');

  // «Ver de cerca». El visor cuelga de la pantalla —no del `document.body`— para
  // que en la medición viva dentro del marco del teléfono y `100dvh` mida lo que
  // el marco. Solo se crea si hay fotografías: sin ellas no hay lupa que ofrecer,
  // que es lo que pasa en el archivo único hasta la 6.8.
  const visor = foto ? crearVisor({ foto, ficha: fichas, montarEn: raiz }) : null;

  // La lupa va en la cabecera, a la derecha, y **reserva su sitio siempre**: se
  // hace visible cuando hay una pieza seleccionada con fotografía y se esconde
  // con `visibility` el resto del tiempo, no con `hidden`. Así no refluye el
  // título al seleccionar —el hueco ya estaba contado en la medición «recién
  // abierto»— y no hace falta un cuarto estado que medir. Cuesta un poco de ancho
  // al título en todos los tableros, y eso sí lo mide la comprobación de siempre.
  const lupa = visor
    ? el(
        'button.lupa.oculta',
        {
          type: 'button',
          // El nombre lo pone `actualizarLupa`, porque cambia con la selección.
          'aria-label': 'Ver de cerca',
          onclick: () => {
            const pieza = partida.seleccion?.pieza;
            if (!pieza || !visor.hayPara(pieza.id)) return;
            // El foco vuelve a la ficha de la pieza, que sigue elegida: abrir la
            // lupa no ha tocado la selección. El nombre visible sigue el de la
            // ficha —oculto en avanzado hasta que se revele—, y el real viaja
            // siempre en el `aria-label` del diálogo, dentro de `visor.js`.
            // Esta puerta nunca ofrece «Ver ficha»: es la de seleccionar, y
            // seleccionar con el armario ya terminado borraría el propio
            // candado que la ficha necesita. Esa vive en el resultado.
            visor.abrir(pieza.id, pieza.nombre, nombreVisible(pieza), () =>
              raiz.querySelector(`[data-pieza="${pieza.id}"]`)?.focus({ preventScroll: true }),
            );
          },
        },
        iconoLupa(),
      )
    : null;

  /**
   * Enciende o apaga la lupa según la selección. Una pieza da lupa solo si tiene
   * fotografía: el dibujo es vectorial y no gana nada de cerca, y una pieza con
   * solo nombre no tiene qué ampliar.
   */
  function actualizarLupa() {
    if (!lupa) return;
    const pieza = partida.seleccion?.pieza;
    const hay = Boolean(pieza && visor.hayPara(pieza.id));
    lupa.classList.toggle('oculta', !hay);
    lupa.disabled = !hay;
    lupa.setAttribute('aria-label', hay ? `Ver de cerca: ${pieza.nombre}` : 'Ver de cerca');
  }

  // La pista, desde la 6.6: solo existe si el ajuste es avanzado y la
  // plantilla no fuerza los nombres —si no, no hay nada que pedirle—. Mismo
  // patrón que la lupa: reserva su sitio siempre y se enciende con
  // `visibility` según haya una pieza elegida con nombre por revelar y
  // pistas que queden. No pasa por `hacer()`: revelar un nombre no mueve
  // nada, no invalida una corrección y no penaliza, así que solo repinta.
  const pista =
    avanzado && !nombresForzados
      ? el(
          'button.pista.oculta',
          {
            type: 'button',
            // El texto lo pone `actualizarPista`, porque cambia con la selección
            // y con cuántas quedan.
            'aria-label': 'Pedir pista',
            onclick: () => {
              const pieza = partida.seleccion?.pieza;
              if (!pieza || pistasRestantes <= 0 || reveladas.has(pieza.id)) return;
              reveladas.add(pieza.id);
              pistasRestantes -= 1;
              pintar();
            },
          },
          iconoPista(),
        )
      : null;

  /**
   * Enciende o apaga la pista: solo si hay una pieza elegida cuyo nombre no se
   * ha revelado ya y todavía quedan pistas por usar. Que quede escondida en
   * vez de deshabilitada cuando no aplica es a propósito —una pieza cuyo
   * nombre ya está revelado no necesita un botón inactivo delante—.
   */
  function actualizarPista() {
    if (!pista) return;
    const pieza = partida.seleccion?.pieza;
    const disponible = Boolean(pieza) && pistasRestantes > 0 && !reveladas.has(pieza.id);
    pista.classList.toggle('oculta', !disponible);
    pista.disabled = !disponible;
    pista.setAttribute(
      'aria-label',
      disponible
        ? `Pedir pista: revela el nombre de la pieza elegida. Quedan ${pistasRestantes}.`
        : 'Pedir pista',
    );
  }

  function hacer(accion) {
    accion();
    // Cualquier movimiento invalida la corrección anterior: dejarla puesta
    // marcaría en rojo una pieza que el jugador acaba de arreglar.
    correccion = null;
    pintar();
  }

  // ------------------------------------------------------------------
  // Las piezas
  // ------------------------------------------------------------------

  /**
   * Una pieza, con su recurso si lo tiene: una fotografía, un dibujo o nada.
   *
   * Los recursos entran por tandas, así que aquí conviven las dos fichas: sin
   * recurso el nombre va suelto y lo recorta a dos líneas el `-webkit-box` de la
   * hoja, que es como estaba desde la Fase 2; con recurso la ficha pasa a ser
   * una columna y el recorte se lo queda el nombre, que es de quien era. Las dos
   * formas están medidas, y el que una pieza no tenga recurso no es un estado
   * transitorio: puede quedarse así.
   *
   * La ficha no distingue un `<svg>` de un `<img>` y no tiene por qué: los dos
   * ocupan la misma caja de `--ficha-recurso`, que es lo que hace que el tamaño
   * medido en la tanda 1 siga valiendo cuando cambia la materia.
   *
   * Desde la 6.6, el nombre visible depende de `nombreVisible()`: si está
   * oculto, el `<span>` ni se crea, no un texto vacío que igual ocuparía su
   * línea. Y solo se oculta si hay recurso que lo sustituya —una pieza sin
   * fotografía ni dibujo se queda con su nombre, que es lo único que tiene—,
   * aunque hoy las 58 jugables tengan fotografía y ese caso no se dé. El
   * `aria-label` lleva **siempre** el nombre real, esté visible o no: es lo
   * que un lector de pantalla necesita para jugar, y no depende del ajuste.
   */
  function ficha(pieza, { dentro, alTocar }) {
    const mal = correccion?.piezasMal.has(pieza.id);
    const recurso = recursos?.(pieza.id) ?? null;
    const mostrarNombre = nombreVisible(pieza) || !recurso;
    return el(
      'button.ficha',
      {
        type: 'button',
        clase: [
          dentro ? 'colocada' : '',
          partida.elegida(pieza) ? 'elegida' : '',
          mal ? 'mal' : '',
          recurso ? 'con-recurso' : '',
        ]
          .filter(Boolean)
          .join(' '),
        datos: { pieza: pieza.id },
        'aria-pressed': String(partida.elegida(pieza)),
        'aria-label': pieza.nombre,
        onclick: () => {
          ultimoFoco = `[data-pieza="${pieza.id}"]`;
          alTocar();
        },
      },
      recurso,
      mostrarNombre ? (recurso ? el('span.nombre', {}, pieza.nombre) : pieza.nombre) : null,
    );
  }

  function hueco(iCasilla, iHueco) {
    const dentro = partida.huecos[iCasilla][iHueco];
    const casilla = tablero.casillas[iCasilla];
    const donde =
      tablero.rotulos === 'visibles'
        ? casilla.claves.map((c, e) => rotulo(tablero.sistemas[e], c)).join(', ')
        : `balda ${iCasilla + 1}`;
    const cual = `${donde}, hueco ${iHueco + 1} de ${casilla.capacidad}`;

    if (dentro) {
      const boton = ficha(dentro, {
        dentro: true,
        alTocar: () => hacer(() => partida.tocarHueco(iCasilla, iHueco)),
      });
      boton.setAttribute('aria-label', `${dentro.nombre}, en ${cual}`);
      return boton;
    }

    return el('button.hueco', {
      type: 'button',
      datos: { casilla: String(iCasilla), hueco: String(iHueco) },
      'aria-label': partida.seleccion
        ? `Poner ${partida.seleccion.pieza.nombre} en ${cual}`
        : `Hueco libre: ${cual}`,
      onclick: () => {
        ultimoFoco = `[data-casilla="${iCasilla}"][data-hueco="${iHueco}"]`;
        hacer(() => partida.tocarHueco(iCasilla, iHueco));
      },
    });
  }

  const huecosDe = (i) =>
    el(
      'div.huecos',
      { clase: correccion?.baldasMal.has(i) ? 'mal' : null },
      Array.from({ length: tablero.casillas[i].capacidad }, (_, h) => hueco(i, h)),
    );

  // ------------------------------------------------------------------
  // El armario, que se dibuja de dos maneras
  // ------------------------------------------------------------------

  function baldasEnFila() {
    // Un eje: las baldas son filas. Sin rótulo, lo único que identifica una
    // balda es cuántos huecos tiene, así que en el sitio del rótulo va ese
    // número. No es un sustituto ni un «?»: es el rótulo que tiene ese nivel,
    // y por eso las capacidades salen todas distintas.
    return tablero.casillas.map((casilla, i) =>
      el(
        'div.balda',
        {},
        tablero.rotulos === 'visibles'
          ? el('h2.rotulo', {}, rotulo(tablero.sistemas[0], casilla.claves[0]))
          : el('h2.rotulo.sin-rotulo', {}, `${casilla.capacidad}`),
        huecosDe(i),
      ),
    );
  }

  function rejilla() {
    // Dos ejes: las filas son el primero y las columnas el segundo.
    const [filas, columnas] = tablero.valores;
    const nodos = [el('div.esquina', { 'aria-hidden': 'true' })];
    for (const c of columnas) {
      nodos.push(el('h2.rotulo.columna', {}, rotulo(tablero.sistemas[1], c)));
    }
    for (const f of filas) {
      nodos.push(el('h2.rotulo.fila', {}, rotulo(tablero.sistemas[0], f)));
      for (const c of columnas) {
        const i = tablero.casillas.findIndex((x) => x.claves[0] === f && x.claves[1] === c);
        nodos.push(el('div.celda', {}, huecosDe(i)));
      }
    }
    const nodo = el('div.rejilla', {}, nodos);
    nodo.style.setProperty('--columnas', String(columnas.length));
    return nodo;
  }

  // ------------------------------------------------------------------

  /**
   * La devolución de los dos niveles que se juegan sin montón, que es la única
   * nota de este juego.
   *
   * «Has movido nueve; solo siete tenían que moverse» enseña algo y un
   * porcentaje no. Y el número correcto no es una opinión: en el nivel 5 son
   * las piezas que los dos sistemas colocan en baldas distintas y en el 7 las
   * que alguien dejó donde no van. Lo calcula el generador —está en la huella,
   * así que Python y el navegador dicen el mismo—.
   *
   * El texto cambia porque la pregunta cambia: allí se pregunta qué se ha
   * movido de sitio al cambiar los rótulos, y aquí qué estaba mal desde el
   * principio. Decirlo igual en los dos sería ahorrarse una frase a cambio de
   * que ninguna de las dos explique lo suyo.
   */
  function nota() {
    const { mover, movidas } = correccion;
    if (!correccion.volteado) {
      if (movidas === mover) {
        return segun(
          mover,
          '¡Ordenado! Has tocado la única que estaba donde no iba.',
          '¡Ordenado! Has tocado justo las %d que estaban donde no iban.',
        );
      }
      return `¡Ordenado! Has movido ${segun(movidas, 'una pieza', '%d piezas')} y ` +
        `${segun(mover, 'solo una estaba', 'solo %d estaban')} donde no iban.`;
    }
    const tenian = segun(mover, 'una tenía que moverse', '%d tenían que moverse');
    if (movidas === mover) {
      return `¡Ordenado! Has movido ${segun(mover, 'la única', 'justo las %d')} que había ` +
        'que mover: las demás valen para los dos sistemas.';
    }
    return `¡Ordenado! Has movido ${segun(movidas, 'una pieza', '%d piezas')} y solo ` +
      `${tenian}.`;
  }

  function mensaje() {
    if (!correccion) {
      const quedan = partida.total - partida.piezasColocadas;
      if (partida.seleccion) {
        // En avanzado, y mientras no se haya pedido su pista, este mensaje no
        // puede nombrar la pieza: sería enseñar por texto lo que la ficha
        // esconde por fotografía.
        const pieza = partida.seleccion.pieza;
        const quien = nombreVisible(pieza) ? pieza.nombre : 'La pieza elegida';
        return `${quien}: toca el hueco donde va`;
      }
      if (partida.volteado) {
        return 'Los rótulos han cambiado. Mueve solo lo que ya no esté donde va';
      }
      // El nivel 7 empieza lleno, así que «quedan 0 piezas por colocar» sería
      // verdad y no diría nada. Lo que hay que decir es de qué va el nivel.
      if (tablero.inicial) {
        return 'Alguien lo ordenó antes, y mal. Cambia de sitio lo que no esté donde va';
      }
      if (quedan === 0) return 'Ya está todo dentro. Comprueba.';
      return `${segun(quedan, 'Queda una pieza', 'Quedan %d piezas')} por colocar. ` +
        'Toca una y luego su hueco';
    }
    if (correccion.resuelto && correccion.conNota) return nota();
    if (correccion.resuelto && partida.sePuedeVoltear) {
      return '¡Armario ordenado! Ahora los rótulos se dan la vuelta.';
    }
    if (correccion.resuelto) return '¡Armario ordenado! Todo está donde va.';
    if (!correccion.completo) {
      const fuera = correccion.total - correccion.colocadas;
      return `Todavía hay ${segun(fuera, 'una pieza', '%d piezas')} fuera del armario.`;
    }
    if (correccion.piezasMal.size) {
      return segun(
        correccion.piezasMal.size,
        'Una pieza está donde no va. Va marcada.',
        '%d piezas están donde no van. Van marcadas.',
      );
    }
    return segun(
      correccion.baldasMal.size,
      'Una balda lleva dentro cosas de dos grupos distintos.',
      '%d baldas llevan dentro cosas de dos grupos distintos.',
    );
  }

  /**
   * El final del armario, donde estaba el montón.
   *
   * Lleva lo que la línea de abajo no puede llevar y no repite lo que ya dice:
   * el candado, que es lo que queda del escape room que `docs/juego.md`
   * descartó, y qué se ha resistido **en este armario**, que es la devolución
   * que sirve para el siguiente. Sin rótulos no hay segunda: allí no se marcan
   * piezas sino baldas, porque señalar la pieza sería decir de qué grupo es.
   */
  function pintarResultado() {
    vaciar(resultado);
    resultado.append(
      el('h2.rotulo', {}, 'El candado del armario'),
      el(
        'p.candado',
        { 'aria-label': `El código es ${partida.cerradura.join(', ')}` },
        partida.cerradura.join(' · '),
      ),
      el('p.nota', {}, 'Cuántas piezas hay en cada balda, de arriba abajo.'),
    );

    if (tablero.rotulos === 'visibles') {
      const nombres = [...falladas]
        .map((id) => tablero.piezas.find((p) => p.id === id))
        .filter(Boolean)
        .map((p) => p.nombre);
      resultado.append(
        el(
          'p.resistidas',
          {},
          nombres.length
            ? `Se te ha resistido${nombres.length === 1 ? '' : 'n'}: ${enumerar(nombres)}.`
            : 'No se te ha resistido ninguna.',
        ),
      );
    }

    // «Ver ficha», desde la 6.7: la recompensa documental de docs/juego.md.
    // Vive aquí y no en la lupa de la cabecera a propósito —el detalle está en
    // `visor.js`—, así que una pieza con ficha ofrece un botón propio por cada
    // pieza del tablero, sin pasar por seleccionarla.
    if (visor) {
      const conFicha = tablero.piezas.filter((p) => visor.hayFichaPara(p.id));
      if (conFicha.length) {
        resultado.append(
          el('h2.rotulo', {}, 'Ver ficha'),
          el(
            'div.ver-fichas',
            {},
            conFicha.map((pieza) => {
              const boton = el(
                'button.ver-ficha-boton',
                { type: 'button' },
                pieza.nombre,
              );
              boton.onclick = () =>
                visor.abrirFicha(pieza.id, pieza.nombre, () =>
                  boton.focus({ preventScroll: true }),
                );
              return boton;
            }),
          ),
        );
      }
    }
  }

  function pintar() {
    vaciar(armazon);
    armazon.append(tablero.sistemas.length === 1 ? el('div.baldas', {}, baldasEnFila()) : rejilla());

    const acabado = Boolean(correccion?.final);
    monton.hidden = acabado;
    resultado.hidden = !acabado;
    if (acabado) pintarResultado();

    vaciar(monton);
    for (const pieza of partida.monton) {
      monton.append(
        ficha(pieza, { dentro: false, alTocar: () => hacer(() => partida.tocarEnMonton(pieza)) }),
      );
    }
    monton.classList.toggle('vacio', partida.monton.length === 0);

    actualizarLupa();
    actualizarPista();

    aviso.textContent = mensaje();
    aviso.dataset.estado = correccion ? (correccion.resuelto ? 'bien' : 'mal') : 'jugando';
    if (correccion?.final) {
      principal.textContent = 'Otro armario';
      secundario.textContent = 'Lo que llevas';
    } else {
      principal.textContent =
        correccion?.resuelto && partida.sePuedeVoltear ? 'Cambiar los rótulos' : 'Comprobar';
      secundario.textContent = 'Otro armario';
    }

    // Dentro de la raíz y no del documento: al repintar entero se pierde el
    // foco, y quien juega con teclado se quedaría en el principio de la lista
    // en cada movimiento.
    if (ultimoFoco) raiz.querySelector(ultimoFoco)?.focus({ preventScroll: true });
  }

  function comprobar() {
    ultimoFoco = null;
    correccion = partida.corregir();
    // Lo que se ha fallado se apunta en cada comprobación y no al final: al
    // final no queda ninguna mal puesta, que es lo mismo que le pasa a la nota
    // del recambio. Se apunta la pieza y no cuántas veces, porque lo que hay
    // que decir es «se te ha resistido», no cuánto.
    for (const id of correccion.piezasMal) falladas.add(id);
    progreso?.anotar(tablero, partida.huecos, correccion, cuaderno);
    pintar();
  }

  /**
   * Los rótulos se dan la vuelta y no se mueve nada de sitio.
   *
   * El cuaderno se reinicia porque el sistema es otro: lo que cuenta una vez
   * por tablero es el par pieza/sistema, y colocar el piano por Hornbostel-
   * Sachs y colocarlo por uso son las dos medidas que el progreso separa. El
   * intento no se reinicia: el tablero sigue siendo el mismo.
   */
  function voltear() {
    ultimoFoco = null;
    partida.voltear();
    tablero = partida.tablero;
    cuaderno.voltear();
    correccion = null;
    pintar();
  }

  const otroArmario = () => {
    const otra = Math.floor(Math.random() * plantilla.semillas);
    ir(`/tablero/${plantilla.id}/${armario.id}/${otra}`);
  };

  // Un solo botón grande, que en un móvil es lo que hay sitio para tener. Lo
  // que hace depende de por dónde vaya la partida, y eso se dice cambiándole el
  // texto y no construyéndolo otra vez: rehacerlo tira el foco de quien acaba
  // de pulsarlo. Es la lección del menú de la Fase 3.
  //
  // Los tres estados son los tres momentos del juego: comprobar, dar la vuelta
  // a los rótulos, y —desde la Fase 5— ir a por otro armario cuando este ya
  // está terminado, que es donde Comprobar no haría nada.
  const principal = el('button.principal', {
    type: 'button',
    onclick: () => {
      if (correccion?.final) return otroArmario();
      if (correccion?.resuelto && partida.sePuedeVoltear) return voltear();
      return comprobar();
    },
  });

  const secundario = el('button.secundario', {
    type: 'button',
    onclick: () => (correccion?.final ? ir('/progreso') : otroArmario()),
  });

  barra.append(aviso, el('div.botones', {}, principal, secundario));

  raiz.append(
    // El botón de volver va aquí arriba y no en la barra de abajo, que es donde
    // hay sitio: abajo están Comprobar y Otro armario, y salir de la partida al
    // lado de las dos cosas que se tocan cada pocos segundos es salir sin
    // querer. Arriba no cuesta alto —la cabecera ya medía lo que miden estas dos
    // líneas de texto— y es donde se busca.
    el(
      'header.cabecera',
      {},
      el('button.volver', { type: 'button', 'aria-label': 'Volver al menú', onclick: atras }, '←'),
      el(
        'div.titulos',
        {},
        el('h1', {}, plantilla.titulo),
        el('p.contexto', {}, `${armario.nombre}. ${armario.contexto}`),
      ),
      pista,
      lupa,
    ),
    armazon,
    monton,
    resultado,
    barra,
  );

  pintar();
  return raiz;
}
