// «Ver de cerca»: la lupa de una pieza seleccionada.
//
// Lo que decide `docs/juego.md` y esta entrega implementa, en una frase por
// regla, porque cada una es una tentación de hacerlo de otra manera:
//
//   - **La lupa no es el toque de la pieza.** El toque sigue seleccionando para
//     mover, que es la interacción que `docs/fases.md` marca como no delegable.
//     La ampliación es un control explícito y aparte —ni un segundo toque, ni un
//     doble toque, ni una pulsación larga—, porque los dos primeros chocan con
//     «pieza y hueco» y la última no tiene equivalente para teclado ni para un
//     lector de pantalla. Aquí ese control es el botón de la cabecera, y este
//     módulo solo abre y cierra el visor: no toca la partida.
//   - **Abrir y cerrar no cambia el estado de la partida.** No mueve la pieza,
//     no borra la selección, no consume pista y no invalida una corrección. Este
//     módulo no conoce la `Partida`: recibe un id y un nombre y devuelve el foco
//     a donde estaba. Que no consuma pista es, en código, que aquí no haya nada
//     que la consuma.
//   - **El detalle se carga bajo demanda.** El `<img>` no se crea hasta que se
//     abre la lupa, así que el WebP de 1024 px no se pide hasta que hace falta.
//     La miniatura de la ficha ya está cargada; el detalle es lo que se paga solo
//     al mirar de cerca.
//   - **Y no toda pieza tiene detalle.** El violonchelo tiene miniatura y no
//     detalle, porque su fuente no da los 1024 px sin ampliar. El visor cae a la
//     miniatura sin pedir un 404: la lista de `indice.json` se lo dice. Es el
//     caso que este visor tiene que resolver bien, no una molestia: enseña la
//     mejor resolución que hay y no promete una que no existe.
//
// El nombre dentro del visor sigue la visibilidad de la ficha, desde la 6.6:
// oculto si el avanzado todavía no lo ha revelado para esa pieza, visible en
// cualquier otro caso. Y viaja **siempre** en el `aria-label` del diálogo,
// aunque esté oculto en pantalla: es lo que un lector de pantalla lee al
// abrirse, y no ver dibujos ni fotografías es justo lo que hace que a esa
// persona no le sirva de nada, igual que en la ficha.
//
// Desde la 6.7, el mismo diálogo enseña además la ficha documental: la
// recompensa por terminar el tablero completo (`docs/juego.md`). Se abre con
// `abrirFicha`, no con `abrir`, y **no desde la lupa de la cabecera**: la lupa
// selecciona la pieza primero —`ficha().click()`— y ese toque pasa por
// `Partida.tocarHueco()`, que en `pantalla_tablero.js` invalida la corrección
// anterior aunque no mueva nada. Con el armario ya terminado, eso borraría el
// propio candado que «Ver ficha» necesita justo al pedirlo: seleccionar para
// mirar cerraría lo que se acaba de abrir. Por eso «Ver ficha» vive en la
// pantalla del resultado, como una lista aparte que no toca `Partida` en
// absoluto: cada pieza del tablero abre su ficha con un botón propio, sin
// pasar por seleccionar. Es el mismo diálogo y el mismo `<img>` que la lupa
// —con su alternar entre foto y ficha—, pero una puerta de entrada distinta.

import { el } from './nucleo/dom.js';

/** «CC-BY-SA-4.0» en «CC BY-SA 4.0», «dominio-publico» en «Dominio público». */
function licenciaLegible(codigo) {
  if (codigo === 'dominio-publico') return 'Dominio público';
  if (codigo === 'CC0-1.0') return 'CC0 1.0 (dominio público)';
  return codigo.replace(/^CC-/, 'CC ').replace(/-(\d)/, ' $1');
}

/**
 * Una fila «Etiqueta: valor», y nada si no hay valor. Es la regla de
 * `docs/juego.md`: lo que no existe no se pinta, no hay un «sin documentar»
 * que rellene el hueco.
 */
function fila(etiqueta, valor) {
  return valor ? el('p.ficha-campo', {}, el('span.ficha-etiqueta', {}, `${etiqueta}: `), valor) : null;
}

/**
 * El contenido de «Ver ficha»: los dos bloques de `fichas.json`, cada uno con
 * solo los campos que trae esta pieza. El bloque `instrumento` es la
 * excepción y no la norma —lo tienen las piezas que de verdad vienen de un
 * museo con inventario—, así que la mayoría de las fichas se leen con tres o
 * cuatro líneas y eso no es un estado a medias: es como se van a leer casi
 * todas, hoy y cuando lleguen más piezas.
 */
