"""
User profile storage and management for Opta's adaptive intelligence.

Handles persistence of user preferences, hardware signature, and learned patterns.
Storage location: ~/.opta/profiles/main_profile.json
"""

import json
import os
import platform
import sys
import time
import uuid
import tempfile
import shutil
from dataclasses import dataclass, asdict, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import psutil

# Profile storage directory
PROFILE_DIR = Path.home() / ".opta" / "profiles"
PROFILE_FILE = PROFILE_DIR / "main_profile.json"


@dataclass
class HardwareSignature:
    """Hardware identification for system fingerprinting."""
    cpu: str
    gpu: Optional[str]
    ram_gb: float
    platform: str


@dataclass
class OptimizationPattern:
    """Learned pattern from user's optimization history."""
    pattern_type: str  # 'preference' | 'aversion' | 'timing'
    setting_category: str  # 'graphics' | 'launch_options' | 'priority'
    setting_key: str
    confidence: float  # 0-1
    sample_count: int
    description: str
    last_updated: float


@dataclass
class UserProfile:
    """Main user profile with preferences, hardware, and learned patterns."""
    id: str
    created_at: float
    updated_at: float

    # User preferences
    user_mode: str  # 'simple' | 'standard' | 'power'
    optimization_depth: str  # 'efficient' | 'thorough' | 'optimised'
    communication_style: str  # 'informative' | 'concise'

    # Hardware identification
    hardware_signature: Dict[str, Any]

    # Learned patterns
    patterns: List[Dict[str, Any]] = field(default_factory=list)

    # Statistics
    total_optimizations: int = 0
    total_games_optimized: int = 0
    optimizations_accepted: int = 0
    optimizations_reverted: int = 0


