// El armazón de la Fase 3: que las pantallas nuevas quepan, que no cuenten lo
// que no deben, y que el progreso mida lo que dice medir.
//
// Las dos primeras son las mismas reglas del tablero y se miden con la misma
// vara —`medidas.js`—, porque una pantalla de ajustes que se desplaza es
// exactamente igual de mala que un tablero que se desplaza.
//
// La tercera es nueva y es la que justifica esta página. El progreso es la
// primera cosa de este juego que **sobrevive a la partida**, y de las que se
// rompen sin hacer ruido: un contador que suma de más sigue enseñando un número
// creíble. Aquí se le pide lo que promete `js/progreso.js`:
//
//   - que una pieza cuente una sola vez por tablero, se pulse Comprobar las
//     veces que se pulse;
//   - que se juzgue por eje, porque una pieza puede estar en la fila que le
//     toca y en la columna que no, y esa es justo la lección del tema;
//   - que lo que se queda en el montón no cuente;
//   - y que cuando el navegador no deje guardar, el juego siga jugándose y lo
//     diga, que es la mitad que le falta a una degradación a memoria.
//
// Nada de esto toca el navegador de quien comprueba: los almacenes son de
// mentira y viven en un Map. Una comprobación que borra el progreso de quien la
// pasa se pasa una vez.
//
// Y lleva sus dos casos que tienen que dar mal, por lo mismo que `autoprueba()`
// en resolver.py: una pantalla a propósito demasiado alta y una ficha con su
// clasificación pegada. Sin ellos, una medición insensible saldría en verde sin
// medir nada, que es la peor forma de fallar que puede tener una prueba.

import { cargarTodo, disponiblesPara } from '../js/datos.js';
import { Almacen } from '../js/nucleo/almacen.js';
import { el } from '../js/nucleo/dom.js';
import { Ajustes, armarioElegido } from '../js/ajustes.js';
import { Progreso, Cuaderno } from '../js/progreso.js';
import { generar } from '../js/generador.js';
import { pantallaMenu } from '../js/pantalla_menu.js';
import { pantallaAjustes } from '../js/pantalla_ajustes.js';
import { pantallaCreditos } from '../js/pantalla_creditos.js';
import { pantallaProgreso } from '../js/pantalla_progreso.js';
import { pantallaTablero } from '../js/pantalla_tablero.js';
import { marco } from './marco.js';
import { TELEFONOS, fugas, medir } from './medidas.js';

// --------------------------------------------------------------------------
// Almacenes de mentira
// --------------------------------------------------------------------------

/** Un localStorage que vive en un Map, para poder mirarle dentro. */
function trastienda() {
  const datos = new Map();
  return {
    datos,
    getItem: (clave) => (datos.has(clave) ? datos.get(clave) : null),
    setItem: (clave, valor) => datos.set(clave, String(valor)),
    removeItem: (clave) => datos.delete(clave),
  };
}

const almacenDeMentira = () => new Almacen('prueba.', trastienda());

/** Uno que se niega a escribir, como Safari en navegación privada. */
const almacenAveriado = () =>
  new Almacen('prueba.', {
    getItem: () => null,
    setItem: () => {
      throw new Error('no hay sitio');
    },
    removeItem: () => {},
  });

const ajustesDeMentira = (almacen, oscuro = false) =>
  new Ajustes(almacen, { raiz: document.createElement('div'), medio: { matches: oscuro } });

/**
 * El navegador de quien ya lleva un rato jugando.
 *
 * Se siembra por debajo, escribiendo el esquema que `js/progreso.js` documenta
 * en su cabecera, porque es exactamente lo que se encontraría el juego al abrir
 * el navegador de alguien que vuelve. Las piezas son las de nombre más largo,
 * que es el caso peor de las dos pantallas que las escriben.
 *
 * Y cada una lleva las dos mitades de una contradicción —un sistema sin ningún
 * fallo y otro con nueve—, porque esa es la línea más larga que `#/progreso`
 * puede escribir: el nombre de la pieza y los dos sistemas debajo.
 */
