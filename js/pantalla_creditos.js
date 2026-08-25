// Los créditos: de quién es esto, de dónde sale y qué no se guarda.
//
// Aquí va la firma con los dos apellidos, que es lo que pide `CLAUDE.md` para
// los dos sitios donde el nombre se enseña: la portada y esta pantalla.
//
// Y una cosa que esta pantalla **no** dice, porque es el sitio exacto donde el
// proyecto hermano se equivocó: **no cuenta nada del catálogo.** Ni cuántos
// instrumentos hay, ni cuántos son del temario, ni cuántas clasificaciones
// están por revisar. Allí los créditos contaban cuántas canciones se habían
// podado, y con eso le contaban a quien jugaba el estado interno de un archivo
// que no sabe que existe. La regla del contrato —de `web/datos/` solo sale el
// campo `nombre`— vale también para los números que salen de contarlo, y aquí
// además esos números caducan cada vez que alguien añade una pieza.

import { el } from './nucleo/dom.js';
import { hoja } from './hoja.js';

export function pantallaCreditos({ atras }) {
  return hoja({
    titulo: 'Créditos',
    atras,
    cuerpo: [
      el(
        'p',
        {},
        'El Armario del Aula de Música es un juego para la asignatura de Educación musical y su ' +
          'didáctica, del Grado en Educación Primaria de la Universidad de Jaén.',
      ),
      el('p.firma', {}, 'Pablo Infante Amate'),
      el(
        'p',
        {},
        'Los instrumentos y las tres formas de clasificarlos salen del Tema 7 de la asignatura. ' +
          'Los códigos de Hornbostel-Sachs, de la revisión publicada por el MIMO en 2011.',
      ),
      el(
        'p',
        {},
        'Este juego no pide nada a ningún servidor y no guarda datos de nadie. Lo que se juega y ' +
          'lo que se lleva jugado se quedan en este navegador.',
      ),
    ],
  });
}
