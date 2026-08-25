// El menú: de quién es el armario, y qué armario se abre.
//
// La forma de esta pantalla la decide el suelo del proyecto, que es un teléfono
// de 320 px donde nada se desplaza. Cuatro plantillas por tres armarios son
// doce botones, y doce botones ahí dentro no caben sin apretarlos por debajo de
// lo que un dedo acierta. Así que se parte en dos preguntas distintas, que
// además es como se piensa: **primero de quién es el armario y luego qué hay
// que ordenar**. El armario se elige una vez y se queda elegido —vive en los
// ajustes—, y la lista de abajo son cuatro y no doce.
//
// Y no es solo que quepa. Un armario aquí es una prioridad de uso: cambiarlo
// cambia dónde va la guitarra, que es la lección del tema. Ponerlo arriba, con
// su frase de contexto debajo, dice eso mismo sin explicarlo.
//
// De aquí no sale ni un dato del catálogo: los nombres de las piezas se fueron
// con la Fase 5 a `#/progreso`, que es donde ese dato dice algo. Aquí quedan los
// títulos de las plantillas y los nombres de los armarios, que son de
// `tableros.json` y de `armarios.json` y están escritos para leerse.
//
// Y esa mudanza no fue de orden: **fue de sitio libre.** Con el nivel 2 dentro,
// el menú de quien vuelve pasó a 6 px de sobra en 320×568, y el nivel 7 no
// cabía. La línea «Se te resisten…» estaba aquí desde la Fase 3 porque no había
// pantalla de progreso; ahora la hay, y esa línea era exactamente el sitio del
// octavo nivel.

import { el } from './nucleo/dom.js';
import { armarioElegido } from './ajustes.js';

/** Lo que se lleva jugado de una plantilla en un armario. */
function avance({ comprobados, resueltos }) {
  if (resueltos) return resueltos === 1 ? 'Resuelto una vez' : `Resuelto ${resueltos} veces`;
  if (comprobados) return comprobados === 1 ? 'Un intento' : `${comprobados} intentos`;
  return 'Sin jugar';
}

export function pantallaMenu({ datos, ajustes, progreso, ir }) {
  const plantillas = Object.values(datos.plantillas);
  const armarios = Object.values(datos.armarios);
  let armario = armarioElegido(ajustes, datos.armarios);

  // Los botones se construyen una vez y luego solo se les cambia el texto y el
  // estado. Rehacerlos al elegir otro armario tira el que se acaba de tocar, y
  // con él el foco: quien va con teclado o con lector se queda en el principio
  // de la pantalla cada vez que cambia de armario. Lo caza `pruebas/armazon.js`,
  // que fue donde se vio.
  const opciones = armarios.map((cual) =>
    el('button.opcion', { type: 'button', onclick: () => elegir(cual) }, cual.nombre),
  );
  const contexto = el('p.contexto');

  const verProgreso = el(
    'button.secundario',
    { type: 'button', onclick: () => ir('/progreso') },
    'Progreso',
  );

  const filas = plantillas.map((plantilla) => {
    const marca = el('span.marca');
    const boton = el(
      'button.tablero',
      {
        type: 'button',
        onclick: () => {
          // Una semilla de las demostradas, y a la barra de direcciones: así el
          // tablero que salga se puede volver a mirar o enseñar a alguien.
          const semilla = Math.floor(Math.random() * plantilla.semillas);
          ir(`/tablero/${plantilla.id}/${armario.id}/${semilla}`);
        },
      },
      el('span.linea', {}, el('span.nivel', {}, `Nivel ${plantilla.nivel}`), marca),
      el('span.titulo', {}, plantilla.titulo),
    );
    return { plantilla, boton, marca };
  });

  function elegir(cual) {
    armario = cual;
    ajustes.armario = cual.id;
    refrescar();
  }

  function refrescar() {
    opciones.forEach((boton, i) => {
      const puesta = armarios[i] === armario;
      boton.setAttribute('aria-pressed', String(puesta));
      boton.classList.toggle('elegida', puesta);
    });
    contexto.textContent = armario.contexto;

    for (const { plantilla, boton, marca } of filas) {
      // Una plantilla puede no jugarse con este armario. Hoy no pasa con
      // ninguna, y por eso mismo sale desactivada y con su motivo en vez de
      // desaparecer: una lista que cambia de largo al tocar otra cosa se lee
      // como un fallo.
      const vale = plantilla.armarios.includes(armario.id);
      boton.disabled = !vale;
      marca.textContent = vale
        ? avance(progreso.tablero(plantilla.id, armario.id))
        : 'Con este armario, no';
    }

    // El botón de progreso solo aparece cuando hay algo que enseñar: llevar a
    // una pantalla que dice «todavía no hay nada» es hacer perder un toque.
    verProgreso.hidden = progreso.vacio;
  }

  refrescar();

  return el(
    'main.pantalla.menu',
    {},
    // El sello de la portada, con los dos apellidos. El otro sitio donde el
    // nombre se enseña es la firma de los créditos.
    el(
      'header.cabecera',
      {},
      el(
        'div.titulos',
        {},
        el('h1', {}, 'El Armario del Aula de Música'),
        el('p.contexto', {}, 'Educación musical y su didáctica · Pablo Infante Amate'),
      ),
    ),
    el(
      'section.eleccion',
      {},
      el('h2.rotulo', {}, 'De quién es el armario'),
      el('div.opciones', { role: 'group', 'aria-label': 'De quién es el armario' }, opciones),
      contexto,
    ),
    el(
      'nav.tableros',
      { 'aria-label': 'Qué armario abrir' },
      filas.map((f) => f.boton),
    ),
    el(
      'footer.barra',
      {},
      el(
        'div.botones',
        {},
        verProgreso,
        el('button.secundario', { type: 'button', onclick: () => ir('/ajustes') }, 'Ajustes'),
        el('button.secundario', { type: 'button', onclick: () => ir('/creditos') }, 'Créditos'),
      ),
    ),
  );
}
