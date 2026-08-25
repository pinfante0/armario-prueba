// El arranque: quién vive mientras dure la pestaña y qué ruta pinta qué.
//
// Cinco rutas y tres cosas guardadas. Las tres se construyen aquí, una sola
// vez, y se les pasan a las pantallas: una pantalla que se busque el progreso
// por su cuenta es una pantalla que no se puede pintar en una prueba sin
// tocarle el navegador a alguien.
//
// El orden de las dos primeras líneas importa. Los ajustes se construyen antes
// de cargar los datos porque al construirse aplican el tema, y cargar tres
// archivos JSON delante dejaría un instante de pantalla clara antes de ponerse
// oscura.

import { Navegacion } from './nucleo/navegacion.js';
import { Almacen } from './nucleo/almacen.js';
import { Ajustes } from './ajustes.js';
import { Progreso } from './progreso.js';
import { cargarTodo } from './datos.js';
import { cargarRecursos } from './recursos.js';
import { cargarFichas } from './fichas.js';
import { pantallaMenu } from './pantalla_menu.js';
import { pantallaTablero } from './pantalla_tablero.js';
import { pantallaAjustes } from './pantalla_ajustes.js';
import { pantallaCreditos } from './pantalla_creditos.js';
import { pantallaProgreso } from './pantalla_progreso.js';

const almacen = new Almacen();
const ajustes = new Ajustes(almacen);
const progreso = new Progreso(almacen);

// Los recursos van con los datos y no detrás: cargarlos después dejaría un
// instante de fichas sin nada que luego dan un salto de alto, que es el mismo
// motivo por el que los ajustes se construyen antes que nada. Y si los archivos
// no están, esto devuelve una función que no da ninguno y se juega con nombres.
//
// Esperar aquí es esperar al sprite y al índice de las fotografías, que son dos
// archivos pequeños; las fotografías en sí las pide cada `<img>` cuando la ficha
// ya está puesta, así que una imagen que tarde no retrasa el arranque. Y
// `fichas.json`, desde la 6.7, por el mismo motivo: es texto, no fotografías.
const [datos, { recurso: recursos, foto }, fichas] = await Promise.all([
  cargarTodo(),
  cargarRecursos(),
  cargarFichas(),
]);
const nav = new Navegacion(document.getElementById('juego'));

// Cuántas pantallas lleva pintadas esta pestaña. Sirve para una cosa sola: el
// botón de volver. Con historial propio se vuelve por él, y así quien llegó a
// los ajustes desde una partida no se come el menú de vuelta; sin él se va al
// menú, que es el caso de quien abre un enlace directo o un código QR.
let pintadas = 0;

function contar(dibujar) {
  return (contexto) => {
    pintadas += 1;
    return dibujar(contexto);
  };
}

const atras = () => (pintadas > 1 ? nav.atras() : nav.ir('/', { reemplazar: true }));

nav.ruta(
  '/',
  contar(({ ir }) => pantallaMenu({ datos, ajustes, progreso, ir })),
);

nav.ruta(
  '/tablero/:plantilla/:armario/:semilla',
  contar(({ params, ir }) => {
    const plantilla = datos.plantillas[params.plantilla];
    const armario = datos.armarios[params.armario];
    if (!plantilla) throw new Error(`no hay ninguna plantilla '${params.plantilla}'`);
    if (!armario) throw new Error(`no hay ningún armario '${params.armario}'`);
    if (!plantilla.armarios.includes(armario.id)) {
      throw new Error(`la plantilla '${plantilla.id}' no se juega con el armario '${armario.id}'`);
    }

    return pantallaTablero({
      plantilla,
      armario,
      semilla: Number(params.semilla),
      instrumentos: datos.instrumentos,
      progreso,
      recursos,
      foto,
      fichas,
      ajustes,
      ir,
      atras,
    });
  }),
);

nav.ruta(
  '/ajustes',
  contar(() => pantallaAjustes({ ajustes, progreso, atras })),
);

nav.ruta(
  '/creditos',
  contar(() => pantallaCreditos({ atras })),
);

nav.ruta(
  '/progreso',
  contar(() => pantallaProgreso({ datos, progreso, atras })),
);

nav.arrancar();