function contenidoFicha(datos) {
  const foto = datos.fotografia ?? {};
  const instrumento = datos.instrumento;
  const nodos = [
    el(
      'p.ficha-campo',
      {},
      el('span.ficha-etiqueta', {}, 'Fotografía de '),
      foto.autor ?? '',
    ),
    fila('Fecha de la toma', foto.fecha),
    fila('Licencia', foto.licencia ? licenciaLegible(foto.licencia) : null),
    foto.pagina
      ? el('p.ficha-campo', {}, el('a', { href: foto.pagina, target: '_blank', rel: 'noopener' }, 'Ver la fuente'))
      : null,
  ];
  if (instrumento) {
    nodos.push(
      el('h3.ficha-subtitulo', {}, 'El instrumento'),
      fila('Museo', instrumento.museo),
      fila('Colección', instrumento.coleccion),
      fila('Inventario', instrumento.inventario),
      fila('Constructor', instrumento.constructor),
      fila('Fecha', instrumento.fecha),
      fila('Procedencia', instrumento.procedencia),
    );
  }
  return el('div.ficha-contenido', {}, nodos);
}

/**
 * Crea el visor una vez y devuelve con qué abrirlo.
 *
 * `foto` es lo que devuelve `cargarFotografias()`: `tieneFoto(id)` dice si hay
 * lupa que ofrecer, y `detalle(id)` / `miniatura(id)` dan la URL que se carga al
 * abrir. `montarEn` es dónde cuelga la capa —la pantalla del tablero en el
 * juego, el cuerpo del marco en la medición—, para que el diálogo viva dentro
 * del mismo documento que se está mirando y `100dvh` mida lo que ese documento.
 *
 * `ficha` es lo que devuelve `cargarFichas()`, y es opcional: sin él, «Ver
 * ficha» no aparece nunca, que es lo que necesita `web/pruebas/visor.html`
 * para seguir midiendo solo la lupa.
 */
