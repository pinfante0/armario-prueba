// Compara el generador de JavaScript con el de Python, tablero a tablero.
//
// Esta es la comprobación que le faltaba al contrato de datos. `resolver.py`
// demuestra que todos los tableros tienen solución única, pero lo demuestra sobre
// los tableros que genera Python; si el navegador generase otros, esa
// demostración no diría nada sobre el juego que alguien juega. Y las dos
// mitades pueden separarse por cosas muy pequeñas —un `sorted` con otro
// criterio, una llamada de más al generador de azar— sin que nada se rompa a
// gritos: simplemente saldrían tableros distintos.
//
// Cómo funciona: `herramientas/comparar_generadores.py` escribe en
// `tableros_esperados.json` el azar y la huella de cada tablero según Python, y
// esta página vuelve a generarlos aquí y compara. Se puede abrir a mano en un
// navegador, y la corre sola el mismo script con Chrome sin ventana.
//
// Y va en tres pasadas, de lo pequeño a lo grande, porque un fallo en la
// primera explica los de las otras dos: primero que la comparación sabe fallar,
// después el azar suelto, y solo entonces los tableros.

import { fnv1a, mulberry32 } from '../js/nucleo/azar.js';
import { cargarTodo, disponiblesPara } from '../js/datos.js';
import { generar, huella } from '../js/generador.js';

const ESPERADOS = new URL('./tableros_esperados.json', import.meta.url);

// --------------------------------------------------------------------------
// 1. Que esta comparación sabe fallar
// --------------------------------------------------------------------------
// Es la lección de `autoprueba()` en resolver.py, aplicada aquí: si la
// comparación no fuera sensible a la forma más típica de romper esto, saldría
// en verde estando rota y nadie se enteraría. Así que se rompe a propósito.
//
// Este es el error de verdad, no uno inventado: en JavaScript el `*` de siempre
// pasa por coma flotante y pierde los bits bajos en cuanto el producto supera
// 2^53, que es exactamente lo que hace mulberry32. Es el motivo de que el
// generador use Math.imul, y quien lo «simplifique» tiene que encontrarse esto.

