"""Tests de `apps/linkpreview/services.py`.

El grueso son casos de SSRF: este modulo abre conexiones salientes hacia
una URL que escribe el usuario, asi que la validacion del destino es la
parte que de verdad importa. Pytest plano sin DB, como
`apps/tickets/test_rich_text.py`.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from apps.linkpreview.services import (
    UnsafeUrlError,
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
