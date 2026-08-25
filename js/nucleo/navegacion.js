// La navegación: rutas en el fragmento de la dirección.
//
// Copiado de Intervalos (Videojuegos/Piloto_videojuego), donde llevaba desde el
// 31/07/2026. Lo único que se cambió son los ejemplos y el enlace de la pantalla
// de fallo; el mecanismo no sabe de intervalos ni de instrumentos.
//
// Todo va detrás de la almohadilla —`#/armario/3`— porque el juego se publica
// como archivos estáticos y no hay servidor que reescriba rutas. A cambio salen
// gratis dos cosas que en un aula se usan: el botón de atrás del navegador
// funciona, y una pantalla concreta se puede dejar enlazada o en un código QR.
//
// Una pantalla es una función que devuelve un nodo. Si además necesita limpiar
// algo al marcharse —parar un temporizador, soltar un listener— devuelve
// `{ nodo, alSalir }`.

import { vaciar } from './dom.js';

export class Navegacion {
  #rutas = [];
  #contenedor;
  #alSalir = null;
  #actual = null;

  constructor(contenedor) {
    this.#contenedor = contenedor;
  }

  /**
   * Registra una pantalla.
   *
   *     nav.ruta('/armario/:id', ({ params }) => pantallaArmario(+params.id));
   */
  ruta(patron, pantalla) {
    const partes = patron.split('/').filter(Boolean);
    this.#rutas.push({ patron, partes, pantalla });
    return this;
  }

  /** La ruta que se está mostrando, sin la almohadilla. */
  get actual() {
    return this.#actual;
  }

  ir(destino, { reemplazar = false } = {}) {
    const url = `#${destino}`;
    if (reemplazar) location.replace(url);
    else location.hash = url.slice(1);
  }

  atras() {
    history.back();
  }

  arrancar() {
    addEventListener('hashchange', () => this.#pintar());
    this.#pintar();
  }

  #emparejar(camino) {
    const partes = camino.split('/').filter(Boolean);
    for (const ruta of this.#rutas) {
      if (ruta.partes.length !== partes.length) continue;
      const params = {};
      const encaja = ruta.partes.every((trozo, i) => {
        if (trozo.startsWith(':')) {
          params[trozo.slice(1)] = decodeURIComponent(partes[i]);
          return true;
        }
        return trozo === partes[i];
      });
      if (encaja) return { ruta, params };
    }
    return null;
  }

  async #pintar() {
    // Lo primero, dejar salir a la pantalla anterior. Si esto no se hiciera, un
    // toque en «atrás» durante una partida dejaría el piano sonando y el
    // temporizador del contrarreloj corriendo por detrás.
    try {
      this.#alSalir?.();
    } catch (fallo) {
      console.error('Al salir de la pantalla anterior:', fallo);
    }
    this.#alSalir = null;

    const bruto = location.hash.slice(1) || '/';
    const [camino, consulta = ''] = bruto.split('?');
    this.#actual = camino;

    const encontrada = this.#emparejar(camino);
    if (!encontrada) {
      this.ir('/', { reemplazar: true });
      return;
    }

    const contexto = {
      params: encontrada.params,
      consulta: new URLSearchParams(consulta),
      ir: (destino, opciones) => this.ir(destino, opciones),
    };

    let resultado;
    try {
      resultado = await encontrada.ruta.pantalla(contexto);
    } catch (fallo) {
      console.error(fallo);
      resultado = pantallaDeFallo(fallo);
    }

    const nodo = resultado?.nodo ?? resultado;
    this.#alSalir = resultado?.alSalir ?? null;

    vaciar(this.#contenedor);
    if (nodo) this.#contenedor.append(nodo);
    scrollTo(0, 0);
    // El foco al contenedor: sin esto, quien navega con teclado o con lector de
    // pantalla se queda donde estaba y no se entera de que ha cambiado todo.
    this.#contenedor.focus({ preventScroll: true });
  }
}

function pantallaDeFallo(fallo) {
  const seccion = document.createElement('section');
  seccion.className = 'tarjeta fallo';
  const titulo = document.createElement('h2');
  titulo.textContent = 'Algo se ha roto';
  const detalle = document.createElement('p');
  detalle.textContent = String(fallo?.message ?? fallo);
  const salida = document.createElement('p');
  const enlace = document.createElement('a');
  enlace.href = '#/';
  enlace.textContent = 'Volver al principio';
  salida.append(enlace);
  seccion.append(titulo, detalle, salida);
  return seccion;
}