def get_hardware_signature() -> Dict[str, Any]:
    """
    Detect current hardware to create system fingerprint.

    Returns:
        Dictionary with cpu, gpu, ram_gb, and platform fields.
    """
    # CPU detection
    cpu_info = platform.processor()
    if not cpu_info:
        # Fallback: try to get CPU brand
        try:
            import cpuinfo
            cpu_info = cpuinfo.get_cpu_info().get('brand_raw', 'Unknown CPU')
        except ImportError:
            cpu_info = f"{psutil.cpu_count(logical=False)} cores @ {psutil.cpu_freq().max if psutil.cpu_freq() else 0:.0f}MHz"

    # GPU detection (use existing GPUtil pattern)
    gpu_info = None
    try:
        import GPUtil
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu_info = gpus[0].name
    except ImportError:
        pass

    if not gpu_info:
        # Try pynvml
        try:
            import pynvml
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            gpu_info = pynvml.nvmlDeviceGetName(handle)
            if isinstance(gpu_info, bytes):
                gpu_info = gpu_info.decode('utf-8')
            pynvml.nvmlShutdown()
        except Exception:
            pass

    if not gpu_info and sys.platform == 'darwin':
        # macOS: use system_profiler
        try:
            import subprocess
            result = subprocess.run(
                ['system_profiler', 'SPDisplaysDataType', '-json'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                displays = data.get('SPDisplaysDataType', [])
                if displays:
                    gpu_info = displays[0].get('sppci_model', None)
        except Exception:
            pass

    # RAM detection
    ram_gb = round(psutil.virtual_memory().total / (1024 ** 3), 1)

    # Platform detection
    platform_map = {
        'darwin': 'macos',
        'win32': 'windows',
        'linux': 'linux'
    }
    current_platform = platform_map.get(sys.platform, 'linux')

    return {
        'cpu': cpu_info,
        'gpu': gpu_info,
        'ram_gb': ram_gb,
        'platform': current_platform
    }


def _ensure_profile_dir():
    """Create profile directory if it doesn't exist."""
    PROFILE_DIR.mkdir(parents=True, exist_ok=True)


def _atomic_write(path: Path, data: Dict) -> bool:
    """
    Write JSON data atomically using temp file + rename.

    This prevents corruption if write is interrupted.
    """
    _ensure_profile_dir()

    # Write to temp file in same directory (for atomic rename)
    fd, temp_path = tempfile.mkstemp(
        suffix='.json',
        prefix='profile_',
        dir=PROFILE_DIR
    )
    try:
        with os.fdopen(fd, 'w') as f:
            json.dump(data, f, indent=2)

        # Atomic rename
        shutil.move(temp_path, path)
        return True
    except Exception as e:
        # Clean up temp file on failure
        try:
            os.unlink(temp_path)
        except Exception:
            pass
        raise e


def _profile_to_dict(profile: UserProfile) -> Dict:
    """Convert UserProfile to JSON-serializable dictionary."""
    return asdict(profile)


def _dict_to_frontend_format(profile_dict: Dict) -> Dict:
    """
    Convert Python snake_case to TypeScript camelCase format.

    This ensures the profile matches the TypeScript interface.
    """
    return {
        'id': profile_dict['id'],
        'createdAt': profile_dict['created_at'],
        'updatedAt': profile_dict['updated_at'],
        'userMode': profile_dict['user_mode'],
        'optimizationDepth': profile_dict['optimization_depth'],
        'communicationStyle': profile_dict['communication_style'],
        'hardwareSignature': {
            'cpu': profile_dict['hardware_signature']['cpu'],
            'gpu': profile_dict['hardware_signature']['gpu'],
            'ramGb': profile_dict['hardware_signature']['ram_gb'],
            'platform': profile_dict['hardware_signature']['platform']
        },
        'patterns': [
            {
                'patternType': p['pattern_type'],
                'settingCategory': p['setting_category'],
                'settingKey': p['setting_key'],
                'confidence': p['confidence'],
                'sampleCount': p['sample_count'],
                'description': p['description'],
                'lastUpdated': p['last_updated']
            }
            for p in profile_dict.get('patterns', [])
        ],
        'totalOptimizations': profile_dict['total_optimizations'],
        'totalGamesOptimized': profile_dict['total_games_optimized'],
        'optimizationsAccepted': profile_dict['optimizations_accepted'],
        'optimizationsReverted': profile_dict['optimizations_reverted']
    }


def get_or_create_profile() -> Dict:
    """
    Get existing profile or create default for new users.

    Returns:
        Profile dictionary in frontend (camelCase) format.
    """
    _ensure_profile_dir()

    if PROFILE_FILE.exists():
        try:
            with open(PROFILE_FILE, 'r') as f:
                profile_dict = json.load(f)
            return _dict_to_frontend_format(profile_dict)
        except (json.JSONDecodeError, KeyError) as e:
            # Corrupted profile - recreate
            print(f"Warning: Corrupted profile, recreating: {e}")

    # Create new profile with defaults
    now = time.time() * 1000  # JavaScript timestamp format (milliseconds)
    hardware = get_hardware_signature()

    profile = UserProfile(
        id=str(uuid.uuid4()),
        created_at=now,
        updated_at=now,
        user_mode='standard',
        optimization_depth='thorough',
        communication_style='informative',
        hardware_signature=hardware,
        patterns=[],
        total_optimizations=0,
        total_games_optimized=0,
        optimizations_accepted=0,
        optimizations_reverted=0
    )

    profile_dict = _profile_to_dict(profile)
    _atomic_write(PROFILE_FILE, profile_dict)

    return _dict_to_frontend_format(profile_dict)


def save_profile(profile: Dict) -> Dict:
    """
    Save complete profile (frontend format).

    Args:
        profile: Profile dictionary in camelCase format.

    Returns:
        Saved profile in frontend format.
    """
    # Convert frontend camelCase to Python snake_case for storage
    profile_dict = {
        'id': profile['id'],
        'created_at': profile['createdAt'],
        'updated_at': time.time() * 1000,  # Update timestamp
        'user_mode': profile['userMode'],
        'optimization_depth': profile['optimizationDepth'],
        'communication_style': profile['communicationStyle'],
        'hardware_signature': {
            'cpu': profile['hardwareSignature']['cpu'],
            'gpu': profile['hardwareSignature']['gpu'],
            'ram_gb': profile['hardwareSignature']['ramGb'],
            'platform': profile['hardwareSignature']['platform']
        },
        'patterns': [
            {
                'pattern_type': p['patternType'],
                'setting_category': p['settingCategory'],
                'setting_key': p['settingKey'],
                'confidence': p['confidence'],
                'sample_count': p['sampleCount'],
                'description': p['description'],
                'last_updated': p['lastUpdated']
            }
            for p in profile.get('patterns', [])
        ],
        'total_optimizations': profile.get('totalOptimizations', 0),
        'total_games_optimized': profile.get('totalGamesOptimized', 0),
        'optimizations_accepted': profile.get('optimizationsAccepted', 0),
        'optimizations_reverted': profile.get('optimizationsReverted', 0)
    }

    _atomic_write(PROFILE_FILE, profile_dict)
    return _dict_to_frontend_format(profile_dict)


def update_profile(updates: Dict) -> Dict:
    """
    Partial update of profile preferences.

    Args:
        updates: Dictionary with optional userMode, optimizationDepth, communicationStyle.

    Returns:
        Updated profile in frontend format.
    """
    profile = get_or_create_profile()

    # Apply updates (only allowed fields)
    if 'userMode' in updates:
        if updates['userMode'] in ('simple', 'standard', 'power'):
            profile['userMode'] = updates['userMode']

    if 'optimizationDepth' in updates:
        if updates['optimizationDepth'] in ('efficient', 'thorough', 'optimised'):
            profile['optimizationDepth'] = updates['optimizationDepth']

    if 'communicationStyle' in updates:
        if updates['communicationStyle'] in ('informative', 'concise'):
            profile['communicationStyle'] = updates['communicationStyle']

    return save_profile(profile)


def delete_profile() -> bool:
    """
    Delete all profile data.

    Returns:
        True if deleted successfully, False if no profile existed.
    """
    if PROFILE_FILE.exists():
        PROFILE_FILE.unlink()
        return True
    return False


def refresh_hardware_signature() -> Dict:
    """
    Re-detect hardware and update profile.

    Useful when hardware changes (e.g., new GPU installed).

    Returns:
        Updated profile in frontend format.
    """
    profile = get_or_create_profile()

    # Get fresh hardware signature
    hardware = get_hardware_signature()
    profile['hardwareSignature'] = {
        'cpu': hardware['cpu'],
        'gpu': hardware['gpu'],
        'ramGb': hardware['ram_gb'],
        'platform': hardware['platform']
    }

    return save_profile(profile)


def increment_optimization_stats(accepted: bool = True, new_game: bool = False) -> Dict:
    """
    Increment optimization statistics.

    Args:
        accepted: True if user accepted, False if reverted.
        new_game: True if this is the first optimization for this game.

    Returns:
        Updated profile in frontend format.
    """
    profile = get_or_create_profile()

    profile['totalOptimizations'] = profile.get('totalOptimizations', 0) + 1

    if accepted:
        profile['optimizationsAccepted'] = profile.get('optimizationsAccepted', 0) + 1
    else:
        profile['optimizationsReverted'] = profile.get('optimizationsReverted', 0) + 1

    if new_game:
        profile['totalGamesOptimized'] = profile.get('totalGamesOptimized', 0) + 1

    return save_profile(profile)
