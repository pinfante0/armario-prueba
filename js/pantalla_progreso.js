// Lo que llevas: la pantalla donde el progreso deja de ser un número guardado.
//
// La Fase 3 cerró el esquema en **el par pieza/sistema** y lo dejó escrito sin
// enseñar, con el motivo apuntado: «esa es la Fase 5, que es donde se decide qué
// es un resultado en este juego». Esta pantalla es esa decisión, y la decisión
// es corta: **un resultado aquí no es cuánto llevas, es dónde te contradicen los
// dos sistemas.**
//
// Por eso lo primero que se lee no es un marcador. «El piano lo colocas por el
// uso y no por Hornbostel-Sachs» es una frase que ningún contador por pieza
// puede escribir, y es literalmente el Tema 7: la misma pieza cambia de sitio
// según quién pregunte. Lo demás —qué se te resiste, cuántos armarios llevas—
// va debajo y en dos líneas.
//
// Y la regla del contrato se cumple entera: de `web/datos/` aquí solo sale el
// campo `nombre`. Decir que el piano se te resiste **por Hornbostel-Sachs** no
// dice dónde va el piano; es un dato de quien juega y no del catálogo, que es
// justo lo que lo hace enseñable en clase.

import { el } from './nucleo/dom.js';
import { hoja } from './hoja.js';
import { enumerar, segun } from './texto.js';

// Cómo se llama cada sistema cuando se habla de él. Van con su artículo porque
// todos entran en la misma frase —«por el uso», «por Hornbostel-Sachs»— y una
// tabla de nombres sueltos obligaría a pegarles el artículo fuera, que es donde
// se rompen las concordancias.
const POR_SISTEMA = {
  hs: 'por Hornbostel-Sachs',
  uso: 'por el uso',
  familia: 'por la familia de la orquesta',
  'hs-arbol': 'por los subniveles',
};

const nombreDe = (sistema) => POR_SISTEMA[sistema] ?? `por ${sistema}`;

export function pantallaProgreso({ datos, progreso, atras }) {
  const cuerpo = [];

  if (progreso.vacio) {
    return hoja({
      titulo: 'Lo que llevas',
      atras,
      cuerpo: [
        el(
          'p',
          {},
          'Todavía no hay nada. Ordena un armario y aquí saldrá lo que más te cuesta, y sobre ' +
            'todo dónde te llevan la contraria los dos sistemas.',
        ),
      ],
    });
  }

  // ------------------------------------------------------------------
  // Lo primero, porque es lo único que este esquema sabe decir
  // ------------------------------------------------------------------

  const chocan = progreso.contradicciones(datos.instrumentos, 3);
  const lineas = chocan.map(({ instrumento, bien, mal }) =>
    el(
      'li',
      {},
      el('span.pieza', {}, instrumento.nombre),
      el('span.detalle', {}, `bien ${nombreDe(bien)}, mal ${nombreDe(mal)}`),
    ),
  );

  cuerpo.push(
    el(
      'section.grupo',
      {},
      el('h2.rotulo', {}, 'Donde los sistemas te contradicen'),
      lineas.length
        ? el('ul.contradicciones', {}, lineas)
        : el(
            'p.nota',
            {},
            'De momento ninguna. Sale cuando una misma pieza te sale bien por un sistema y mal ' +
              'por otro, así que hace falta haberla colocado por los dos: los niveles 5 y 6 son ' +
              'los que más rápido lo enseñan.',
          ),
    ),
  );

  // ------------------------------------------------------------------
  // Y debajo, lo que ya salía en el menú hasta esta fase
  // ------------------------------------------------------------------

  const flojas = progreso.resistentes(datos.instrumentos, 3);
  if (flojas.length) {
    cuerpo.push(
      el(
        'section.grupo',
        {},
        el('h2.rotulo', {}, 'Las que más se resisten'),
        el('p', {}, `${enumerar(flojas.map((i) => i.nombre))}.`),
      ),
    );
  }

  // Los dos números se suman al leer y no se guardan, que es la misma regla que
  // ordena `web/datos/`: lo que se puede derivar no se almacena.
  let intentos = 0;
  let resueltos = 0;
  for (const plantilla of Object.values(datos.plantillas)) {
    for (const idArmario of plantilla.armarios) {
      const cuenta = progreso.tablero(plantilla.id, idArmario);
      intentos += cuenta.comprobados;
      resueltos += cuenta.resueltos;
    }
  }

  cuerpo.push(
    el(
      'section.grupo',
      {},
      el('h2.rotulo', {}, 'Los armarios'),
      el(
        'p',
        {},
        `${segun(intentos, 'Has abierto un armario', 'Has abierto %d armarios')} y ` +
          `${
            resueltos === 0
              ? 'todavía no has terminado ninguno'
              : segun(resueltos, 'has ordenado uno', 'has ordenado %d')
          }.`,
      ),
      // Por nivel no se repite aquí: eso ya está en el menú, al lado del botón
      // con el que se entra, que es donde sirve para decidir a qué jugar.
      el('p.nota', {}, 'Lo que llevas de cada nivel sale en el menú, debajo de su nombre.'),
    ),
  );

  return hoja({ titulo: 'Lo que llevas', atras, cuerpo });
}
