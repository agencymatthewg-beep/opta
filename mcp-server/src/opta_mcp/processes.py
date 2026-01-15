"""Process listing and categorization for Opta.

Provides process enumeration with CPU/memory usage and categorization
for the Stealth Mode feature (system-critical, user app, safe-to-kill).
"""

import psutil
from typing import List, Dict

# System-critical processes that should never be killed
SYSTEM_PROCESSES = {
    # Unix/Linux
    "kernel", "kernel_task", "init", "systemd", "launchd", "kthreadd", "migration",
    "watchdog", "ksoftirqd", "kworker", "rcu_sched", "rcu_bh",
    # macOS
    "windowserver", "loginwindow", "coreaudiod", "airportd", "bluetoothd",
    "mds", "mds_stores", "distnoted", "cfprefsd", "powerd", "opendirectoryd",
    "coreservicesd", "securityd", "logd", "configd", "usbd", "fseventsd",
    "notifyd", "amfid", "syspolicyd", "trustd", "iconservicesagen", "iconservicesd",
    # Windows
    "csrss", "smss", "svchost", "services", "lsass", "wininit", "winlogon",
    "dwm", "explorer", "system idle process", "system", "ntoskrnl",
}

# Known bloatware and safe-to-kill applications
SAFE_TO_KILL_PATTERNS = [
    # Adobe updaters
    "adobe", "adobearm", "adobeupdate", "cclibrary", "creative cloud",
    # Spotify
    "spotify helper", "spotifywebhelper",
    # Discord
    "discord helper", "discord",
    # Steam
    "steam client bootstrapper", "steamwebhelper", "steam",
    # Microsoft
    "onedrive", "microsoft edge update", "office",
    # Google
    "google update", "google chrome helper", "chrome helper",
    # Gaming services
    "razer", "omen", "corsair", "logitech", "steelseries",
    "nvidia share", "nvidia web helper", "nvidia container",
    "amd", "radeon",
    # Other
    "dropbox", "zoom", "slack helper", "teams helper",
]


def categorize_process(name: str, username: str) -> str:
    """Categorize a process as system, user, or safe-to-kill.

    Args:
        name: Process name
        username: Username running the process

    Returns:
        Category string: "system", "user", or "safe-to-kill"
    """
    name_lower = name.lower()

    # Check if it's a system process
    if name_lower in SYSTEM_PROCESSES:
        return "system"

    # Check for common system process patterns
    if any(name_lower.startswith(p) for p in ["kworker", "ksoftirqd", "migration"]):
        return "system"

    # Check username for system users
    if username:
        username_lower = username.lower()
        if username_lower in ["root", "system", "_", "daemon", "nobody"]:
            # Many root/system processes are system-critical
            if any(s in name_lower for s in ["d", "agent", "daemon", "helper", "service"]):
                return "system"

    # Check if it matches safe-to-kill patterns
    for pattern in SAFE_TO_KILL_PATTERNS:
        if pattern in name_lower:
            return "safe-to-kill"

    # Default to user process
    return "user"


def get_process_list() -> List[Dict]:
    """Get list of running processes with resource usage and categorization.

    Uses psutil.process_iter() with proc.info dict approach for efficiency.
    Returns top 100 processes sorted by CPU usage descending.

    Returns:
        List of dicts with: pid, name, cpu_percent, memory_percent,
        status, category, username, create_time
    """
    processes = []

    # Use proc.info dict approach for efficiency (single system call per process)
    # Use interval=0 to avoid blocking - this returns cached/instantaneous values
    attrs = ['pid', 'name', 'cpu_percent', 'memory_percent', 'status', 'username', 'create_time']

    for proc in psutil.process_iter(attrs=attrs):
        try:
            info = proc.info

            # Skip processes where we couldn't get basic info
            if info.get('name') is None:
                continue

            # Categorize the process
            category = categorize_process(
                info.get('name', ''),
                info.get('username', '') or ''
            )

            processes.append({
                'pid': info.get('pid'),
                'name': info.get('name', 'Unknown'),
                'cpu_percent': round(info.get('cpu_percent', 0) or 0, 1),
                'memory_percent': round(info.get('memory_percent', 0) or 0, 1),
                'status': info.get('status', 'unknown'),
                'category': category,
                'username': info.get('username'),
                'create_time': info.get('create_time'),
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            # Process may have terminated or we don't have access
            continue

    # Sort by CPU usage descending
    processes.sort(key=lambda p: p['cpu_percent'], reverse=True)

    # Limit to top 100 processes
    return processes[:100]
