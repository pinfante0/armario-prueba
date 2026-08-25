// Que colocar una pieza tocando funciona. Tocando de verdad: aquí no se llama a
// `Partida`, se buscan botones en el documento y se les hace clic, que es lo
// único que demuestra que el estado, la pantalla y los toques están unidos.
//
// docs/fases.md marca esta interacción como no delegable, y por eso tiene su
// propia comprobación en vez de fiarse de que «se ve bien». Lo que se prueba:
//
//   1. Un tablero se puede resolver entero a base de toques, y al comprobar
//      dice que está resuelto.
//   2. Tocar una pieza y luego un hueco ocupado las intercambia, que es lo que
//      convierte «arreglar dos piezas cruzadas» en un gesto y no en tres.
//   3. Tocar dos veces una pieza ya colocada la devuelve al montón.
//   4. Al comprobar, las piezas que están donde no van salen marcadas —y las
//      que están bien, no—.
//   5. Todo lo que se toca es un <button>. Es lo que hace que esto funcione
//      también con el teclado y con un lector de pantalla, que es la mitad del
//      motivo de no haber puesto arrastrar.
//
// El punto 1 se pasa por los seis tipos de tablero y por los tres armarios,
// porque las reglas de colocar no son las mismas con rótulos que sin ellos.
//
// Y desde la Fase 4, la segunda vuelta de los tableros de recambio, que es
// donde está la mecánica central del juego. Tres cosas más:
//
//   6. Al cambiar los rótulos no se mueve nada. Cuáles hay que mover es la
//      pregunta: sacar solas las que ya no encajan sería responderla.
//   7. La segunda vuelta se ordena entera a base de intercambios, porque allí
//      no hay montón, y quien la ordena siguiendo los ciclos toca exactamente
//      las piezas que el generador dijo que había que mover. Ese cruce es la
//      demostración de que la nota de este nivel mide algo: se mide jugando y
//      no preguntándole al juego cuánto se ha movido.
//   8. Y mover de más se nota, que es lo único que la nota puede distinguir.

import { cargarTodo, disponiblesPara } from '../js/datos.js';
import { generar } from '../js/generador.js';
import { pantallaTablero } from '../js/pantalla_tablero.js';
import { marco } from './marco.js';
import {
  aviso,
  candado,
  colocada,
  colocar,
  enMonton,
  ordenarColocando,
  ordenarIntercambiando,
  principal,
  reparto,
  rotulos,
  solucion,
} from './jugadas.js';

const SEMILLAS_POR_TABLERO = 5;

// --------------------------------------------------------------------------

function resolverTocando(pintar, plantilla, armario, instrumentos, semilla, fallos) {
  const tablero = generar(plantilla, armario, disponiblesPara(plantilla, instrumentos), semilla);
  const raiz = pintar(tablero.plantilla, tablero.armario, semilla);
  let donde;

  if (tablero.inicial) {
    // El nivel 7 empieza con el armario lleno y mal, así que aquí no se coloca:
    // se intercambia, igual que en la segunda vuelta del recambio. Y quien
    // sigue los ciclos toca exactamente las piezas que estaban donde no iban,
    // que es el cruce que hace que la nota de este nivel mida algo.
    if (raiz.querySelectorAll('.monton [data-pieza]').length) {
      fallos.push('el armario empieza lleno y aun así hay piezas en el montón');
    }
    donde = solucion(tablero);
    const tocadas = ordenarIntercambiando(raiz, tablero, fallos);
    if (tocadas.size !== tablero.mover) {
      fallos.push(
        `ordenarlo ha movido ${tocadas.size} piezas y el generador dice que estaban mal ` +
          `${tablero.mover}`,
      );
    }
  } else {
    donde = ordenarColocando(raiz, tablero, fallos);
    const quedan = raiz.querySelectorAll('.monton [data-pieza]').length;
    if (quedan) fallos.push(`han quedado ${quedan} pieza(s) en el montón`);
  }

  principal(raiz).click();
  if (aviso(raiz).dataset.estado !== 'bien') {
    fallos.push(`resuelto a mano y dice: «${aviso(raiz).textContent}»`);
  }
  if (tablero.recambio) darLaVuelta(raiz, tablero, fallos);
  return { tablero, raiz, donde };
}