function progresoDeQuienVuelve(datos) {
  const almacen = almacenDeMentira();
  const piezas = {};
  const largos = [...datos.instrumentos]
    .sort((a, b) => b.nombre.length - a.nombre.length)
    .slice(0, 3);
  for (const ins of largos) {
    piezas[`${ins.id}|hs`] = { bien: 2, mal: 9 };
    piezas[`${ins.id}|familia`] = { bien: 4, mal: 0 };
  }

  const tableros = {};
  for (const plantilla of Object.values(datos.plantillas)) {
    for (const armario of plantilla.armarios) {
      tableros[`${plantilla.id}|${armario}`] = { comprobados: 14, resueltos: 12 };
    }
  }

  almacen.escribir('progreso', { version: 1, piezas, tableros });
  return new Progreso(almacen);
}

// --------------------------------------------------------------------------
// Las pantallas, cada una en el estado en el que peor lo tiene
// --------------------------------------------------------------------------

function pantallasDePrueba(datos) {
  return [
    {
      nombre: 'menú, recién abierto',
      dibujar: () => {
        const almacen = almacenDeMentira();
        return pantallaMenu({
          datos,
          ajustes: ajustesDeMentira(almacen),
          progreso: new Progreso(almacen),
          ir: () => {},
        });
      },
    },
    {
      nombre: 'menú, de quien vuelve',
      dibujar: () =>
        pantallaMenu({
          datos,
          ajustes: ajustesDeMentira(almacenDeMentira()),
          progreso: progresoDeQuienVuelve(datos),
          ir: () => {},
        }),
    },
    {
      nombre: 'ajustes',
      dibujar: () => {
        const almacen = almacenDeMentira();
        return pantallaAjustes({
          ajustes: ajustesDeMentira(almacen),
          progreso: new Progreso(almacen),
          atras: () => {},
        });
      },
    },
    {
      // El caso peor de esta hoja: el aviso largo de que aquí no se puede
      // guardar, y encima preguntando si de verdad hay que borrar.
      nombre: 'ajustes, sin poder guardar y preguntando',
      dibujar: () => {
        const nodo = pantallaAjustes({
          ajustes: ajustesDeMentira(almacenAveriado()),
          progreso: progresoDeQuienVuelve(datos),
          atras: () => {},
        });
        nodo.querySelector('.peligro').click();
        return nodo;
      },
    },
    {
      nombre: 'créditos',
      dibujar: () => pantallaCreditos({ atras: () => {} }),
    },
    {
      nombre: 'progreso, sin nada que enseñar',
      dibujar: () =>
        pantallaProgreso({ datos, progreso: new Progreso(almacenDeMentira()), atras: () => {} }),
    },
    {
      // El caso peor: tres contradicciones de las piezas de nombre más largo,
      // que son además las tres que se resisten.
      nombre: 'progreso, de quien vuelve',
      dibujar: () =>
        pantallaProgreso({ datos, progreso: progresoDeQuienVuelve(datos), atras: () => {} }),
    },
  ];
}

async function medirTelefono(ancho, alto, etiqueta, datos, soloEste) {
  if (soloEste && soloEste !== `${ancho}x${alto}`) return { lineas: [], mal: 0 };

  const ventana = await marco(ancho, alto, etiqueta);
  const dentro = ventana.contentWindow;
  const juego = dentro.document.getElementById('juego');
  const lineas = [`  ${ancho}×${alto}, ${etiqueta}`];
  let mal = 0;

  for (const { nombre, dibujar } of pantallasDePrueba(datos)) {
    juego.replaceChildren();
    const nodo = dibujar();
    juego.append(nodo);

    const medida = medir(nodo, dentro);
    const problemas = [...medida.problemas, ...fugas(nodo, datos.instrumentos)];
    if (problemas.length) {
      mal += problemas.length;
      lineas.push(`    MAL ${nombre}`);
      for (const p of problemas) lineas.push(`        x ${p}`);
    } else {
      lineas.push(`    ok  ${nombre.padEnd(38)} sobran ${String(medida.sobra).padStart(4)} px`);
    }
  }

  lineas.push('');
  return { lineas, mal };
}

// --------------------------------------------------------------------------
// Lo que guarda el juego
// --------------------------------------------------------------------------

