"""Admin API tests for quantization endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from opta_lmx.manager.quantize import QuantizeJob


@pytest.mark.asyncio
async def test_start_quantize_returns_queue_metadata(client: AsyncClient) -> None:
    job = QuantizeJob(
        job_id="job-1",
        source_model="org/model",
        output_path="/tmp/out",
        bits=4,
        group_size=64,
        mode="affine",
        status="queued",
        queue_position=1,
    )

    with patch(
        "opta_lmx.manager.quantize.start_quantize",
        new=AsyncMock(return_value=job),
    ):
        resp = await client.post(
            "/admin/quantize",
            json={"source_model": "org/model", "bits": 4, "group_size": 64, "mode": "affine"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["job_id"] == "job-1"
    assert body["status"] == "queued"
    assert body["queue_position"] == 1
    assert body["cancel_requested"] is False


@pytest.mark.asyncio
async def test_cancel_quantize_not_found_returns_404(client: AsyncClient) -> None:
    with patch(
        "opta_lmx.manager.quantize.cancel_quantize",
        new=AsyncMock(return_value=(False, "not_found", None)),
    ):
        resp = await client.post("/admin/quantize/missing/cancel")

    assert resp.status_code == 404
    body = resp.json()
    assert body["cancelled"] is False
    assert body["job_id"] == "missing"


@pytest.mark.asyncio
async def test_cancel_quantize_running_returns_202(client: AsyncClient) -> None:
    job = QuantizeJob(
        job_id="job-2",
        source_model="org/model",
        output_path="/tmp/out",
        status="cancelling",
        cancel_requested=True,
        cancel_requested_at=1.0,
    )

    with patch(
        "opta_lmx.manager.quantize.cancel_quantize",
        new=AsyncMock(return_value=(False, "cancelling", job)),
    ):
        resp = await client.post("/admin/quantize/job-2/cancel")

    assert resp.status_code == 202
    body = resp.json()
    assert body["reason"] == "cancelling"
    assert body["cancel_requested"] is True
    assert body["cancel_requested_at"] == 1.0


@pytest.mark.asyncio
async def test_list_quantize_jobs_includes_mode_and_queue_fields(client: AsyncClient) -> None:
    job = QuantizeJob(
        job_id="job-3",
        source_model="org/model",
        output_path="/tmp/out",
        bits=8,
        group_size=32,
        mode="mxfp8",
        status="queued",
        queue_position=2,
    )

    with patch("opta_lmx.manager.quantize.list_jobs", return_value=[job]):
        resp = await client.get("/admin/quantize")

    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 1
    first = body["jobs"][0]
    assert first["mode"] == "mxfp8"
    assert first["group_size"] == 32
    assert first["queue_position"] == 2
    assert first["cancel_requested"] is False
