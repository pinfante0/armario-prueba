// El armazón de una hoja: el botón de volver, el título y lo que traiga dentro.
//
// Ajustes y créditos son la misma página con otro texto, y esto es lo único que
// tienen igual. Está aparte para que la regla que las dos comparten —que el
// botón de volver sea siempre el mismo y esté siempre en el mismo sitio— no
// dependa de que alguien se acuerde de copiarla.
//
// Y el botón es un botón y no un enlace a `#/` a propósito: vuelve por el
// historial, así que quien llegó al menú desde una partida no se come el menú
// entero de vuelta. Si no hay historial de dónde volver —alguien ha abierto la
// dirección de los créditos directamente— la navegación lleva al menú, que es
// lo que hace `atras` en `principal.js`.

import { el } from './nucleo/dom.js';

/**
 * Una pantalla de texto, lista para colgar del documento.
 *
 *     hoja({ titulo: 'Créditos', atras, cuerpo: [el('p', {}, '…')] })
 */
export function hoja({ titulo, atras, cuerpo, pie = null }) {
  return el(
    'main.pantalla.hoja',
    {},
    el(
      'header.cabecera',
      {},
      el(
        'button.volver',
        { type: 'button', 'aria-label': 'Volver', onclick: atras },
        '←',
      ),
      el('h1', {}, titulo),
    ),
    el('section.cuerpo', {}, cuerpo),
    pie ? el('footer.barra', {}, pie) : null,
  );
}