const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function pruebasDeAlmacen(comprueba) {
  comprueba('el almacén guarda y devuelve lo guardado', (fallos) => {
    const almacen = almacenDeMentira();
    almacen.escribir('cosa', { a: 1, b: ['dos'] });
    if (!iguales(almacen.leer('cosa'), { a: 1, b: ['dos'] })) fallos.push('no ha vuelto igual');
    if (almacen.leer('otra', 'nada') !== 'nada') fallos.push('lo que no está no devuelve el defecto');
    almacen.borrar('cosa');
    if (almacen.leer('cosa', null) !== null) fallos.push('borrar no ha borrado');
    if (!almacen.persiste) fallos.push('dice que no persiste y sí persiste');
  });

  comprueba('un JSON a medio escribir no rompe nada: se empieza de cero', (fallos) => {
    const dentro = trastienda();
    const almacen = new Almacen('prueba.', dentro);
    dentro.datos.set('prueba.progreso', '{"version": 1, "piez');
    if (almacen.leer('progreso', 'de cero') !== 'de cero') fallos.push('no ha vuelto al defecto');
    if (dentro.datos.has('prueba.progreso')) fallos.push('lo ilegible sigue guardado');
  });

  comprueba('sin sitio donde guardar, se degrada a memoria y lo dice', (fallos) => {
    const almacen = almacenAveriado();
    almacen.escribir('ajustes', { tema: 'oscuro' });
    if (almacen.persiste) fallos.push('dice que persiste y no puede guardar');
    if (!iguales(almacen.leer('ajustes'), { tema: 'oscuro' })) {
      fallos.push('no lo recuerda ni durante esta pestaña');
    }
  });
}

