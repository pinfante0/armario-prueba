// Que «Ver de cerca» quepa en un teléfono, y que el violonchelo caiga bien.
//
// El visor es una pantalla más de este juego, así que cumple la regla de todas:
// no se desplaza. Y tiene un caso que no es una molestia sino el que había que
// resolver: una pieza sin detalle —el violonchelo, cuya fuente no da 1024 px sin
// ampliar— no puede quedarse con la lupa vacía ni pedir un 404. Cae a su
// miniatura, y eso se comprueba mirando qué `src` acaba pidiendo.
//
// No depende del tablero: el visor tapa la pantalla y enseña una sola foto, así
// que lo que decide si cabe son el teléfono, el lado de la foto —siempre
// cuadrada— y el nombre. Por eso se mide aquí y no dentro de los 1440 tableros
// de `pantalla.js`, donde lo único que se mide del visor es el sitio que su lupa
// reserva en la cabecera.
//
// Cada teléfono es un <iframe> del tamaño exacto, por lo mismo que en las demás
// páginas: Chrome no baja de 500 px de ancho de ventana.

import { cargarTodo, disponiblesPara } from '../js/datos.js';
import { cargarFotografias } from '../js/fotografias.js';
import { cargarFichas } from '../js/fichas.js';
import { cargarIconos } from '../js/iconos.js';
import { combinar } from '../js/recursos.js';
import { generar } from '../js/generador.js';
import { pantallaTablero } from '../js/pantalla_tablero.js';
import { crearVisor } from '../js/visor.js';
import { marco } from './marco.js';
import { TELEFONOS } from './medidas.js';
import { ordenarColocando, ordenarIntercambiando, principal, aviso } from './jugadas.js';

const TOLERANCIA = 0.5;
const TACTIL = 44; // 2,75rem, el mínimo con el que un dedo acierta

// Las piezas que se abren: todas las que tienen fotografía. Interesa la de
// nombre más largo —el peor caso del pie— y, sobre todo, el violonchelo.
const PIEZAS = ['violin', 'viola', 'violonchelo', 'contrabajo', 'clarinete', 'ondas-martenot'];

/** Espera a que la fotografía cargue, para que su caja midurada sea la de verdad. */
function cargada(img) {
  if (img.complete && img.naturalWidth) return Promise.resolve();
  return new Promise((listo) => {
    img.addEventListener('load', listo, { once: true });
    img.addEventListener('error', listo, { once: true });
  });
}

/** Cuánto se sale del marco el nodo que más se sale, por cualquier lado. */
function seSale(capa, ventana) {
  let fuera = 0;
  for (const nodo of capa.querySelectorAll('*')) {
    const r = nodo.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    fuera = Math.max(fuera, -r.top, -r.left, r.right - ventana.innerWidth, r.bottom - ventana.innerHeight);
  }
  return fuera;
}

async function medirPieza(visor, capa, ventana, pieza, fotos) {
  const problemas = [];
  // true: el nombre visible es el peor caso para el pie del visor, y es el que
  // interesa medir aquí. Que el avanzado pueda ocultarlo no cambia el alto que
  // hay que dejarle cuando sí se enseña.
  visor.abrir(pieza.id, pieza.nombre, true, null);
  const img = capa.querySelector('.visor-foto');
  await cargada(img);

  // 1. Que no se salga nada.
  const fuera = seSale(capa, ventana);
  if (fuera > TOLERANCIA) problemas.push(`se sale ${Math.ceil(fuera)} px`);
  if (ventana.document.documentElement.scrollWidth > ventana.innerWidth + TOLERANCIA) {
    problemas.push('el documento se desplaza de lado');
  }
  if (ventana.document.documentElement.scrollHeight > ventana.innerHeight + TOLERANCIA) {
    problemas.push('el documento se desplaza a lo alto');
  }

  // 2. Que el aspa de cerrar sea un objetivo táctil de verdad.
  const cerrar = capa.querySelector('.visor-cerrar');
  const c = cerrar.getBoundingClientRect();
  if (c.width < TACTIL - TOLERANCIA || c.height < TACTIL - TOLERANCIA) {
    problemas.push(`el aspa de cerrar mide ${Math.round(c.width)}×${Math.round(c.height)} px`);
  }

  // 3. Que se pida la fotografía que toca: el detalle si lo hay, la miniatura si
  //    no. Es el caso del violonchelo.
  const src = img.getAttribute('src') || '';
  const hayDetalle = fotos.tieneDetalle(pieza.id);
  const esDetalle = /\/detalle\/[^/]+\.webp$/.test(src);
  if (hayDetalle && !esDetalle) problemas.push('tiene detalle y no lo carga');
  if (!hayDetalle && esDetalle) problemas.push('no tiene detalle y sin embargo lo pide');
  if (!hayDetalle && !src.endsWith(`${pieza.id}.webp`)) {
    problemas.push('sin detalle, no cae a su miniatura');
  }

  // 4. Que del visor no salga más que el nombre.
  const texto = capa.textContent;
  for (const dato of [pieza.hs, ...(pieza.usos || []), pieza.familia].filter(Boolean)) {
    if (texto.includes(dato)) problemas.push(`sale su '${dato}'`);
  }
  if (!texto.includes(pieza.nombre)) problemas.push('no enseña el nombre');

  const lado = Math.round(img.getBoundingClientRect().width);
  visor.cerrar();
  return { problemas, lado };
}

