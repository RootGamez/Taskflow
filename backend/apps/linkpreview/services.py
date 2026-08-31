"""Vista previa de enlaces (Open Graph) obtenida desde el servidor.

Sustituye a `api.microlink.io`, al que el frontend llamaba DIRECTAMENTE
desde el navegador (ver el TODO que habia en `BookmarkExtension.tsx`).
Aquello tenia dos problemas: cada URL que alguien pegaba en un ticket se
mandaba a un tercero junto con la IP del usuario, y la vista previa
dependia de la cuota de un servicio ajeno.

Traer el fetch al servidor cambia el riesgo de sitio: ahora es el backend
quien abre conexiones a una URL que escribe el usuario, que es la
definicion de SSRF. De ahi las defensas de este modulo:

- Solo http y https. Nada de file://, gopher://, ftp:// ni data:.
- Se resuelve el DNS y se comprueba CADA IP resultante contra los rangos
  privados, de loopback, link-local (que incluye 169.254.169.254, el
  endpoint de metadatos de las nubes), reservados y multicast.
- Los redirects NO se siguen automaticamente: se validan uno a uno, con
  un tope de saltos. Si no, bastaria un 302 desde un host publico hacia
  127.0.0.1 para saltarse todo lo anterior.
- Timeout corto y lectura acotada en bytes: una respuesta infinita o muy
  lenta no debe poder bloquear un worker.
- Solo se lee `text/html`. Un PDF de 2 GB no se descarga para buscarle
  meta etiquetas que no tiene.

Queda una condicion de carrera inherente (TOCTOU): entre la resolucion
DNS y la conexion, el nombre podria repuntar a otra IP. Cerrarla del todo
exige conectar por IP y pasar el Host a mano, lo que rompe SNI y los
certificados. Para una vista previa de enlaces, el riesgo residual es
asumible; si algun dia se sirve contenido sensible desde esta red, la
mitigacion correcta es un proxy de salida con allowlist.
"""

from __future__ import annotations

import ipaddress
import socket
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

# Tiempo maximo por salto, en segundos (conexion, lectura).
REQUEST_TIMEOUT = (3.05, 5)
# Tope de reloj para TODA la operacion, redirects incluidos.
#
# El timeout de `requests` es por-lectura, no total: mide el hueco ENTRE
# paquetes, asi que un servidor que gotea un byte cada 2.5s nunca lo supera
# y mantiene la conexion abierta indefinidamente. Medido: 50s reales con
# REQUEST_TIMEOUT=(3.05, 5). Como la vista es sincrona, eso es un worker
# bloqueado por peticion, y el throttle limita tasa pero no concurrencia.
TOTAL_DEADLINE_SECONDS = 12
# Cuantos redirects se siguen antes de rendirse.
MAX_REDIRECTS = 3
# Tope de HTML leido. Las meta etiquetas viven en el <head>, asi que con
# esto sobra; evita descargarse una pagina de decenas de MB.
MAX_HTML_BYTES = 512 * 1024
# Cuanto se cachea una vista previa, en segundos.
CACHE_TTL_SECONDS = 60 * 60 * 24
# Y cuanto si hubo que seguir un redirect para llegar. La cache es comun a
# todos los usuarios y la clave es la URL que se pidio, no a donde acabo
# apuntando: quien controle un dominio que redirige puede hacer que la
# entrada guarde el Open Graph de otro sitio y servirselo a quien pegue esa
# misma URL despues. Un destino que redirige es volatil por naturaleza, asi
# que se guarda minutos en vez de un dia.
CACHE_TTL_REDIRECTED_SECONDS = 5 * 60

SAFE_SCHEMES = frozenset({"http", "https"})

# Un User-Agent identificable: los sitios que quieran bloquearnos deben
# poder hacerlo, y falsear un navegador seria hostil.
USER_AGENT = "TaskflowLinkPreview/1.0 (+https://taskflow.local)"


# Lo unico que se le dice al cliente cuando se rechaza un destino. Separar
# "no resuelve" de "resuelve a una IP interna" convertiria el endpoint en un
# oraculo de que hosts existen en la red: probando `vault.internal`,
# `k8s-dashboard.corp`... el mensaje delataria cuales son reales.
GENERIC_REJECTION = "No se pudo generar la vista previa de ese enlace."


class UnsafeUrlError(ValueError):
    """La URL apunta a un sitio al que el servidor no debe conectarse.

    Lleva dos mensajes a proposito: el de la excepcion es el detallado, para
    logs y tests, y `public_message` es el unico que puede cruzar hasta el
    cliente (ver `GENERIC_REJECTION`).
    """

    def __init__(self, message: str, public_message: str = GENERIC_REJECTION) -> None:
        super().__init__(message)
        self.public_message = public_message