function pruebasDeProgreso(datos, comprueba) {
  const tableroDe = (id, armario, semilla = 0) => {
    const plantilla = datos.plantillas[id];
    const cual = datos.armarios[armario];
    return generar(plantilla, cual, disponiblesPara(plantilla, datos.instrumentos), semilla);
  };

  /** Los huecos de una partida recién empezada. La misma forma que Partida. */
  const huecosVacios = (tablero) => tablero.casillas.map((c) => Array(c.capacidad).fill(null));
  const suCasilla = (tablero, pieza) => tablero.indiceDe(pieza);

  comprueba('una pieza cuenta una sola vez por tablero', (fallos) => {
    const progreso = new Progreso(almacenDeMentira());
    const tablero = tableroDe('n1-hs', 'aula');
    const huecos = huecosVacios(tablero);
    const pieza = tablero.piezas[0];
    huecos[suCasilla(tablero, pieza)][0] = pieza;

    const cuaderno = new Cuaderno();
    for (let i = 0; i < 5; i++) {
      progreso.anotar(tablero, huecos, { resuelto: false }, cuaderno);
    }

    const cuenta = progreso.pieza(pieza.id, 'hs');
    if (cuenta.bien !== 1) fallos.push(`cinco comprobaciones han anotado ${cuenta.bien} aciertos`);
    const marca = progreso.tablero('n1-hs', 'aula');
    if (marca.comprobados !== 1) fallos.push(`el tablero cuenta ${marca.comprobados} intentos`);
  });

  comprueba('se juzga por eje: bien en la fila y mal en la columna', (fallos) => {
    const progreso = new Progreso(almacenDeMentira());
    const tablero = tableroDe('n4-hs-uso', 'aula');
    const huecos = huecosVacios(tablero);
    const pieza = tablero.piezas.find((p) => {
      const celda = tablero.celdaDe(p);
      return tablero.casillas.some((c) => c.claves[0] === celda[0] && c.claves[1] !== celda[1]);
    });
    if (!pieza) return fallos.push('este tablero no tiene ninguna pieza que sirva para mirar esto');

    const celda = tablero.celdaDe(pieza);
    const donde = tablero.casillas.findIndex(
      (c) => c.claves[0] === celda[0] && c.claves[1] !== celda[1],
    );
    huecos[donde][0] = pieza;
    progreso.anotar(tablero, huecos, { resuelto: false }, new Cuaderno());

    const porHs = progreso.pieza(pieza.id, 'hs');
    const porUso = progreso.pieza(pieza.id, 'uso');
    if (porHs.bien !== 1 || porHs.mal !== 0) fallos.push(`por H-S dice ${JSON.stringify(porHs)}`);
    if (porUso.mal !== 1 || porUso.bien !== 0) fallos.push(`por uso dice ${JSON.stringify(porUso)}`);
  });

  comprueba('en un recambio, cada vuelta anota por su sistema', (fallos) => {
    const progreso = new Progreso(almacenDeMentira());
    const tablero = tableroDe('n5-recambio', 'aula');
    const cuaderno = new Cuaderno();

    // La primera vuelta, ordenada entera y en su sitio
    const huecos = huecosVacios(tablero);
    const puestas = tablero.casillas.map(() => 0);
    for (const pieza of tablero.piezas) {
      const i = suCasilla(tablero, pieza);
      huecos[i][puestas[i]++] = pieza;
    }
    progreso.anotar(tablero, huecos, { resuelto: true, final: false }, cuaderno);
    if (progreso.tablero('n5-recambio', 'aula').resueltos !== 0) {
      fallos.push('ordenar solo la primera vuelta ya cuenta como tablero resuelto');
    }

    // Los rótulos se dan la vuelta y las piezas se quedan donde están: las
    // mismas colocaciones ahora se juzgan por el otro sistema.
    cuaderno.voltear();
    progreso.anotar(tablero.recambio, huecos, { resuelto: true, final: true }, cuaderno);

    const sinHs = tablero.piezas.filter((p) => {
      const cuenta = progreso.pieza(p.id, 'hs');
      return cuenta.bien + cuenta.mal !== 1;
    });
    if (sinHs.length) fallos.push(`${sinHs.length} pieza(s) no han contado una vez por H-S`);

    // Y por uso, las que estén mal son exactamente las que había que mover.
    const mal = tablero.piezas.filter((p) => progreso.pieza(p.id, 'uso').mal).length;
    if (mal !== tablero.mover) {
      fallos.push(`por uso salen ${mal} mal y había que mover ${tablero.mover}`);
    }

    // Dos vueltas, pero un intento: el tablero es el mismo.
    const marca = progreso.tablero('n5-recambio', 'aula');
    if (marca.comprobados !== 1 || marca.resueltos !== 1) {
      fallos.push(`el tablero cuenta ${JSON.stringify(marca)} y es un intento y un resuelto`);
    }
  });

  comprueba('lo que se queda en el montón no cuenta', (fallos) => {
    const progreso = new Progreso(almacenDeMentira());
    const tablero = tableroDe('n1-hs', 'aula');
    progreso.anotar(tablero, huecosVacios(tablero), { resuelto: false }, new Cuaderno());
    for (const pieza of tablero.piezas) {
      const cuenta = progreso.pieza(pieza.id, 'hs');
      if (cuenta.bien || cuenta.mal) fallos.push(`${pieza.nombre} ha contado sin estar colocada`);
    }
  });

  comprueba('un progreso de otra versión se descarta entero', (fallos) => {
    const almacen = almacenDeMentira();
    almacen.escribir('progreso', {
      version: 99,
      piezas: { 'guitarra|hs': { bien: 7, mal: 7 } },
      tableros: {},
    });
    const progreso = new Progreso(almacen);
    if (!progreso.vacio) fallos.push('se ha creído un progreso de una versión que no entiende');
  });

  comprueba('las que más se resisten salen ordenadas, y solo las que existen', (fallos) => {
    const almacen = almacenDeMentira();
    const [uno, dos] = datos.instrumentos;
    almacen.escribir('progreso', {
      version: 1,
      piezas: {
        [`${uno.id}|hs`]: { bien: 0, mal: 2 },
        [`${dos.id}|hs`]: { bien: 0, mal: 3 },
        [`${dos.id}|uso`]: { bien: 0, mal: 4 },
        'trombon-de-varas-inventado|hs': { bien: 0, mal: 99 },
        [`${uno.id}|uso`]: { bien: 5, mal: 0 },
      },
      tableros: {},
    });
    const salen = new Progreso(almacen).resistentes(datos.instrumentos, 3).map((i) => i.id);
    if (!iguales(salen, [dos.id, uno.id])) {
      fallos.push(`salen ${salen.join(', ')} y se esperaba ${dos.id}, ${uno.id}`);
    }
  });

  comprueba('una contradicción pide las dos mitades, y limpias', (fallos) => {
    const almacen = almacenDeMentira();
    const [choca, soloMal, aMedias] = datos.instrumentos;
    almacen.escribir('progreso', {
      version: 1,
      piezas: {
        // La buena: por uso nunca falla, por Hornbostel-Sachs falla tres veces.
        [`${choca.id}|uso`]: { bien: 4, mal: 0 },
        [`${choca.id}|hs`]: { bien: 1, mal: 3 },
        // Esta se resiste por los dos, que no es una contradicción: es una
        // pieza que todavía no se sabe. La cuenta `resistentes()`, no esta.
        [`${soloMal.id}|uso`]: { bien: 0, mal: 6 },
        [`${soloMal.id}|hs`]: { bien: 0, mal: 6 },
        // Y esta falla por uno y por el otro ni bien ni mal: falta la mitad.
        [`${aMedias.id}|hs`]: { bien: 2, mal: 2 },
      },
      tableros: {},
    });

    const salen = new Progreso(almacen).contradicciones(datos.instrumentos, 5);
    const ids = salen.map((c) => c.instrumento.id);
    if (!iguales(ids, [choca.id])) {
      fallos.push(`salen ${ids.join(', ') || 'ninguna'} y solo tenía que salir ${choca.id}`);
      return;
    }
    if (salen[0].bien !== 'uso' || salen[0].mal !== 'hs') {
      fallos.push(`dice bien por '${salen[0].bien}' y mal por '${salen[0].mal}'`);
    }
  });

  comprueba('borrar deja el progreso vacío y sin rastro', (fallos) => {
    const dentro = trastienda();
    const progreso = new Progreso(new Almacen('prueba.', dentro));
    const tablero = tableroDe('n1-hs', 'aula');
    const huecos = huecosVacios(tablero);
    huecos[suCasilla(tablero, tablero.piezas[0])][0] = tablero.piezas[0];
    progreso.anotar(tablero, huecos, { resuelto: true, final: true }, new Cuaderno());
    if (progreso.vacio) return fallos.push('no ha anotado nada que borrar');

    progreso.borrar();
    if (!progreso.vacio) fallos.push('sigue teniendo cosas dentro');
    if (dentro.datos.has('prueba.progreso')) fallos.push('sigue guardado en el navegador');
  });
}