async function medirTelefono(ancho, alto, etiqueta, datos, fotos) {
  const lineas = [`  ${ancho}×${alto}, ${etiqueta}`];
  const ventana = (await marco(ancho, alto, etiqueta)).contentWindow;
  const capaEn = ventana.document.getElementById('juego');
  const visor = crearVisor({ foto: fotos, montarEn: capaEn });
  const capa = capaEn.querySelector('.visor');

  let mal = 0;
  let lado = 0;
  for (const id of PIEZAS) {
    const pieza = datos.instrumentos.find((p) => p.id === id);
    if (!pieza) {
      lineas.push(`    MAL ${id}: no está en el catálogo`);
      mal += 1;
      continue;
    }
    const medida = await medirPieza(visor, capa, ventana, pieza, fotos);
    lado = Math.max(lado, medida.lado);
    if (medida.problemas.length) {
      mal += medida.problemas.length;
      lineas.push(`    MAL ${pieza.nombre}: ${medida.problemas.join('; ')}`);
    } else {
      const que = fotos.tieneDetalle(id) ? 'detalle' : 'miniatura';
      lineas.push(`    ok  ${pieza.nombre.padEnd(16)} cabe, cierra y pide su ${que}`);
    }
  }
  // A cuántos px de lado se ve la foto: es el número que dice si 1024 sobra o
  // falta. El cuadrado llena la misma caja para todas, así que basta uno.
  if (lado) lineas.push(`    la foto se ve a ${lado} px de lado (el detalle trae 1024)`);
  lineas.push('');
  return { lineas, mal };
}

/**
 * La lupa de verdad, montada en un tablero: seleccionar enseña la lupa, la lupa
 * abre el visor con el detalle que toca, y ni abrir ni cerrar tocan la partida.
 *
 * Es lo que las medidas de arriba no ven: aquellas abren el visor a mano, y esto
 * lo abre por donde lo abre quien juega. Se corre una vez —el cableado no depende
 * del tamaño— dentro de un marco cualquiera.
 */
