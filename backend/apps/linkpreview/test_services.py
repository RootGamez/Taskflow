"""Tests de `apps/linkpreview/services.py`.

El grueso son casos de SSRF: este modulo abre conexiones salientes hacia
una URL que escribe el usuario, asi que la validacion del destino es la
parte que de verdad importa. Pytest plano sin DB, como
`apps/tickets/test_rich_text.py`.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
import requests

from apps.linkpreview.services import (
    MAX_HTML_BYTES,
    MAX_REDIRECTS,
    TOTAL_DEADLINE_SECONDS,
    UnsafeUrlError,
    _fetch_html,
    _MetaTagParser,
    assert_url_is_safe,
    build_link_preview,
)


def _resolves_to(*addresses: str):
    """Simula `socket.getaddrinfo` devolviendo las IPs dadas."""
    return [(2, 1, 6, "", (address, 443)) for address in addresses]


# --- Esquemas -----------------------------------------------------------------


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "ftp://ejemplo.com/x",
        "gopher://ejemplo.com/",
        "data:text/html,<h1>hola</h1>",
        "javascript:alert(1)",
    ],
)
def test_rejects_non_http_schemes(url):
    with pytest.raises(UnsafeUrlError, match="http"):
        assert_url_is_safe(url)


def test_rejects_a_url_without_host():
    with pytest.raises(UnsafeUrlError, match="host"):
        assert_url_is_safe("https:///sin-host")


# --- Destinos internos (SSRF) -------------------------------------------------


@pytest.mark.parametrize(
    ("label", "address"),
    [
        ("loopback ipv4", "127.0.0.1"),
        ("loopback ipv6", "::1"),
        ("privada 10.x", "10.0.0.5"),
        ("privada 172.16.x", "172.16.3.4"),
        ("privada 192.168.x", "192.168.1.10"),
        ("metadatos de la nube", "169.254.169.254"),
        ("link-local ipv6", "fe80::1"),
        ("sin especificar", "0.0.0.0"),
        # `ipaddress` no marca este bloque ni como privado ni como reservado,
        # asi que sin la comprobacion explicita pasaba por publico.
        ("site-local ipv6 heredado", "fec0::1"),
        ("site-local ipv6 heredado, final del rango", "feff::1"),
    ],
)
def test_rejects_urls_that_resolve_to_internal_addresses(label, address):
    with patch("apps.linkpreview.services.socket.getaddrinfo", return_value=_resolves_to(address)):
        with pytest.raises(UnsafeUrlError, match="no permitida"):
            assert_url_is_safe("https://parece-publico.com/")


def test_rejects_when_only_one_of_several_addresses_is_internal():
    # Un dominio puede resolver a varias IPs. Basta una interna para que la
    # peticion pueda acabar dentro de la red, asi que se rechaza entero.
    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        return_value=_resolves_to("93.184.216.34", "127.0.0.1"),
    ):
        with pytest.raises(UnsafeUrlError, match="no permitida"):
            assert_url_is_safe("https://mixto.com/")


def test_accepts_a_url_that_resolves_to_a_public_address():
    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        return_value=_resolves_to("93.184.216.34"),
    ):
        assert assert_url_is_safe("https://ejemplo.com/x") == "https://ejemplo.com/x"


def test_rejects_a_domain_that_does_not_resolve():
    import socket as socket_module

    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        side_effect=socket_module.gaierror("no such host"),
    ):
        with pytest.raises(UnsafeUrlError, match="resolver"):
            assert_url_is_safe("https://no-existe.invalid/")


# --- Parseo de metadatos ------------------------------------------------------


def test_extracts_open_graph_tags():
    parser = _MetaTagParser()
    parser.feed(
        '<html><head>'
        '<meta property="og:title" content="Titulo OG">'
        '<meta property="og:description" content="Descripcion OG">'
        '<meta property="og:image" content="https://cdn.ejemplo.com/a.png">'
        '<meta property="og:site_name" content="Ejemplo">'
        "</head></html>"
    )

    assert parser.data["title"] == "Titulo OG"
    assert parser.data["description"] == "Descripcion OG"
    assert parser.data["image"] == "https://cdn.ejemplo.com/a.png"
    assert parser.data["site_name"] == "Ejemplo"


def test_open_graph_wins_over_twitter_when_both_are_present():
    parser = _MetaTagParser()
    parser.feed(
        '<html><head>'
        '<meta property="og:title" content="Desde OG">'
        '<meta name="twitter:title" content="Desde Twitter">'
        "</head></html>"
    )

    assert parser.data["title"] == "Desde OG"


def test_falls_back_to_twitter_cards_when_there_is_no_open_graph():
    parser = _MetaTagParser()
    parser.feed('<html><head><meta name="twitter:title" content="Solo Twitter"></head></html>')

    assert parser.data["title"] == "Solo Twitter"


def test_captures_the_html_title_separately():
    parser = _MetaTagParser()
    parser.feed("<html><head><title>Titulo del documento</title></head></html>")

    assert parser.data["html_title"] == "Titulo del documento"


def test_stops_parsing_after_head_closes():
    parser = _MetaTagParser()
    parser.feed(
        "<html><head><title>Bueno</title></head>"
        '<body><meta property="og:title" content="Inyectado en el body"></body></html>'
    )

    assert parser.data.get("title") is None
    assert parser.data["html_title"] == "Bueno"


# --- build_link_preview -------------------------------------------------------


def test_returns_a_minimal_preview_when_the_page_does_not_respond():
    import requests

    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        return_value=_resolves_to("93.184.216.34"),
    ):
        with patch(
            "apps.linkpreview.services._fetch_html",
            side_effect=requests.ConnectionError("timeout"),
        ):
            preview = build_link_preview("https://ejemplo.com/roto")

    # Nunca lanza por un fallo de red: el frontend siempre puede pintar algo.
    assert preview.url == "https://ejemplo.com/roto"
    assert preview.title == "ejemplo.com"
    assert preview.site_name == "ejemplo.com"


def test_resolves_relative_open_graph_images_against_the_final_url():
    html = '<html><head><meta property="og:image" content="/media/portada.png"></head></html>'

    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        return_value=_resolves_to("93.184.216.34"),
    ):
        with patch(
            "apps.linkpreview.services._fetch_html",
            return_value=(html, "https://ejemplo.com/articulo/"),
        ):
            preview = build_link_preview("https://ejemplo.com/articulo/")

    assert preview.image == "https://ejemplo.com/media/portada.png"


def test_drops_an_image_that_points_inside_the_network():
    # Una pagina publica no debe poder hacer que el navegador del usuario
    # pida una imagen a la red interna.
    html = '<html><head><meta property="og:image" content="http://127.0.0.1:8000/secreto.png"></head></html>'

    def resolve(hostname, *args, **kwargs):
        return _resolves_to("127.0.0.1" if hostname == "127.0.0.1" else "93.184.216.34")

    with patch("apps.linkpreview.services.socket.getaddrinfo", side_effect=resolve):
        with patch(
            "apps.linkpreview.services._fetch_html",
            return_value=(html, "https://ejemplo.com/"),
        ):
            preview = build_link_preview("https://ejemplo.com/")

    assert preview.image == ""


def test_marks_the_preview_as_redirected_so_the_view_caches_it_less():
    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        return_value=_resolves_to("93.184.216.34"),
    ):
        with patch(
            "apps.linkpreview.services._fetch_html",
            return_value=("<html><head></head></html>", "https://otro-destino.com/final"),
        ):
            preview = build_link_preview("https://acortador.com/x")

    assert preview.redirected is True


def test_does_not_mark_as_redirected_when_the_url_did_not_change():
    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        return_value=_resolves_to("93.184.216.34"),
    ):
        with patch(
            "apps.linkpreview.services._fetch_html",
            return_value=("<html><head></head></html>", "https://ejemplo.com/x"),
        ):
            preview = build_link_preview("https://ejemplo.com/x")

    assert preview.redirected is False


# --- Mensajes hacia el cliente ------------------------------------------------


def test_a_rejected_destination_does_not_reveal_why_to_the_client():
    # Distinguir "no resuelve" de "resuelve a una IP interna" delataria que
    # hosts existen en la red. El detalle se conserva para los logs.
    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        return_value=_resolves_to("10.0.0.5"),
    ):
        with pytest.raises(UnsafeUrlError) as internal:
            assert_url_is_safe("https://interno.corp/")

    import socket as socket_module

    with patch(
        "apps.linkpreview.services.socket.getaddrinfo",
        side_effect=socket_module.gaierror("no such host"),
    ):
        with pytest.raises(UnsafeUrlError) as unknown:
            assert_url_is_safe("https://no-existe.invalid/")

    assert internal.value.public_message == unknown.value.public_message
    assert "no permitida" not in internal.value.public_message


def test_the_scheme_error_is_specific_because_it_describes_the_url():
    with pytest.raises(UnsafeUrlError) as exc:
        assert_url_is_safe("file:///etc/passwd")

    assert "http" in exc.value.public_message


# --- _fetch_html: redirects, tipo de contenido y limites ----------------------


class _FakeResponse:
    """Lo justo de `requests.Response` que consume `_fetch_html`."""

    def __init__(self, *, status=200, headers=None, chunks=(), encoding="utf-8"):
        self.status_code = status
        self.headers = headers or {"Content-Type": "text/html"}
        self.encoding = encoding
        self._chunks = chunks
        self.closed = False

    @property
    def is_redirect(self):
        return self.status_code in (301, 302, 303, 307, 308)

    is_permanent_redirect = False

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"HTTP {self.status_code}")

    def iter_content(self, size):
        yield from self._chunks

    def close(self):
        self.closed = True


def _session_returning(*responses):
    """Parchea `Session.get` para que devuelva las respuestas dadas en orden."""
    calls = []

    def fake_get(self, url, **kwargs):
        calls.append(url)
        return responses[len(calls) - 1]

    return patch.object(requests.Session, "get", fake_get), calls


PUBLIC_DNS = patch(
    "apps.linkpreview.services.socket.getaddrinfo",
    return_value=_resolves_to("93.184.216.34"),
)


def test_revalidates_every_redirect_hop():
    # Un 302 desde un host publico hacia 127.0.0.1 es la via clasica para
    # saltarse la validacion inicial.
    redirect = _FakeResponse(status=302, headers={"Location": "http://127.0.0.1/admin"})
    session, _ = _session_returning(redirect)

    def resolve(hostname, *args, **kwargs):
        return _resolves_to("127.0.0.1" if hostname == "127.0.0.1" else "93.184.216.34")

    with patch("apps.linkpreview.services.socket.getaddrinfo", side_effect=resolve):
        with session:
            with pytest.raises(UnsafeUrlError, match="no permitida"):
                _fetch_html("https://publico.com/")


def test_follows_a_redirect_to_another_public_host():
    redirect = _FakeResponse(status=302, headers={"Location": "https://destino.com/final"})
    page = _FakeResponse(chunks=[b"<html><head><title>Ok</title></head></html>"])
    session, calls = _session_returning(redirect, page)

    with PUBLIC_DNS, session:
        html, final_url = _fetch_html("https://origen.com/")

    assert final_url == "https://destino.com/final"
    assert "Ok" in html
    assert calls == ["https://origen.com/", "https://destino.com/final"]


def test_gives_up_after_too_many_redirects():
    hops = [
        _FakeResponse(status=302, headers={"Location": f"https://salto{i}.com/"})
        for i in range(MAX_REDIRECTS + 1)
    ]
    session, _ = _session_returning(*hops)

    with PUBLIC_DNS, session:
        with pytest.raises(UnsafeUrlError, match="[Dd]emasiadas"):
            _fetch_html("https://origen.com/")


def test_rejects_a_response_that_is_not_html():
    pdf = _FakeResponse(headers={"Content-Type": "application/pdf"}, chunks=[b"%PDF-1.7"])
    session, _ = _session_returning(pdf)

    with PUBLIC_DNS, session:
        with pytest.raises(UnsafeUrlError, match="pagina web"):
            _fetch_html("https://ejemplo.com/manual.pdf")


def test_stops_reading_at_the_byte_cap():
    # Una pagina enorme no debe descargarse entera: las meta etiquetas viven
    # en el <head>.
    huge = _FakeResponse(chunks=[b"x" * 8192] * 1000)
    session, _ = _session_returning(huge)

    with PUBLIC_DNS, session:
        html, _ = _fetch_html("https://ejemplo.com/enorme")

    assert len(html) < MAX_HTML_BYTES + 8192


def test_falls_back_to_utf8_when_the_page_declares_a_bogus_charset():
    # `requests` copia el `charset=` de la cabecera sin validarlo, y un codec
    # inexistente hace que `.decode` lance `LookupError` pese al
    # `errors="replace"`. Sin esto, la pagina remota fuerza un 500.
    page = _FakeResponse(chunks=[b"<html><head><title>Hola</title></head></html>"], encoding="bogus-xyz")
    session, _ = _session_returning(page)

    with PUBLIC_DNS, session:
        html, _ = _fetch_html("https://ejemplo.com/")

    assert "Hola" in html


# --- Deadline total -----------------------------------------------------------


class _Clock:
    """Reloj monotono falso, para no dormir de verdad en los tests."""

    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now

    def advance(self, seconds):
        self.now += seconds


def test_aborts_when_the_whole_operation_exceeds_the_deadline():
    # El timeout de `requests` es por-lectura: un servidor que gotea bytes
    # por debajo de ese umbral mantiene viva la conexion indefinidamente.
    clock = _Clock()

    def trickle(size):
        for _ in range(100):
            clock.advance(TOTAL_DEADLINE_SECONDS / 4)
            yield b"x" * 16

    page = _FakeResponse()
    page.iter_content = trickle
    session, _ = _session_returning(page)

    with PUBLIC_DNS, session:
        with patch("apps.linkpreview.services.time.monotonic", clock):
            with pytest.raises(requests.Timeout):
                _fetch_html("https://gotea.com/")


def test_aborts_when_the_redirect_chain_exceeds_the_deadline():
    clock = _Clock()
    hops = [
        _FakeResponse(status=302, headers={"Location": f"https://salto{i}.com/"})
        for i in range(MAX_REDIRECTS + 1)
    ]
    session, _ = _session_returning(*hops)

    def slow_get(self, url, **kwargs):
        clock.advance(TOTAL_DEADLINE_SECONDS)
        return hops[0]

    with PUBLIC_DNS:
        with patch.object(requests.Session, "get", slow_get):
            with patch("apps.linkpreview.services.time.monotonic", clock):
                with pytest.raises(requests.Timeout):
                    _fetch_html("https://lento.com/")


def test_a_slow_page_degrades_to_the_minimal_preview_instead_of_failing():
    # El deadline no debe romper la respuesta al usuario: se pinta la tarjeta
    # con el host y ya.
    with PUBLIC_DNS:
        with patch(
            "apps.linkpreview.services._fetch_html",
            side_effect=requests.Timeout("demasiado"),
        ):
            preview = build_link_preview("https://lento.com/x")

    assert preview.title == "lento.com"