function mulberry32Ingenuo(semilla) {
  let estado = semilla >>> 0;
  return function siguiente() {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = (t ^ (t >>> 15)) * (t | 1);
    t ^= t + (t ^ (t >>> 7)) * (t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sabeFallar(muestras) {
  for (const { texto, fnv1a: siembra, tiradas } of muestras) {
    const roto = mulberry32Ingenuo(siembra);
    for (const esperada of tiradas) {
      if (roto() !== esperada) return { pasa: true, texto };
    }
  }
  return {
    pasa: false,
    texto:
      'ninguna de las muestras distingue mulberry32 de la versión con `*`, ' +
      'así que esta comparación ya no demuestra nada',
  };
}

// --------------------------------------------------------------------------
// 2. El azar, suelto
// --------------------------------------------------------------------------

function compararAzar(muestras) {
  const problemas = [];
  for (const { texto, fnv1a: siembra, tiradas } of muestras) {
    const mio = fnv1a(texto);
    if (mio !== siembra) {
      problemas.push(`FNV-1a de ${JSON.stringify(texto)}: Python ${siembra}, aquí ${mio}`);
      continue;
    }
    const rng = mulberry32(siembra);
    for (let i = 0; i < tiradas.length; i++) {
      const obtenida = rng();
      if (obtenida !== tiradas[i]) {
        problemas.push(
          `mulberry32(${siembra}) tirada ${i + 1}: Python ${tiradas[i]}, aquí ${obtenida}` +
            `  (sembrado con ${JSON.stringify(texto)})`,
        );
        break;
      }
    }
  }
  return problemas;
}

// --------------------------------------------------------------------------
// 3. Los tableros
// --------------------------------------------------------------------------

export function compararTableros(esperados, datos) {
  const diferencias = [];
  let iguales = 0;

  for (const caso of esperados.tableros) {
    const plantilla = datos.plantillas[caso.plantilla];
    const armario = datos.armarios[caso.armario];
    if (!plantilla || !armario) {
      diferencias.push({
        caso,
        motivo: `aquí no existe ${plantilla ? 'el armario' : 'la plantilla'}`,
        obtenida: '',
      });
      continue;
    }

    let obtenida;
    try {
      obtenida = huella(
        generar(plantilla, armario, disponiblesPara(plantilla, datos.instrumentos), caso.semilla),
      );
    } catch (fallo) {
      diferencias.push({ caso, motivo: `no se ha podido generar: ${fallo.message}`, obtenida: '' });
      continue;
    }

    if (obtenida === caso.huella) iguales++;
    else diferencias.push({ caso, motivo: 'la huella no coincide', obtenida });
  }

  return { total: esperados.tableros.length, iguales, diferencias };
}

/** Qué línea de la huella es la primera que difiere. Es lo que se lee. */
function primeraLineaDistinta(esperada, obtenida) {
  const a = esperada.split('\n');
  const b = obtenida.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return [`      Python:     ${a[i] ?? '(nada)'}`, `      JavaScript: ${b[i] ?? '(nada)'}`];
    }
  }
  return [];
}

// --------------------------------------------------------------------------

function informe(esperados, datos) {
  const lineas = [
    'Comparando los dos generadores, tablero a tablero.',
    `Las huellas de Python las escribió ${esperados.generado_por}`,
    '',
  ];
  let mal = 0;

  const sabe = sabeFallar(esperados.azar);
  lineas.push(
    `  ${sabe.pasa ? 'ok ' : 'MAL'} la comparación sabe fallar: ` +
      (sabe.pasa
        ? `mulberry32 con \`*\` en vez de Math.imul ya se separa en ${JSON.stringify(sabe.texto)}`
        : sabe.texto),
  );
  if (!sabe.pasa) mal++;

  const azar = compararAzar(esperados.azar);
  lineas.push(
    `  ${azar.length ? 'MAL' : 'ok '} el azar: ${esperados.azar.length} semillas y ` +
      `${esperados.azar.reduce((n, m) => n + m.tiradas.length, 0)} tiradas`,
  );
  for (const p of azar) lineas.push(`      x ${p}`);
  mal += azar.length;

  const { total, iguales, diferencias } = compararTableros(esperados, datos);
  lineas.push(`  ${diferencias.length || !total ? 'MAL' : 'ok '} los tableros: ` +
    `${total} generados, ${iguales} iguales, ${diferencias.length} distintos`);
  for (const d of diferencias.slice(0, 20)) {
    lineas.push(`      x ${d.caso.plantilla} / ${d.caso.armario} / semilla ${d.caso.semilla}: ${d.motivo}`);
    if (d.obtenida) lineas.push(...primeraLineaDistinta(d.caso.huella, d.obtenida));
  }
  if (diferencias.length > 20) lineas.push(`      ... y ${diferencias.length - 20} más`);
  mal += diferencias.length + (total ? 0 : 1);

  lineas.push('');
  lineas.push(`ESTADO: ${mal === 0 ? 'PASA' : 'NO PASA'}`);
  return lineas.join('\n');
}

async function arrancar() {
  const salida = document.getElementById('informe');
  try {
    const respuesta = await fetch(ESPERADOS);
    if (!respuesta.ok) {
      throw new Error(
        `falta pruebas/tableros_esperados.json (${respuesta.status}). ` +
          'Lo escribe: python herramientas/comparar_generadores.py',
      );
    }
    const esperados = await respuesta.json();
    const datos = await cargarTodo();
    salida.textContent = informe(esperados, datos);
  } catch (fallo) {
    salida.textContent = `${fallo.message}\n\nESTADO: NO PASA`;
  }
  salida.dataset.estado = salida.textContent.trimEnd().endsWith('ESTADO: PASA') ? 'pasa' : 'no-pasa';
}

arrancar();
