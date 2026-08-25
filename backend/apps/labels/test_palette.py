from __future__ import annotations

import pytest

from apps.labels.palette import LABEL_COLORS, is_valid_label_color


def test_label_colors_has_between_eight_and_ten_entries():
    assert 8 <= len(LABEL_COLORS) <= 10


def test_label_colors_are_unique():
    assert len(set(LABEL_COLORS)) == len(LABEL_COLORS)


@pytest.mark.parametrize("color", LABEL_COLORS)
def test_label_colors_are_uppercase_hex(color: str):
    assert color.startswith("#")
    assert len(color) == 7
    assert color == color.upper()
    int(color[1:], 16)  # no lanza ValueError si es hex valido


def test_is_valid_label_color_true_for_palette_entry():
    assert is_valid_label_color(LABEL_COLORS[0]) is True


def test_is_valid_label_color_false_for_arbitrary_hex():
    assert is_valid_label_color("#123456") is False


def test_is_valid_label_color_false_for_lowercase_variant_of_valid_entry():
    assert is_valid_label_color(LABEL_COLORS[0].lower()) is False


def test_is_valid_label_color_false_for_empty_string():
    assert is_valid_label_color("") is False
