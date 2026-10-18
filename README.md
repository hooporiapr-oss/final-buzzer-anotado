# Anotado

Manejo de promesas para retos con marcador automático.
Gostar Digital LLC · Puerto Rico

## Qué es, y en qué se diferencia de Cada Punto

Los dos son sistemas de manejo de promesas y los dos tienen la misma
posición: **nosotros manejamos las promesas, el programa maneja los
fondos.** Sin custodia, sin procesar pagos, licencia por evento.

La diferencia está en de dónde salen los puntos:

| | Cada Punto | Anotado |
|---|---|---|
| Los puntos | del marcador de un juego de verdad | del juego, por jugador |
| Quién los anota | un representante del programa | el juego, mientras se juega |
| Cuándo | el día del partido | la ventana que ponga el programa |
| Dónde | en la cancha | en la cancha o en casa, desde el teléfono |
| La promesa | por punto del equipo | por punto de ese jugador |

Lo que el grupo focal prefirió de Anotado: el marcador es automático
y por jugador. Nadie mete un número, así que no hay nada que
perseguir ni nada que discutir.

## Lo que NO cambia respecto a Cada Punto

- No recibimos dinero de nadie.
- No hay columna de pagado, y no la va a haber.
- Un solo aviso al padrino al cerrar: los puntos y su total. Sin
  enlace de pago y sin recordatorios.
- Licencia por evento, gratis hasta que cierra, facturada al cerrar y
  pagadera en siete días. Si no se paga, la licencia de ese evento
  caduca y los datos de promesas se eliminan.
- Nada de reclamos de deducibilidad de impuestos. Nunca.

## El precio

Un número, en `index.html`:

```js
const FEE = { team: 49, small: 29, under: 8 };
```

Las dos traducciones lo recogen de ahí. Cambiarlo es una línea.

## Estado

Hecho:
- `index.html` — la portada, con su prueba (`prueba_index.js`).
- Páginas del juego, tal como estaban: `fortress.html`,
  `fortress131.html`, `fortress-vr.html`. (`scoring.html` se quitó: lo
  que explicaba lo dicen mejor la portada y la ayuda, y no estaba
  enlazada desde ningún sitio.)
- `prometer.html` — la página donde el padrino promete.
- `tablero.html`, `jugador.html`, `padrinos.html` — recuperadas del
  historial de cognitivo-digital-challenge (la versión del modelo por
  jugador, antes de que se reescribieran para el marcador de equipo).
  **Todavía con la piel oscura vieja.**

Falta:
- `equipo.html`, `mi-equipo.html`, `plantilla.html`
- `custodia.html`, `terms.html`, `privacy.html`, `cobro.html`, `ayuda.html`
- `reporte.html` y la función `challenge_report()` en SQL
- La piel nueva en las tres recuperadas
- Un favicon y una imagen para compartir; hasta entonces el `<head>`
  no apunta a ninguna de las dos a propósito.

## La base de datos

El mismo proyecto de Supabase que Cada Punto: el mismo entrenador, la
misma plantilla, la misma tabla de licencias (`bw_requests`), y las
tablas de retos que ya estaban ahí con `record_official_run`.

Un jugador termina su corrida y el juego llama:

```
record_official_run(p_challenge, p_player, p_key, p_level, p_points,
                    p_time, p_game)
```

La clave de la corrida se comprueba dentro de la base de datos, así
que tener el enlace público no basta para cerrarle la corrida a otro.