/** La segunda vuelta entera: cambiar los rótulos y volver a ordenar. */
function darLaVuelta(raiz, tablero, fallos) {
  const antes = reparto(raiz);
  const rotulosAntes = rotulos(raiz);

  principal(raiz).click();

  const despues = reparto(raiz);
  // Que no se mueva nada al voltear no es comodidad: **cuáles hay que mover es
  // la pregunta**, y un juego que sacara solas las piezas que ya no encajan
  // estaría respondiéndola antes de hacerla.
  for (const [id, balda] of antes) {
    if (despues.get(id) !== balda) fallos.push(`al cambiar los rótulos se ha movido '${id}'`);
  }
  if (rotulos(raiz).join() === rotulosAntes.join()) {
    fallos.push('los rótulos no han cambiado al pulsar el botón');
  }
  if (raiz.querySelectorAll('.monton [data-pieza]').length) {
    fallos.push('la segunda vuelta ha empezado con piezas en el montón');
  }

  const tocadas = ordenarIntercambiando(raiz, tablero.recambio, fallos);
  if (tocadas.size !== tablero.mover) {
    fallos.push(
      `ordenar la segunda vuelta ha movido ${tocadas.size} piezas y el generador dice ` +
        `que tenían que moverse ${tablero.mover}`,
    );
  }

  principal(raiz).click();
  if (aviso(raiz).dataset.estado !== 'bien') {
    fallos.push(`la segunda vuelta, resuelta a mano, dice: «${aviso(raiz).textContent}»`);
  }
  if (aviso(raiz).textContent.includes('y solo')) {
    fallos.push(`sin mover nada de más, la nota dice «${aviso(raiz).textContent}»`);
  }
}

function probarIntercambio(pintar, datos, fallos) {
  const plantilla = datos.plantillas['n1-hs'];
  const armario = datos.armarios.aula;
  const tablero = generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), 0);
  const raiz = pintar(plantilla, armario, 0);
  const donde = solucion(tablero);

  // Dos piezas de baldas distintas, puestas cada una en la de la otra
  const a = tablero.piezas[0];
  const b = tablero.piezas.find((p) => donde.get(p.id) !== donde.get(a.id));
  colocar(raiz, a.id, donde.get(b.id), fallos);
  colocar(raiz, b.id, donde.get(a.id), fallos);

  // Ahora se toca una y se toca la otra: tienen que cambiarse el sitio
  colocada(raiz, a.id).click();
  colocada(raiz, b.id).click();

  const baldaDe = (id) => {
    const ficha = colocada(raiz, id);
    return ficha ? [...raiz.querySelectorAll('.huecos')].findIndex((h) => h.contains(ficha)) : -1;
  };
  if (baldaDe(a.id) === baldaDe(b.id) || baldaDe(a.id) < 0 || baldaDe(b.id) < 0) {
    fallos.push('tocar una pieza y luego otra colocada no las ha intercambiado');
  }

  // Y tocar dos veces la misma la devuelve al montón
  const ficha = colocada(raiz, a.id);
  ficha.click();
  colocada(raiz, a.id)?.click();
  if (!enMonton(raiz, a.id)) fallos.push('tocar dos veces una pieza colocada no la devuelve');
}

/**
 * Que mover de más se nota.
 *
 * Sin esto, la nota del recambio saldría siempre perfecta y parecería que
 * funciona: como la segunda vuelta tiene una sola solución, **quien la termina
 * acaba con las piezas exactamente donde tienen que estar**, se haya paseado lo
 * que se haya paseado por el camino. Lo que distingue a quien ve la fricción de
 * quien la busca a tientas es cuánto revuelve, y eso es lo que se mide aquí:
 * una pieza que ya estaba bien sale de su balda y vuelve, y tiene que contar.
 */