function pruebasDeAjustes(datos, comprueba) {
  comprueba('el tema se escribe ya resuelto, también el automático', (fallos) => {
    const raiz = document.createElement('div');
    const ajustes = new Ajustes(almacenDeMentira(), { raiz, medio: { matches: true } });
    if (raiz.dataset.tema !== 'oscuro') {
      fallos.push(`con el sistema en oscuro y el tema en auto pone '${raiz.dataset.tema}'`);
    }
    ajustes.tema = 'claro';
    if (raiz.dataset.tema !== 'claro') fallos.push('elegir el claro no ha cambiado el <html>');
  });

  comprueba('lo elegido sobrevive a cerrar la pestaña', (fallos) => {
    const dentro = trastienda();
    const raiz = document.createElement('div');
    const antes = new Ajustes(new Almacen('prueba.', dentro), { raiz, medio: { matches: false } });
    antes.tema = 'oscuro';
    antes.armario = 'auditorio';
    antes.avanzado = true;

    const despues = new Ajustes(new Almacen('prueba.', dentro), { raiz, medio: { matches: false } });
    if (despues.tema !== 'oscuro') fallos.push(`el tema ha vuelto a '${despues.tema}'`);
    if (despues.armario !== 'auditorio') fallos.push(`el armario ha vuelto a '${despues.armario}'`);
    if (despues.avanzado !== true) fallos.push('el avanzado ha vuelto a false');
  });

  comprueba('avanzado empieza en false, y un valor guardado que no es booleano no rompe nada', (fallos) => {
    const dentro = trastienda();
    dentro.setItem('prueba.ajustes', JSON.stringify({ avanzado: 'si' }));
    const ajustes = new Ajustes(new Almacen('prueba.', dentro), {
      raiz: document.createElement('div'),
      medio: { matches: false },
    });
    if (typeof ajustes.avanzado !== 'boolean') {
      fallos.push(`avanzado es ${typeof ajustes.avanzado} y tiene que ser boolean`);
    }
    const recien = ajustesDeMentira(almacenDeMentira());
    if (recien.avanzado !== false) fallos.push(`sin nada guardado, avanzado es ${recien.avanzado}`);
  });

  comprueba('un armario guardado que ya no existe no deja el menú sin armario', (fallos) => {
    const ajustes = ajustesDeMentira(almacenDeMentira());
    ajustes.armario = 'el-armario-de-la-abuela';
    const cual = armarioElegido(ajustes, datos.armarios);
    if (!cual || !datos.armarios[cual.id]) fallos.push('no ha caído en ningún armario de verdad');
  });
}

// --------------------------------------------------------------------------
// Las pantallas, tocándolas
// --------------------------------------------------------------------------