async function integracion(datos, fotos, ventana) {
  const problemas = [];
  const doc = ventana.document;
  const juego = doc.getElementById('juego');
  const recursos = combinar(fotos.nodo, await cargarIconos(doc));
  const conFoto = PIEZAS.filter((id) => fotos.tieneFoto(id));

  // El primer tablero que traiga una pieza con fotografía.
  let elegido = null;
  fuera: for (const plantilla of Object.values(datos.plantillas)) {
    for (const idArmario of plantilla.armarios) {
      for (let semilla = 0; semilla < plantilla.semillas; semilla++) {
        juego.replaceChildren();
        const nodo = pantallaTablero({
          plantilla,
          armario: datos.armarios[idArmario],
          semilla,
          instrumentos: datos.instrumentos,
          recursos,
          foto: fotos,
          ir: () => {},
          atras: () => {},
        });
        juego.append(nodo);
        const id = conFoto.find((x) => nodo.querySelector(`.ficha[data-pieza="${x}"]`));
        if (id) {
          elegido = { nodo, id };
          break fuera;
        }
      }
    }
  }
  if (!elegido) return ['    no hay ningún tablero con una pieza fotografiada'];

  const { nodo, id } = elegido;
  const lupa = nodo.querySelector('.lupa');
  const ficha = () => nodo.querySelector(`.ficha[data-pieza="${id}"]`);
  const detalle = fotos.tieneDetalle(id);

  if (!lupa) return ['    no hay lupa en la cabecera'];
  if (!lupa.classList.contains('oculta')) problemas.push('la lupa se ve sin selección');

  ficha().click(); // seleccionar, como un toque
  if (lupa.classList.contains('oculta') || lupa.disabled) {
    problemas.push('la lupa no aparece al seleccionar una pieza con foto');
  }

  lupa.click(); // abrir el visor
  const capa = nodo.querySelector('.visor');
  const img = capa?.querySelector('.visor-foto');
  const src = img?.getAttribute('src') || '';
  if (!capa || capa.hidden) problemas.push('la lupa no abre el visor');
  if (detalle ? !/\/detalle\//.test(src) : !src.endsWith(`${id}.webp`)) {
    problemas.push(`el visor no carga la foto que toca: ${src}`);
  }
  if (!ficha()?.classList.contains('elegida')) problemas.push('abrir el visor ha perdido la selección');
  if (doc.activeElement !== capa?.querySelector('.visor-cerrar')) {
    problemas.push('el foco no fue al aspa de cerrar');
  }

  // Escape cierra y devuelve el foco a la ficha.
  capa?.dispatchEvent(new ventana.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  if (capa && !capa.hidden) problemas.push('Escape no cierra el visor');
  if (doc.activeElement !== ficha()) problemas.push('al cerrar, el foco no vuelve a la ficha');

  return problemas.length
    ? problemas.map((p) => `    MAL ${p}`)
    : [`    ok  seleccionar enseña la lupa, la lupa abre el visor de ${id}, y cerrar no toca la partida`];
}

/**
 * «Ver ficha», desde la 6.7: que el candado sea de verdad el del tablero
 * completo y no el de una balda o una selección cualquiera, y que lo que
 * enseña no destripe nada.
 *
 * Se resuelve un tablero entero a base de toques —con la segunda vuelta si la
 * plantilla la lleva, igual que `jugar.js`— porque es la única forma de que
 * `correccion.final` sea verdadero de verdad y no una condición simulada. La
 * regla de siempre: nada de esto le pregunta nada a `Partida` por dentro.
 */
async function integracionFicha(datos, fotos, fichas, ventana) {
  const problemas = [];
  const doc = ventana.document;
  const juego = doc.getElementById('juego');

  // La primera pieza con fotografía y ficha, en el primer tablero que la lleve
  // y no vaya atado al Tema 7 -para no reducir de más las plantillas donde
  // buscar-. Se evita `n3-hs-ocultas`: sin rótulos la solución la da
  // `solucion()` igual, así que no hace falta excluirla aparte.
  let elegido = null;
  fuera: for (const plantilla of Object.values(datos.plantillas)) {
    for (const idArmario of plantilla.armarios) {
      for (let semilla = 0; semilla < plantilla.semillas; semilla++) {
        const tablero = generar(
          plantilla,
          datos.armarios[idArmario],
          disponiblesPara(plantilla, datos.instrumentos),
          semilla,
        );
        const id = tablero.piezas.find((p) => fotos.tieneFoto(p.id) && fichas.tieneFicha(p.id))?.id;
        if (id) {
          elegido = { plantilla, armario: datos.armarios[idArmario], semilla, id };
          break fuera;
        }
      }
    }
  }
  if (!elegido) return ['    no hay ningún tablero con una pieza fotografiada y con ficha'];

  const { plantilla, armario, semilla, id } = elegido;
  const recursos = combinar(fotos.nodo, await cargarIconos(doc));
  juego.replaceChildren();
  const nodo = pantallaTablero({
    plantilla,
    armario,
    semilla,
    instrumentos: datos.instrumentos,
    recursos,
    foto: fotos,
    fichas,
    ir: () => {},
    atras: () => {},
  });
  juego.append(nodo);

  const botonesFicha = () => [...nodo.querySelectorAll('.ver-ficha-boton')];
  const capa = nodo.querySelector('.visor');

  // 1. A media partida no hay resultado, así que no puede haber ningún botón
  //    «Ver ficha»: el candado es el tablero entero y no una pieza suelta.
  if (botonesFicha().length) {
    problemas.push('«Ver ficha» aparece antes de terminar el armario');
  }

  // 2. Se resuelve el tablero entero, con la segunda vuelta si la lleva.
  const fallosDeJuego = [];
  const tablero = generar(
    plantilla,
    armario,
    disponiblesPara(plantilla, datos.instrumentos),
    semilla,
  );
  ordenarColocando(nodo, tablero, fallosDeJuego);
  principal(nodo).click();
  if (tablero.recambio) {
    principal(nodo).click(); // da la vuelta a los rótulos
    ordenarIntercambiando(nodo, tablero.recambio, fallosDeJuego);
    principal(nodo).click();
  }
  if (fallosDeJuego.length || aviso(nodo).dataset.estado !== 'bien') {
    return [`    no se ha podido terminar el armario: ${fallosDeJuego.join('; ') || aviso(nodo).textContent}`];
  }

  // 3. Ahora sí: el resultado ofrece un botón «Ver ficha» por pieza con foto y
  //    ficha, y ninguno pasa por seleccionar nada de `Partida`.
  const pieza = datos.instrumentos.find((p) => p.id === id);
  const boton = botonesFicha().find((b) => b.textContent === pieza.nombre);
  if (!boton) {
    problemas.push('con el armario terminado, no hay botón «Ver ficha» para esta pieza');
    return problemas.map((p) => `    MAL ${p}`);
  }

  // 4. Al pedirla, se abre directamente en la ficha —sin foto primero— y lo
  //    que enseña no nombra la clasificación de la pieza ni su código.
  boton.click();
  const marcoFoto = capa.querySelector('.visor-marco');
  const panel = capa.querySelector('.visor-ficha');
  if (capa.hidden) problemas.push('«Ver ficha» no abre el visor');
  if (!marcoFoto.hidden) problemas.push('«Ver ficha» abre mostrando la fotografía y no la ficha');
  if (panel.hidden || !panel.textContent.trim()) problemas.push('la ficha se pide y no enseña nada');

  const texto = panel.textContent;
  for (const dato of [pieza.hs, pieza.hs_codigo, ...(pieza.usos || []), pieza.familia].filter(Boolean)) {
    if (texto.includes(dato)) problemas.push(`la ficha enseña '${dato}'`);
  }
  const datosFicha = fichas.datosDe(id);
  if (datosFicha?.fotografia?.autor && !texto.includes(datosFicha.fotografia.autor)) {
    problemas.push('la ficha no enseña el autor de la fotografía');
  }

  // 5. Con el mismo botón se ve la fotografía, y Tab recorre los dos
  //    controles del visor sin salirse de él.
  const botonVisor = capa.querySelector('.visor-ficha-boton');
  botonVisor.click();
  if (marcoFoto.hidden) problemas.push('«Ver ficha» no deja ver la fotografía al alternar');
  doc.activeElement.blur();
  botonVisor.focus();
  capa.dispatchEvent(new ventana.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  if (doc.activeElement !== capa.querySelector('.visor-cerrar')) {
    problemas.push('Tab desde «Ver ficha» no lleva al aspa de cerrar');
  }

  // 6. Al cerrar, el foco vuelve al botón de la lista y no a ningún control
  //    del tablero: «Ver ficha» no se abrió seleccionando nada.
  capa.dispatchEvent(new ventana.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  if (!capa.hidden) problemas.push('Escape no cierra el visor de la ficha');
  if (doc.activeElement !== boton) problemas.push('al cerrar, el foco no vuelve al botón «Ver ficha»');

  return problemas.length
    ? problemas.map((p) => `    MAL ${p}`)
    : ['    ok  el candado se abre al terminar el armario, y la ficha no destripa nada'];
}

async function arrancar() {
  const salida = document.getElementById('informe');
  const datos = await cargarTodo();
  const fotos = await cargarFotografias();
  const fichas = await cargarFichas();

  const lineas = ['«Ver de cerca», en cada teléfono.', ''];
  let mal = 0;
  for (const [ancho, alto, etiqueta] of TELEFONOS) {
    const resultado = await medirTelefono(ancho, alto, etiqueta, datos, fotos);
    lineas.push(...resultado.lineas);
    mal += resultado.mal;
  }

  // El cableado de la lupa, una vez, en un marco cualquiera.
  const ventana = (await marco(390, 844, 'la lupa montada en un tablero')).contentWindow;
  lineas.push('  la lupa, montada en un tablero de verdad');
  const filas = await integracion(datos, fotos, ventana);
  lineas.push(...filas);
  if (filas.some((f) => f.includes('MAL'))) mal += filas.filter((f) => f.includes('MAL')).length;
  lineas.push('');

  // «Ver ficha»: la recompensa documental, en su propio marco.
  const ventanaFicha = (await marco(390, 844, 'la ficha documental al terminar el armario'))
    .contentWindow;
  lineas.push('  «Ver ficha», al terminar el armario');
  const filasFicha = await integracionFicha(datos, fotos, fichas, ventanaFicha);
  lineas.push(...filasFicha);
  if (filasFicha.some((f) => f.includes('MAL'))) {
    mal += filasFicha.filter((f) => f.includes('MAL')).length;
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