function probarLaNotaDelRecambio(pintar, datos, fallos) {
  const plantilla = datos.plantillas['n5-recambio'];
  const armario = datos.armarios.aula;
  const tablero = generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), 0);
  const raiz = pintar(plantilla, armario, 0);

  ordenarColocando(raiz, tablero, fallos);
  principal(raiz).click();
  principal(raiz).click();

  const destino = solucion(tablero.recambio);
  const ahora = [...reparto(raiz)];
  const quieta = ahora.find(([id, balda]) => destino.get(id) === balda);
  const viajera = ahora.find(([id, balda]) => destino.get(id) !== balda && balda !== quieta?.[1]);
  if (!quieta || !viajera) {
    return fallos.push('en este tablero no hay una que se quede y otra que se vaya en otra balda');
  }

  // El viaje de ida y vuelta que no hacía falta
  colocada(raiz, quieta[0]).click();
  colocada(raiz, viajera[0]).click();
  colocada(raiz, quieta[0]).click();
  colocada(raiz, viajera[0]).click();
  if (reparto(raiz).get(quieta[0]) !== quieta[1]) {
    return fallos.push('ida y vuelta no ha dejado la pieza donde estaba');
  }

  ordenarIntercambiando(raiz, tablero.recambio, fallos);
  principal(raiz).click();

  const dice = aviso(raiz).textContent;
  if (!dice.includes(`${tablero.mover + 1}`) || !dice.includes(`${tablero.mover}`)) {
    fallos.push(
      `se han movido ${tablero.mover + 1} y hacían falta ${tablero.mover}, y dice «${dice}»`,
    );
  }
}

/**
 * Que el candado sea el del armario que se acaba de ordenar.
 *
 * Un número grande y bonito al final es justo el sitio donde nadie mira si
 * dice la verdad, y este además es la única cifra que el juego enseña sin que
 * el jugador la haya escrito. Así que se cuenta a mano lo que hay en cada
 * balda —leyendo el documento, no preguntándole al juego— y se compara.
 *
 * Con dos ejes el candado son las filas y no las casillas, que es como se lee
 * un armario, y cuántas filas hay lo dicen sus rótulos.
 */
function probarElCandado(pintar, datos, fallos) {
  for (const id of ['n1-hs', 'n4-hs-uso']) {
    const plantilla = datos.plantillas[id];
    const armario = datos.armarios.aula;
    const tablero = generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), 0);
    const raiz = pintar(plantilla, armario, 0);

    if (candado(raiz)) fallos.push(`${id}: el candado sale antes de ordenar el armario`);

    ordenarColocando(raiz, tablero, fallos);
    principal(raiz).click();

    const marcador = candado(raiz);
    if (!marcador) {
      fallos.push(`${id}: el armario está ordenado y no sale el candado`);
      continue;
    }

    const porBalda = [...raiz.querySelectorAll('.armario .huecos')].map(
      (h) => h.querySelectorAll('[data-pieza]').length,
    );
    const filas = raiz.querySelectorAll('.rejilla .rotulo.fila').length || porBalda.length;
    const ancho = porBalda.length / filas;
    const porFila = [];
    for (let i = 0; i < filas; i++) {
      porFila.push(porBalda.slice(i * ancho, (i + 1) * ancho).reduce((a, b) => a + b, 0));
    }

    const esperado = porFila.join(' · ');
    if (marcador.textContent.trim() !== esperado) {
      fallos.push(
        `${id}: el candado dice «${marcador.textContent.trim()}» y en las baldas hay ${esperado}`,
      );
    }
  }
}

function probarCorreccion(pintar, datos, fallos) {
  const plantilla = datos.plantillas['n1-hs'];
  const armario = datos.armarios.aula;
  const tablero = generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), 3);
  const raiz = pintar(plantilla, armario, 3);
  const donde = solucion(tablero);

  // Se resuelve entero y luego se cruzan dos piezas de baldas distintas. Meter
  // una de más en una balda no vale: la balda se llena y la última pieza se
  // queda sin sitio, que es otro error y no el que se quiere mirar.
  for (const pieza of tablero.piezas) colocar(raiz, pieza.id, donde.get(pieza.id), fallos);

  const una = tablero.piezas[0];
  const otra = tablero.piezas.find((p) => donde.get(p.id) !== donde.get(una.id));
  colocada(raiz, una.id).click();
  colocada(raiz, otra.id).click();
  raiz.querySelector('.principal').click();

  const marcadas = [...raiz.querySelectorAll('.ficha.mal')].map((f) => f.dataset.pieza);
  for (const pieza of [una, otra]) {
    if (!marcadas.includes(pieza.id)) {
      fallos.push(`${pieza.nombre} está donde no va y no sale marcada`);
    }
  }
  if (marcadas.length !== 2) {
    fallos.push(`se ha marcado ${marcadas.length} pieza(s) y solo hay dos cruzadas`);
  }
  if (aviso(raiz).dataset.estado !== 'mal') {
    fallos.push(`con una pieza mal, el aviso dice «${aviso(raiz).textContent}»`);
  }
}

