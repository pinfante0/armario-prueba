// Qué se enseña encima del nombre de una pieza, ahora que hay dos materias.
//
// Este archivo existe para una decisión y no para una función: la función son
// tres líneas. La decisión es **la convivencia del sprite con las fotografías
// mientras dure la migración**, que la entrega 6.2 dejó aplazada a la 6.4, y
// tiene que estar escrita en un solo sitio o acabará estando en tres con tres
// respuestas.
//
// ## Gana la fotografía, y el orden es foto → dibujo → nombre
//
// Es lo mismo que ya hacía el catálogo con los dibujos —una pieza sin dibujo
// enseña su nombre y ya está, el motor no espera al contenido— con un escalón
// más. Las otras dos salidas se miraron y se caen:
//
//   - **Que gane el dibujo mientras exista** dejaría hoy una sola fotografía a
//     la vista, la del `clarinete`, que es la única de las seis que no tiene
//     dibujo. O sea: conectar las fotografías para no enseñarlas. Y al revés de
//     lo que parece, no es lo conservador: invierte la dirección de la
//     migración, porque cada tanda de fotografías nuevas quedaría escondida
//     detrás de un dibujo que ya se decidió sustituir.
//   - **Apagar el sprite entero** mientras dure la convivencia le quita hoy el
//     dibujo a 23 piezas para que nadie vea dos materias juntas. Cuesta 23 para
//     arreglar una diferencia que se ve igual entre «tiene algo» y «no tiene
//     nada», que es la que lleva habiendo desde la tanda 1.
//
// ## Lo que cuesta, medido y no supuesto
//
// Un tablero mestizo **da una pista con el recurso**, y hoy da la más fuerte que
// ha dado nunca. Medido sobre los 1440 tableros: cuando en uno hay dos o más
// piezas con fotografía, **las seis de hoy caen todas en la misma balda el
// 48,2 %** de las veces, contra un 19,3 % de dos piezas cualesquiera. O sea que
// «las fotos van juntas» acierta dos veces y media más que el azar.
//
// No es nuevo y ese es el matiz que lo hace aceptable: la misma medida da
// **28,1 % en la tanda 1** de los dibujos y **22,4 % en la tanda 2**, y las dos
// se entregaron así. Lo que sí es nuevo es que hoy sea peor, y el motivo es que
// el primer sublote se eligió por ser **el peor grupo para distinguir** —los
// cuatro arcos comparten balda 275 de 275— y eso es exactamente lo mismo que ser
// **el peor grupo para entregar a medias**: un grupo que ningún sistema separa
// no puede repartirse por las baldas de un tablero.
//
// Baja por donde ya está previsto que siga la 6.3: con los once tambores del
// sublote siguiente queda en **20,3 %**, con los teclados en **7,0 %**, y con las
// 59 en cero, porque entonces no hay dos clases. La pista no dice además *qué*
// balda, y falla más de la mitad de las veces que aparece.
//
// ## Pero no decae, se muda: la pista la da la clase pequeña
//
// Y esto no se vio hasta escribir la orden que lo mide. Según las fotografías se
// llevan piezas, **la clase de los dibujos se queda pequeña y se concentra**:
// hoy da un 17,6 %, con los tambores un 16,6 %, y en cuanto entren los teclados
// se queda en **siete piezas que dan un 46,2 %** —la melódica, el acordeón y los
// cinco cordófonos de mástil—, y ahí se queda hasta el final porque ninguno de
// los sublotes siguientes las toca.
//
// O sea que lo que delata no es «tener fotografía»: es **pertenecer a la clase
// pequeña**, sea la que sea. Hoy son las fotografías y al final serán los
// dibujos. De ahí sale lo único accionable para la 6.3, y no cuesta nada
// aplicarlo: **los cinco de mástil no pueden ser el último grupo que quede sin
// fotografía**, porque son los que más comparten balda. Cualquier orden que los
// deje para el final termina la migración con la pista más alta que ha tenido
// desde los arcos.
//
// Los números se recalculan con `python herramientas/medir_convivencia.py`, que
// mide y no comprueba, y `--con tambores teclados` simula lo que falta. Están
// contados en `docs/fases.md`, apartado de la entrega 6.4.

import { cargarIconos } from './iconos.js';
import { cargarFotografias } from './fotografias.js';

/**
 * Junta las dos materias en una sola función, que es lo que la ficha consume.
 *
 * `documento` es el del sprite y solo el del sprite: un `<use href="#i-piano">`
 * únicamente encuentra su símbolo en su propio documento, y
 * `comprobar_pantalla.py` mide cada teléfono dentro de un `<iframe>`. Una
 * fotografía no tiene ese problema, porque un `<img>` trae su contenido en el
 * `src` y no en una referencia.
 */
export async function cargarRecursos(documento = document) {
  const [fotos, iconos] = await Promise.all([cargarFotografias(), cargarIconos(documento)]);
  // Dos cosas y no una: `recurso` es lo que pinta la ficha —la política de
  // convivencia ya resuelta— y `foto` es lo que consulta el visor para saber si
  // una pieza tiene fotografía y de dónde cargar su detalle. La ficha no ve la
  // segunda; el visor no necesita la primera.
  return { recurso: combinar(fotos.nodo, iconos), foto: fotos };
}

/**
 * El orden, aparte de la carga, para que las pruebas puedan combinar lo que
 * quieran sin volver a escribir la política. Recibe la función de nodos de las
 * fotografías —`fotos.nodo`— y no el objeto entero, porque combinar es sobre
 * quién pinta y el resto del objeto es cosa del visor.
 */
export function combinar(fotos, iconos) {
  return (id) => fotos?.(id) ?? iconos?.(id) ?? null;
}