class UnreadablePageError(Exception):
    """Se llego al destino, pero no hay metadatos que sacar de ahi.

    Distinta de `UnsafeUrlError` a proposito: el enlace es legitimo y no hay
    nada que denunciar al usuario. Un PDF publico, o una cadena de redirects
    demasiado larga, entran aqui y degradan a la vista previa minima -- antes
    daban un 400 y la tarjeta se pintaba rota, cuando un simple 404 si
    degradaba bien.
    """


@dataclass(frozen=True)
class LinkPreview:
    url: str
    title: str = ""
    description: str = ""
    image: str = ""
    site_name: str = ""
    # Fuera de `as_dict`: no es para el cliente, sino para que la vista sepa
    # que este resultado vino de seguir un redirect y lo cachee menos tiempo.
    redirected: bool = False

    def as_dict(self) -> dict[str, str]:
        return {
            "url": self.url,
            "title": self.title,
            "description": self.description,
            "image": self.image,
            "site_name": self.site_name,
        }


# IPv6 "site-local" (RFC 4291), deprecado por RFC 3879 pero aun vivo en
# alguna red legada. `ipaddress` no lo marca ni como privado ni como
# reservado, asi que sin esta comprobacion `fec0::1` pasaria por publico.
LEGACY_SITE_LOCAL_V6 = ipaddress.ip_network("fec0::/10")


def _is_public_ip(raw_ip: str) -> bool:
    try:
        ip = ipaddress.ip_address(raw_ip)
    except ValueError:
        return False
    # `is_global` ya excluye privadas, loopback, link-local y reservadas,
    # pero se comprueban aparte por claridad y por si cambia su semantica.
    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    ):
        return False
    return not (ip.version == 6 and ip in LEGACY_SITE_LOCAL_V6)


def assert_url_is_safe(url: str) -> str:
    """Valida esquema y destino. Devuelve la URL normalizada.

    Raises:
        UnsafeUrlError: si el esquema no es http(s), falta el host, el DNS
            no resuelve o CUALQUIERA de las IPs resueltas no es publica.
    """
    parsed = urlparse(url)

    # Estos dos si se le pueden contar al cliente: describen la URL que acaba
    # de escribir, no la topologia de la red.
    if parsed.scheme not in SAFE_SCHEMES:
        message = "Solo se admiten enlaces http y https."
        raise UnsafeUrlError(message, public_message=message)
    if not parsed.hostname:
        message = "La URL no tiene host."
        raise UnsafeUrlError(message, public_message=message)

    try:
        resolved = socket.getaddrinfo(parsed.hostname, parsed.port or None)
    except socket.gaierror as exc:
        raise UnsafeUrlError("No se pudo resolver el dominio.") from exc

    addresses = {info[4][0] for info in resolved}
    if not addresses:
        raise UnsafeUrlError("No se pudo resolver el dominio.")

    # TODAS las IPs tienen que ser publicas: un dominio puede resolver a
    # varias, y basta una privada para que la peticion acabe dentro.
    for address in addresses:
        if not _is_public_ip(address):
            raise UnsafeUrlError("El enlace apunta a una direccion no permitida.")

    return url