export function crearVisor({ foto, ficha = null, montarEn }) {
  let volverFoco = null;
  let idAbierto = null;
  let mostrandoFicha = false;

  const imagen = el('img.visor-foto', { alt: '', draggable: false, decoding: 'async' });
  const nombre = el('p.visor-nombre');
  const marco = el('div.visor-marco', {}, imagen);
  const panelFicha = el('div.visor-ficha', { hidden: true });
  const cerrarBoton = el(
    'button.visor-cerrar',
    { type: 'button', 'aria-label': 'Cerrar', onclick: () => cerrar() },
    '✕',
  );
  // Reserva su sitio en la barra desde el primer dibujo y se oculta con
  // `hidden` en cada `abrir()`: a diferencia de la lupa de la cabecera, este
  // diálogo se construye una vez y se reutiliza para piezas distintas, así
  // que no hay una medición «antes/después» de la que cuidarse aquí.
  const fichaBoton = el(
    'button.visor-ficha-boton',
    { type: 'button', hidden: true, onclick: () => alternarFicha() },
    'Ver ficha',
  );
  const dialogo = el(
    'div.visor-dialogo',
    { role: 'dialog', 'aria-modal': 'true' },
    el('div.visor-barra', {}, fichaBoton, cerrarBoton),
    // La imagen en su propia zona flexible: así se ajusta al alto que quede tras
    // la barra y el nombre y no puede desbordar, sea cual sea su lado.
    marco,
    nombre,
    panelFicha,
  );
  // La capa cierra al tocar fuera del diálogo, que es el gesto que un móvil ya
  // tiene aprendido. El diálogo se para el clic para que tocar la fotografía no
  // cierre.
  const capa = el(
    'div.visor',
    {
      hidden: true,
      onclick: (evento) => {
        if (evento.target === capa) cerrar();
      },
      // Escape cierra. Tab queda atrapado dentro del diálogo recorriendo los
      // controles que haya visibles en cada momento —uno o dos, según si «Ver
      // ficha» está puesto—, en vez de saltar siempre al mismo botón: con dos
      // controles reales, devolver el foco a uno solo se comería el otro para
      // quien navega por teclado. Va en la capa y no en `document` para no
      // dejar un oyente global suelto y para que funcione igual dentro del
      // marco de la medición, donde el `document` es otro.
      onkeydown: (evento) => {
        if (evento.key === 'Escape') {
          evento.preventDefault();
          cerrar();
          return;
        }
        if (evento.key !== 'Tab') return;
        const foco = [fichaBoton, cerrarBoton].filter((n) => !n.hidden);
        if (!foco.length) return;
        evento.preventDefault();
        // El documento de verdad y no el global: `el()` crea los nodos sobre
        // `document` a secas, y `capa.ownerDocument` es el que de verdad los
        // tiene puestos después de colgarlos de `montarEn` —el mismo que en
        // el juego, y el del `<iframe>` dentro de la medición—.
        const actual = foco.indexOf(capa.ownerDocument.activeElement);
        const siguiente = evento.shiftKey
          ? (actual <= 0 ? foco.length - 1 : actual - 1)
          : (actual === foco.length - 1 ? 0 : actual + 1);
        foco[siguiente < 0 ? 0 : siguiente].focus();
      },
    },
    dialogo,
  );
  montarEn.append(capa);

  /** Pinta el panel de la ficha para `idAbierto`. Nada si no hay datos. */
  function pintarFicha() {
    panelFicha.replaceChildren();
    const datos = ficha?.datosDe(idAbierto);
    if (datos) panelFicha.append(contenidoFicha(datos));
  }

  function alternarFicha() {
    mostrandoFicha = !mostrandoFicha;
    if (mostrandoFicha) pintarFicha();
    marco.hidden = mostrandoFicha;
    panelFicha.hidden = !mostrandoFicha;
    // El nombre no se esconde al pasar a la ficha: es la única pista de a qué
    // pieza pertenece lo que se está leyendo, y sin él el panel sería un
    // museo sin cartela. Solo se esconde por lo de siempre —el avanzado, que
    // aquí nunca aplica porque `abrirFicha` abre con `mostrar` a `true`—.
    nombre.hidden = nombre.dataset.oculta === 'si';
    fichaBoton.textContent = mostrandoFicha ? 'Ver fotografía' : 'Ver ficha';
    fichaBoton.setAttribute(
      'aria-label',
      mostrandoFicha ? 'Ver fotografía' : `Ver ficha: ${nombre.textContent || 'la pieza'}`,
    );
    dialogo.setAttribute(
      'aria-label',
      `${mostrandoFicha ? 'Ficha de' : 'Ver de cerca:'} ${nombre.textContent || idAbierto}`,
    );
  }

  /**
   * `mostrar` decide si el nombre se ve en el visor. El `aria-label` del
   * diálogo lleva siempre `textoNombre`, mostrar sea lo que sea: es la parte
   * que un lector de pantalla necesita y que nunca puede depender de si el
   * avanzado ya reveló esta pieza.
   *
   * Este `abrir` es el de la lupa de la cabecera y **nunca** ofrece «Ver
   * ficha», ni siquiera con el armario ya terminado: es la puerta que se
   * toca seleccionando una pieza, y seleccionar después de terminar borraría
   * el propio candado que la ficha necesita. Quien quiera la ficha entra por
   * `abrirFicha`, desde la pantalla del resultado.
   */
  function abrir(id, textoNombre, mostrar, volver) {
    volverFoco = typeof volver === 'function' ? volver : null;
    idAbierto = id;
    // El detalle si lo hay, y si no la miniatura: el violonchelo pasa por aquí.
    imagen.src = foto.detalle(id) ?? foto.miniatura(id) ?? '';
    nombre.hidden = !mostrar;
    nombre.dataset.oculta = mostrar ? 'no' : 'si';
    nombre.textContent = mostrar ? textoNombre : '';
    dialogo.setAttribute('aria-label', `Ver de cerca: ${textoNombre}`);
    // Siempre se abre mostrando la fotografía, aunque la última vez se
    // cerrara con la ficha puesta: a quien solo quiere mirar de cerca no le
    // cambia nada, y quien quiere la ficha vuelve a pedirla con un toque.
    mostrandoFicha = false;
    marco.hidden = false;
    panelFicha.hidden = true;
    panelFicha.replaceChildren();
    fichaBoton.hidden = true;
    fichaBoton.textContent = 'Ver ficha';
    fichaBoton.setAttribute('aria-label', `Ver ficha: ${textoNombre}`);
    capa.hidden = false;
    cerrarBoton.focus();
  }

  /**
   * Abre directamente en la ficha: es la puerta de «Ver ficha» en la pantalla
   * del resultado, y no pasa por seleccionar la pieza —eso es lo que la
   * distingue de la lupa—. El nombre se enseña siempre: en el resultado ya se
   * enseña sin depender del avanzado, igual que las piezas resistidas. Quien
   * llama ya ha comprobado que hay ficha —`hayFichaPara`—, así que aquí solo
   * se revela el botón y se entra directamente en su vista.
   */
  function abrirFicha(id, textoNombre, volver) {
    abrir(id, textoNombre, true, volver);
    fichaBoton.hidden = false;
    alternarFicha();
  }

  function cerrar() {
    if (capa.hidden) return;
    capa.hidden = true;
    // Se suelta la imagen: no tiene sentido que un detalle de 1024 px se quede
    // en memoria con el visor cerrado. Al reabrir, el navegador la trae de su
    // caché.
    imagen.removeAttribute('src');
    idAbierto = null;
    const volver = volverFoco;
    volverFoco = null;
    // El foco vuelve a la ficha desde la que se abrió, no al botón de la lupa:
    // es la pieza lo que se estaba mirando.
    if (volver) volver();
  }

  return {
    /** ¿Hay lupa que ofrecer para esta pieza? Solo si tiene fotografía. */
    hayPara: (id) => foto.tieneFoto(id),
    /** ¿Hay «Ver ficha» que ofrecer? Solo si tiene fotografía y ficha. */
    hayFichaPara: (id) => foto.tieneFoto(id) && Boolean(ficha?.tieneFicha(id)),
    abrir,
    abrirFicha,
    cerrar,
  };
}