function probarQueSeTocaConTeclado(raiz, fallos) {
  // Nada de divs con onclick: sin esto no hay teclado ni lector de pantalla, y
  // esa era la mitad del motivo de no poner arrastrar.
  for (const clase of ['.ficha', '.hueco']) {
    for (const nodo of raiz.querySelectorAll(clase)) {
      if (nodo.tagName !== 'BUTTON') {
        fallos.push(`un ${clase} es un <${nodo.tagName.toLowerCase()}> y no un <button>`);
        return;
      }
    }
  }
  const sinNombre = [...raiz.querySelectorAll('.hueco')].filter(
    (h) => !h.getAttribute('aria-label'),
  );
  if (sinNombre.length) fallos.push(`${sinNombre.length} hueco(s) sin aria-label`);
}

// --------------------------------------------------------------------------

async function arrancar() {
  const salida = document.getElementById('informe');
  const datos = await cargarTodo();
  const ventana = await marco(360, 640, 'donde se juega la prueba');
  const juego = ventana.contentWindow.document.getElementById('juego');

  const pintar = (plantilla, armario, semilla) => {
    juego.replaceChildren();
    const nodo = pantallaTablero({
      plantilla,
      armario,
      semilla,
      instrumentos: datos.instrumentos,
      ir: () => {},
      atras: () => {},
    });
    juego.append(nodo);
    return nodo;
  };

  const lineas = ['Jugando a base de toques, sin tocar el estado por dentro.', ''];
  let mal = 0;

  for (const plantilla of Object.values(datos.plantillas)) {
    for (const idArmario of plantilla.armarios) {
      const fallos = [];
      let ultima = null;
      for (let semilla = 0; semilla < SEMILLAS_POR_TABLERO; semilla++) {
        const antes = fallos.length;
        ultima = resolverTocando(
          pintar,
          plantilla,
          datos.armarios[idArmario],
          datos.instrumentos,
          semilla,
          fallos,
        );
        for (let i = antes; i < fallos.length; i++) fallos[i] = `semilla ${semilla}: ${fallos[i]}`;
      }
      if (ultima) probarQueSeTocaConTeclado(ultima.raiz, fallos);

      const donde = `${plantilla.id} / ${idArmario}`;
      if (fallos.length) {
        mal += fallos.length;
        lineas.push(`  MAL ${donde}`);
        for (const f of fallos.slice(0, 3)) lineas.push(`      x ${f}`);
      } else {
        lineas.push(`  ok  ${donde.padEnd(28)} ${SEMILLAS_POR_TABLERO} tableros resueltos tocando`);
      }
    }
  }

  for (const [nombre, prueba] of [
    ['intercambiar dos piezas y devolver una al montón', probarIntercambio],
    ['al comprobar, se marca la que está donde no va', probarCorreccion],
    ['mover de más en el recambio se nota en la nota', probarLaNotaDelRecambio],
    ['el candado del final es el del armario ordenado', probarElCandado],
  ]) {
    const fallos = [];
    prueba(pintar, datos, fallos);
    mal += fallos.length;
    lineas.push(`  ${fallos.length ? 'MAL' : 'ok '} ${nombre}`);
    for (const f of fallos) lineas.push(`      x ${f}`);
  }

  lineas.push('');
  lineas.push(`ESTADO: ${mal === 0 ? 'PASA' : 'NO PASA'}`);
  salida.textContent = lineas.join('\n');
  salida.dataset.estado = mal === 0 ? 'pasa' : 'no-pasa';
}

arrancar().catch((fallo) => {
  const salida = document.getElementById('informe');
  salida.textContent = `${fallo.message}\n\nESTADO: NO PASA`;
  salida.dataset.estado = 'no-pasa';
});
