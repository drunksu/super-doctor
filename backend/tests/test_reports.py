"""Marker parsing is pure logic — cheap to test, expensive to get wrong."""

from __future__ import annotations

from app.services.reports import extract_text, parse_markers, sample_text


def test_parse_typical_panel() -> None:
    markers = parse_markers(sample_text())
    by_name = {marker["name"]: marker for marker in markers}
    assert by_name["低密度脂蛋白胆固醇"]["value"] == "4.2"
    assert by_name["低密度脂蛋白胆固醇"]["status"] == "high"
    assert by_name["甘油三酯"]["status"] == "high"
    assert by_name["血红蛋白"]["status"] == "normal"
    assert by_name["血尿酸"]["status"] == "normal"


def test_reference_strings_are_rendered() -> None:
    markers = parse_markers("总胆固醇 6.1 mmol/L")
    assert markers[0]["reference"] == "< 5.2"


def test_unknown_text_yields_no_markers() -> None:
    assert parse_markers("今天天气不错，心情也挺好") == []


def test_image_files_are_rejected_with_guidance() -> None:
    text, error = extract_text("report.png", b"\x89PNG\r\n")
    assert text == ""
    assert error and "PDF" in error
