from __future__ import annotations

import pytest

from apps.projects.key_utils import derive_project_key


def test_derives_initials_from_multi_word_name():
    assert derive_project_key("Task Flow App", set()) == "TFA"


def test_strips_accents_before_deriving_key():
    assert derive_project_key("Diseno Grafico", set()) == "DG"


def test_single_word_name_uses_the_word_itself():
    assert derive_project_key("Marketing", set()) == "MARKETING"


def test_single_word_name_is_truncated_to_max_length():
    key = derive_project_key("Superextraordinario", set())
    assert key == "SUPEREXTRA"
    assert len(key) == 10


def test_empty_name_falls_back_to_task():
    assert derive_project_key("", set()) == "TASK"


def test_symbols_only_name_falls_back_to_task():
    assert derive_project_key("!!! ??? ---", set()) == "TASK"


def test_whitespace_only_name_falls_back_to_task():
    assert derive_project_key("   ", set()) == "TASK"


def test_collision_appends_numeric_suffix():
    assert derive_project_key("Task Flow App", {"TFA"}) == "TFA2"


def test_collision_skips_taken_numeric_suffixes():
    assert derive_project_key("Task Flow App", {"TFA", "TFA2", "TFA3"}) == "TFA4"


def test_fallback_collision_increments_from_task():
    taken = {"TASK", "TASK2"}
    assert derive_project_key("", taken) == "TASK3"


def test_result_always_matches_expected_shape():
    key = derive_project_key("123 Numeric Start", set())
    assert key[0].isalpha()
    assert key.isupper()


def test_max_length_respected_even_with_numeric_suffix():
    long_name = "Superextraordinario"
    taken = {"SUPEREXTRA"}
    key = derive_project_key(long_name, taken)
    assert key == "SUPEREXTR2"
    assert len(key) == 10


@pytest.mark.parametrize(
    "name,expected",
    [
        ("A", "A"),
        ("Ana", "ANA"),
    ],
)
def test_very_short_names(name, expected):
    assert derive_project_key(name, set()) == expected