function pruebasDePantallas(datos, pintar, comprueba) {
  comprueba('tocar un nivel lleva a un tablero de los demostrados', (fallos) => {
    const almacen = almacenDeMentira();
    const idas = [];
    const raiz = pintar(
      pantallaMenu({
        datos,
        ajustes: ajustesDeMentira(almacen),
        progreso: new Progreso(almacen),
        ir: (destino) => idas.push(destino),
      }),
    );

    const botones = [...raiz.querySelectorAll('.tablero')];
    if (botones.length !== Object.keys(datos.plantillas).length) {
      fallos.push(`el menú enumera ${botones.length} plantillas y hay ${Object.keys(datos.plantillas).length}`);
    }
    for (const boton of botones) boton.click();

    for (const destino of idas) {
      const partes = destino.split('/').filter(Boolean);
      const plantilla = datos.plantillas[partes[1]];
      const semilla = Number(partes[3]);
      if (partes[0] !== 'tablero' || !plantilla) {
        fallos.push(`«${destino}» no lleva a ningún tablero`);
      } else if (!Number.isInteger(semilla) || semilla < 0 || semilla >= plantilla.semillas) {
        // Una semilla que no ha demostrado el resolvedor puede ser un puzle sin
        // solución, o con dos. Que el menú no las invente es lo que se mira.
        fallos.push(`«${destino}» usa una semilla que no ha demostrado nadie`);
      }
    }
    if (idas.length !== botones.length) fallos.push('algún nivel no ha llevado a ninguna parte');
  });

  comprueba('elegir otro armario se recuerda y repinta el menú', (fallos) => {
    const almacen = almacenDeMentira();
    const ajustes = ajustesDeMentira(almacen);
    const raiz = pintar(
      pantallaMenu({ datos, ajustes, progreso: new Progreso(almacen), ir: () => {} }),
    );
    const armarios = Object.values(datos.armarios);
    const antes = raiz.querySelector('.eleccion .contexto').textContent;

    const otro = raiz.querySelectorAll('.opcion')[1];
    otro.click();

    if (ajustes.armario !== armarios[1].id) fallos.push(`ha guardado '${ajustes.armario}'`);
    if (raiz.querySelector('.eleccion .contexto').textContent === antes) {
      fallos.push('el contexto del armario no ha cambiado');
    }
    if (otro.getAttribute('aria-pressed') !== 'true') fallos.push('el botón no se ha quedado pulsado');
  });

  comprueba('una plantilla que no se juega con ese armario sale desactivada', (fallos) => {
    // Hoy las cuatro se juegan con los tres, así que este caso solo existe
    // aquí. Y por eso está: es la rama que nadie vería romperse.
    const [primera, ...resto] = Object.values(datos.plantillas);
    const trucados = {
      ...datos,
      plantillas: {
        ...datos.plantillas,
        [primera.id]: { ...primera, armarios: resto.length ? primera.armarios.slice(1) : [] },
      },
    };
    const almacen = almacenDeMentira();
    const ajustes = ajustesDeMentira(almacen);
    ajustes.armario = primera.armarios[0];
    const raiz = pintar(
      pantallaMenu({ datos: trucados, ajustes, progreso: new Progreso(almacen), ir: () => {} }),
    );
    const boton = raiz.querySelector('.tablero');
    if (!boton.disabled) fallos.push('se puede abrir un tablero que no se juega con ese armario');
  });

  comprueba('borrar el progreso pregunta antes de borrar', (fallos) => {
    const progreso = progresoDeQuienVuelve(datos);
    const raiz = pintar(
      pantallaAjustes({ ajustes: ajustesDeMentira(almacenDeMentira()), progreso, atras: () => {} }),
    );
    const boton = raiz.querySelector('.peligro');

    boton.click();
    if (progreso.vacio) return fallos.push('un solo toque ya ha borrado el progreso');
    if (raiz.querySelector('.secundario').hidden) fallos.push('no ha salido cómo echarse atrás');

    raiz.querySelector('.secundario').click();
    if (progreso.vacio) fallos.push('echarse atrás ha borrado igualmente');

    boton.click();
    raiz.querySelector('.peligro').click();
    if (!progreso.vacio) fallos.push('dos toques no han borrado');
  });

  comprueba('al comprobar se anota, y comprobar cinco veces no anota cinco', (fallos) => {
    const almacen = almacenDeMentira();
    const progreso = new Progreso(almacen);
    const plantilla = datos.plantillas['n1-hs'];
    const armario = datos.armarios.aula;
    const tablero = generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), 0);
    const raiz = pintar(
      pantallaTablero({
        plantilla,
        armario,
        semilla: 0,
        instrumentos: datos.instrumentos,
        progreso,
        ir: () => {},
        atras: () => {},
      }),
    );

    const suya = (pieza) => tablero.indiceDe(pieza);
    const colocar = (pieza, casilla) => {
      raiz.querySelector(`.monton [data-pieza="${pieza.id}"]`).click();
      raiz.querySelector(`[data-casilla="${casilla}"]`).click();
    };

    const bien = tablero.piezas[0];
    const mal = tablero.piezas.find((p) => suya(p) !== suya(bien));
    const nunca = tablero.piezas.find((p) => p !== bien && p !== mal);
    colocar(bien, suya(bien));
    colocar(mal, suya(bien));

    for (let i = 0; i < 5; i++) raiz.querySelector('.principal').click();

    const acierto = progreso.pieza(bien.id, 'hs');
    const fallo = progreso.pieza(mal.id, 'hs');
    const sinTocar = progreso.pieza(nunca.id, 'hs');
    if (!iguales(acierto, { bien: 1, mal: 0 })) {
      fallos.push(`la que está bien cuenta ${JSON.stringify(acierto)}`);
    }
    if (!iguales(fallo, { bien: 0, mal: 1 })) {
      fallos.push(`la que está mal cuenta ${JSON.stringify(fallo)}`);
    }
    if (sinTocar.bien || sinTocar.mal) fallos.push('ha contado una pieza que sigue en el montón');
    if (progreso.tablero('n1-hs', 'aula').comprobados !== 1) {
      fallos.push('cinco toques en Comprobar han contado como cinco intentos');
    }
  });

  // Un recurso de mentira: basta con que sea un Node de verdad para que
  // `nombreVisible() || !recurso` de `pantalla_tablero.js` tenga algo que
  // sustituir, igual que hace una fotografía o un dibujo.
  const recursoDeMentira = () => document.createElement('span');

  comprueba('en avanzado la ficha esconde el nombre, y la pista lo revela sin penalizar', (fallos) => {
    const almacen = almacenDeMentira();
    const ajustes = ajustesDeMentira(almacen);
    ajustes.avanzado = true;
    const progreso = new Progreso(almacen);
    const plantilla = datos.plantillas['n1-hs'];
    const armario = datos.armarios.aula;
    const tablero = generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), 0);
    const raiz = pintar(
      pantallaTablero({
        plantilla,
        armario,
        semilla: 0,
        instrumentos: datos.instrumentos,
        progreso,
        recursos: recursoDeMentira,
        ajustes,
        ir: () => {},
        atras: () => {},
      }),
    );

    const pieza = tablero.piezas[0];
    const ficha = () => raiz.querySelector(`.monton [data-pieza="${pieza.id}"]`);
    ficha().click();

    if (ficha().textContent.includes(pieza.nombre)) {
      fallos.push('el nombre se ve en la ficha antes de pedir ninguna pista');
    }
    if (ficha().getAttribute('aria-label') !== pieza.nombre) {
      fallos.push(`el aria-label es '${ficha().getAttribute('aria-label')}' y no el nombre real`);
    }
    if (!raiz.querySelector('.aviso').textContent.startsWith('La pieza elegida:')) {
      fallos.push(`el aviso nombra la pieza: '${raiz.querySelector('.aviso').textContent}'`);
    }

    const pista = raiz.querySelector('.pista');
    if (!pista || pista.classList.contains('oculta') || pista.disabled) {
      fallos.push('la pista no está disponible con una pieza elegida');
      return;
    }
    pista.click();

    if (!ficha().textContent.includes(pieza.nombre)) {
      fallos.push('pedir la pista no ha revelado el nombre en la ficha');
    }
    if (!raiz.querySelector('.aviso').textContent.startsWith(pieza.nombre)) {
      fallos.push('pedir la pista no ha revelado el nombre en el aviso');
    }
    if (progreso.tablero('n1-hs', 'aula').comprobados) {
      fallos.push('pedir una pista ha anotado progreso, y no debería anotar nada');
    }

    // Una segunda pieza sigue oculta: la pista solo revela la que se pidió.
    const otra = tablero.piezas.find((p) => p !== pieza);
    if (raiz.querySelector(`.monton [data-pieza="${otra.id}"]`).textContent.includes(otra.nombre)) {
      fallos.push('revelar una pieza ha revelado también otra que no se había pedido');
    }
  });

  comprueba('el nivel 3 enseña los nombres aunque el ajuste sea avanzado', (fallos) => {
    const almacen = almacenDeMentira();
    const ajustes = ajustesDeMentira(almacen);
    ajustes.avanzado = true;
    const plantilla = datos.plantillas['n3-hs-ocultas'];
    const armario = datos.armarios.aula;
    const tablero = generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), 0);
    const raiz = pintar(
      pantallaTablero({
        plantilla,
        armario,
        semilla: 0,
        instrumentos: datos.instrumentos,
        recursos: recursoDeMentira,
        ajustes,
        ir: () => {},
        atras: () => {},
      }),
    );

    const pieza = tablero.piezas[0];
    if (!raiz.querySelector(`.monton [data-pieza="${pieza.id}"]`).textContent.includes(pieza.nombre)) {
      fallos.push('el nivel 3 esconde el nombre con el ajuste avanzado, y no debería');
    }
    if (raiz.querySelector('.pista')) {
      fallos.push('el nivel 3 ofrece una pista, y no hace falta ninguna: el nombre ya se ve');
    }
  });
}

