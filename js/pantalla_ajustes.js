// La pantalla de ajustes: el tema y el progreso.
//
// Qué hay aquí y qué no está decidido en `ajustes.js`, con los motivos. Esta
// pantalla solo lo enseña, y hace dos cosas con cuidado:
//
//   - **Borrar el progreso pregunta antes**, y pregunta dentro de la página en
//     vez de con un `confirm()` del navegador. Un `confirm()` bloquea, se ve
//     distinto en cada sistema y en un móvil sale pegado a la barra de arriba,
//     lejos del dedo. Dos toques en el mismo sitio son dos toques en el mismo
//     sitio, y el segundo botón dice qué va a pasar en vez de decir «Aceptar».
//   - **Si el navegador no deja guardar, se dice.** Es la mitad que le faltaba
//     a la degradación a memoria de `nucleo/almacen.js`: sin este aviso, quien
//     juega en navegación privada cree que lleva el progreso guardado.
//
// Los nodos se construyen una vez y luego solo se les cambia el texto. Repintar
// entero perdería el foco en cada toque, y esta es justo la pantalla donde
// alguien puede estar navegando con el teclado.

import { el } from './nucleo/dom.js';
import { hoja } from './hoja.js';
import { TEMAS } from './ajustes.js';

const NOMBRE_TEMA = { auto: 'Automático', claro: 'Claro', oscuro: 'Oscuro' };

// false primero: es lo que ya vale por defecto, y así el orden en pantalla es
// el mismo que POR_DEFECTO en ajustes.js.
const NIVELES = [false, true];
const NOMBRE_NIVEL = { false: 'Principiante', true: 'Avanzado' };

export function pantallaAjustes({ ajustes, progreso, atras }) {
  const temas = TEMAS.map((cual) =>
    el(
      'button.opcion',
      {
        type: 'button',
        onclick: () => {
          ajustes.tema = cual;
          refrescar();
        },
      },
      NOMBRE_TEMA[cual],
    ),
  );

  const niveles = NIVELES.map((cual) =>
    el(
      'button.opcion',
      {
        type: 'button',
        onclick: () => {
          ajustes.avanzado = cual;
          refrescar();
        },
      },
      NOMBRE_NIVEL[cual],
    ),
  );

  const donde = el(
    'p.nota',
    {},
    progreso.persiste
      ? 'Se guarda en este navegador y no sale de aquí: no hay servidor al que mandarlo.'
      : 'Este navegador no deja guardar nada, así que el progreso durará lo que dure la ' +
          'pestaña. Suele pasar en navegación privada.',
  );

  const aviso = el('p.aviso', { role: 'status', tabindex: '-1' });
  let preguntando = false;

  const borrar = el('button.peligro', {
    type: 'button',
    onclick: () => {
      if (!preguntando) {
        preguntando = true;
        aviso.textContent = 'Se borra lo jugado hasta ahora. No se puede deshacer.';
      } else {
        progreso.borrar();
        preguntando = false;
        aviso.textContent = 'Borrado. Se empieza de cero.';
        // El botón se queda desactivado al no haber ya nada que borrar, y el
        // foco no puede quedarse dentro de un botón desactivado: se va al
        // aviso, que es lo que acaba de cambiar.
        aviso.focus({ preventScroll: true });
      }
      refrescar();
    },
  });

  const cancelar = el(
    'button.secundario',
    {
      type: 'button',
      onclick: () => {
        preguntando = false;
        aviso.textContent = '';
        refrescar();
        borrar.focus({ preventScroll: true });
      },
    },
    'Dejarlo',
  );

  function refrescar() {
    TEMAS.forEach((cual, i) => {
      const puesto = ajustes.tema === cual;
      temas[i].setAttribute('aria-pressed', String(puesto));
      temas[i].classList.toggle('elegida', puesto);
    });

    NIVELES.forEach((cual, i) => {
      const puesto = ajustes.avanzado === cual;
      niveles[i].setAttribute('aria-pressed', String(puesto));
      niveles[i].classList.toggle('elegida', puesto);
    });

    const hayAlgo = !progreso.vacio;
    borrar.textContent = preguntando ? 'Sí, borrarlo' : 'Borrar el progreso';
    borrar.disabled = !hayAlgo;
    cancelar.hidden = !preguntando;
    if (!hayAlgo && !aviso.textContent) aviso.textContent = 'Todavía no hay nada guardado.';
  }

  refrescar();

  return hoja({
    titulo: 'Ajustes',
    atras,
    cuerpo: [
      el(
        'section.grupo',
        {},
        el('h2.rotulo', {}, 'Tema'),
        el('div.opciones', { role: 'group', 'aria-label': 'Tema' }, temas),
        el(
          'p.nota',
          {},
          'Con el automático manda el sistema. En un aula con el proyector encendido, el claro ' +
            'se ve mejor.',
        ),
      ),
      el(
        'section.grupo',
        {},
        el('h2.rotulo', {}, 'Cómo se enseña cada pieza'),
        el('div.opciones', { role: 'group', 'aria-label': 'Cómo se enseña cada pieza' }, niveles),
        el(
          'p.nota',
          {},
          'En principiante, la ficha lleva la fotografía y el nombre. En avanzado lleva solo la ' +
            'fotografía, y cada tablero da tres pistas que revelan el nombre de la pieza elegida; ' +
            'pedirlas no penaliza. El nivel «Baldas sin rótulo» enseña siempre el nombre, con ' +
            'cualquiera de los dos ajustes: ahí se cuentan piezas por grupo, y sin nombre no hay ' +
            'con qué contarlas.',
        ),
      ),
      el(
        'section.grupo',
        {},
        el('h2.rotulo', {}, 'El progreso'),
        donde,
        el('div.botones', {}, borrar, cancelar),
        aviso,
      ),
    ],
  });
}
