"""Schema-focused tests for quantization request validation."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from opta_lmx.inference.schema import QuantizeRequest


def test_quantize_request_defaults_are_stable() -> None:
    req = QuantizeRequest(source_model="org/model")
    assert req.source_model == "org/model"
    assert req.output_path is None
    assert req.bits == 4
    assert req.group_size == 64
    assert req.mode == "affine"


@pytest.mark.parametrize("bits", [0, 7, 16, -4])
def test_quantize_request_rejects_invalid_bits(bits: int) -> None:
    with pytest.raises(ValidationError, match="bits must be one of"):
        QuantizeRequest(source_model="org/model", bits=bits)


def test_quantize_request_accepts_supported_mode() -> None:
    req = QuantizeRequest(
        source_model="org/model",
        bits=4,
        group_size=32,
        mode="mxfp4",
    )
    assert req.mode == "mxfp4"
    assert req.group_size == 32


def test_quantize_request_rejects_unknown_mode() -> None:
    with pytest.raises(ValidationError) as exc:
        QuantizeRequest(source_model="org/model", mode="symmetric")
    errors = exc.value.errors()
    assert errors
    assert errors[0]["loc"] == ("mode",)


def test_quantize_request_rejects_non_positive_group_size() -> None:
    with pytest.raises(ValidationError) as exc:
        QuantizeRequest(source_model="org/model", group_size=0)

    errors = exc.value.errors()
    assert errors
    assert errors[0]["loc"] == ("group_size",)


def test_quantize_request_rejects_mode_specific_group_size() -> None:
    with pytest.raises(ValidationError, match="group_size=64 is not supported for mode='nvfp4'"):
        QuantizeRequest(
            source_model="org/model",
            bits=4,
            group_size=64,
            mode="nvfp4",
        )