// --------------------------------------------------------------------------
// Los dos casos que tienen que dar mal
// --------------------------------------------------------------------------

function pruebasQueTienenQueDarMal(datos, ventana, pintar, comprueba) {
  comprueba('la medida caza una pantalla que no cabe', (fallos) => {
    const larga = el(
      'main.pantalla.hoja',
      {},
      el('section.cuerpo', {}, Array.from({ length: 60 }, () => el('p', {}, 'Texto de relleno.'))),
    );
    pintar(larga);
    if (!medir(larga, ventana).problemas.length) {
      fallos.push('una pantalla de sesenta párrafos ha pasado por caber en un móvil');
    }
  });

  comprueba('la comprobación de fugas caza un dato pegado a una pieza', (fallos) => {
    const pieza = datos.instrumentos[0];
    const trucada = el('main.pantalla', {}, el('button.ficha', {
      datos: { pieza: pieza.id, hs: pieza.hs },
    }, pieza.nombre));
    if (!fugas(trucada, datos.instrumentos).length) {
      fallos.push(`una ficha con su '${pieza.hs}' en un data- ha pasado sin quejas`);
    }
  });
}

// --------------------------------------------------------------------------

async function arrancar() {
  const salida = document.getElementById('informe');
  const soloEste = new URLSearchParams(location.search).get('solo');
  const datos = await cargarTodo();

  const lineas = ['Las pantallas del armazón, en cuatro teléfonos.', ''];
  let mal = 0;
  for (const [ancho, alto, etiqueta] of TELEFONOS) {
    const resultado = await medirTelefono(ancho, alto, etiqueta, datos, soloEste);
    lineas.push(...resultado.lineas);
    mal += resultado.mal;
  }

  const ventana = (await marco(360, 640, 'donde se comprueba lo demás')).contentWindow;
  const juego = ventana.document.getElementById('juego');
  const pintar = (nodo) => {
    juego.replaceChildren();
    juego.append(nodo);
    return nodo;
  };

  function comprueba(nombre, prueba) {
    const fallos = [];
    try {
      prueba(fallos);
    } catch (fallo) {
      fallos.push(`ha lanzado: ${fallo.message}`);
    }
    mal += fallos.length;
    lineas.push(`  ${fallos.length ? 'MAL' : 'ok '} ${nombre}`);
    for (const f of fallos) lineas.push(`      x ${f}`);
  }

  lineas.push('Lo que el juego guarda, y lo que hace con ello.', '');
  pruebasDeAlmacen(comprueba);
  pruebasDeProgreso(datos, comprueba);
  pruebasDeAjustes(datos, comprueba);

  lineas.push('', 'Las pantallas nuevas, tocándolas.', '');
  pruebasDePantallas(datos, pintar, comprueba);

  lineas.push('', 'Y los dos casos que tienen que dar mal.', '');
  pruebasQueTienenQueDarMal(datos, ventana, pintar, comprueba);

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