class _MetaTagParser(HTMLParser):
    """Extrae Open Graph, Twitter Cards y el <title>.

    Se usa `html.parser` de la stdlib y no BeautifulSoup para no anadir una
    dependencia por unas pocas meta etiquetas. Deja de parsear al cerrar el
    <head>: todo lo que interesa vive ahi.
    """

    #  Propiedad de la meta -> clave del resultado. Open Graph tiene
    #  prioridad sobre Twitter, y ambos sobre el <title>.
    _META_KEYS = {
        "og:title": "title",
        "og:description": "description",
        "og:image": "image",
        "og:site_name": "site_name",
        "twitter:title": "title",
        "twitter:description": "description",
        "twitter:image": "image",
        "description": "description",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.data: dict[str, str] = {}
        self._in_title = False
        self._done = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if self._done:
            return
        if tag == "title":
            self._in_title = True
            return
        if tag != "meta":
            return

        attributes = {key.lower(): (value or "") for key, value in attrs}
        # OG usa `property`; Twitter y la meta clasica usan `name`.
        key = (attributes.get("property") or attributes.get("name") or "").lower()
        content = attributes.get("content", "").strip()
        target = self._META_KEYS.get(key)

        # `setdefault`: la primera aparicion gana, y como OG suele ir antes
        # que Twitter, se respeta la prioridad sin ordenar nada.
        if target and content:
            self.data.setdefault(target, content)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag == "head":
            self._done = True

    def handle_data(self, data: str) -> None:
        if self._in_title and not self._done:
            stripped = data.strip()
            if stripped:
                self.data.setdefault("html_title", stripped)


def _fetch_html(url: str) -> tuple[str, str]:
    """Descarga el HTML siguiendo redirects a mano.

    Returns:
        `(html, url_final)`.

    Raises:
        UnsafeUrlError: si algun salto apunta a un destino no permitido.
        requests.RequestException: fallos de red.
    """
    session = requests.Session()
    current = assert_url_is_safe(url)
    deadline = time.monotonic() + TOTAL_DEADLINE_SECONDS

    for _ in range(MAX_REDIRECTS + 1):
        if time.monotonic() > deadline:
            # `Timeout` y no `UnsafeUrlError`: la URL no tiene nada de malo,
            # simplemente tarda. `build_link_preview` lo trata como fallo de
            # red y devuelve la vista previa minima.
            raise requests.Timeout("La vista previa tardo demasiado.")

        response = session.get(
            current,
            timeout=REQUEST_TIMEOUT,
            # Clave: cada salto se valida antes de seguirlo. Con
            # `allow_redirects=True`, un 302 a 127.0.0.1 desde un host
            # publico se saltaria toda la validacion de arriba.
            allow_redirects=False,
            stream=True,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
        )

        if response.is_redirect or response.is_permanent_redirect:
            location = response.headers.get("Location", "")
            response.close()
            if not location:
                raise UnreadablePageError("Redireccion sin destino.")
            current = assert_url_is_safe(urljoin(current, location))
            continue

        try:
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if "html" not in content_type.lower():
                raise UnreadablePageError("El enlace no es una pagina web.")

            # Lectura acotada: `stream=True` + corte manual, para que una
            # respuesta enorme o sin fin no agote la memoria del worker.
            chunks: list[bytes] = []
            total = 0
            for chunk in response.iter_content(8192):
                # El tope de bytes no basta: goteando por debajo del timeout
                # de lectura se puede estirar la descarga sin fin.
                if time.monotonic() > deadline:
                    raise requests.Timeout("La vista previa tardo demasiado.")
                chunks.append(chunk)
                total += len(chunk)
                if total >= MAX_HTML_BYTES:
                    break

            raw = b"".join(chunks)
            # `requests` copia el `charset=` de la cabecera sin validarlo, y
            # un nombre de codec inexistente hace que `decode` lance
            # `LookupError` pese al `errors="replace"`. Como la cabecera la
            # controla la pagina remota, sin esto cualquier sitio podria
            # provocar un 500 a voluntad.
            encoding = response.encoding or "utf-8"
            try:
                html = raw.decode(encoding, errors="replace")
            except (LookupError, UnicodeError):
                html = raw.decode("utf-8", errors="replace")
            return html, current
        finally:
            response.close()

    raise UnreadablePageError("Demasiadas redirecciones.")


def build_link_preview(url: str) -> LinkPreview:
    """Obtiene la vista previa de una URL. No lanza por fallos de red.

    Si la pagina no responde o no trae metadatos, se devuelve una vista
    previa minima con el host: el frontend siempre puede pintar algo.

    Raises:
        UnsafeUrlError: solo si la URL en si no es admisible.
    """
    safe_url = assert_url_is_safe(url)
    host = urlparse(safe_url).hostname or ""

    try:
        html, final_url = _fetch_html(safe_url)
    except UnreadablePageError:
        # Se llego, pero no hay metadatos: un PDF, una imagen suelta, una
        # cadena de redirects demasiado larga. El enlace es bueno, asi que se
        # pinta la tarjeta con el host en vez de darle un error al usuario.
        return LinkPreview(url=safe_url, title=host, site_name=host)
    except UnsafeUrlError:
        raise
    except requests.RequestException:
        return LinkPreview(url=safe_url, title=host, site_name=host)

    parser = _MetaTagParser()
    try:
        parser.feed(html)
    except Exception:  # HTML roto: no debe tumbar la peticion
        pass

    data = parser.data
    image = data.get("image", "")
    if image:
        # Las imagenes de OG suelen venir relativas.
        image = urljoin(final_url, image)
        try:
            assert_url_is_safe(image)
        except UnsafeUrlError:
            # Una imagen que apunta dentro de la red no se ofrece al
            # navegador; el resto de la vista previa sigue siendo util.
            image = ""

    return LinkPreview(
        url=final_url,
        title=data.get("title") or data.get("html_title") or host,
        description=data.get("description", ""),
        image=image,
        site_name=data.get("site_name") or host,
        redirected=final_url != safe_url,
    )
