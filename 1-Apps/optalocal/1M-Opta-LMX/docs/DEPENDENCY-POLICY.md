# Dependency Policy — 1M Opta LMX

Canonical standard: `../../docs/standards/DEPENDENCY-LIFECYCLE.md`

## Commands

### Check
```bash
source .venv/bin/activate
python -m ensurepip --upgrade
python -m pip list --outdated
python -m pip check
```

### Safe upgrade (patch/minor)
```bash
source .venv/bin/activate
python -m ensurepip --upgrade
python -m pip install -U pip
python -m pip install -e .
python -m pip check
python -m compileall -q src
```

### Major upgrade (scheduled only)
1. Update bounded versions in `pyproject.toml`
2. Rebuild environment:
```bash
rm -rf .venv
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -U pip
python -m pip install -e .
```
3. Run verification gate.

## Verification Gate
```bash
source .venv/bin/activate
python -m ensurepip --upgrade
python -m pip check
python -m compileall -q src
pytest -q
```

## Coupled packages (upgrade together)
- vllm-mlx
- mlx / mlx-lm / mlx-vlm
- fastapi / uvicorn / pydantic
