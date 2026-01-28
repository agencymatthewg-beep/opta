"""Privacy-preserving context anonymization for cloud queries.

This module provides functions to anonymize system context before sending
to cloud LLM services (Claude API). It protects user privacy by removing
or hashing personally identifiable information (PII) such as:

- Usernames in file paths
- MAC addresses
- IP addresses
- Serial numbers and hardware identifiers

IMPORTANT: Privacy is critical - err on the side of removing too much
rather than too little.
"""

import re
from typing import Any

# Sensitive patterns to anonymize
# Each tuple is (regex_pattern, replacement)
# NOTE: Use raw strings (r'...') for both pattern AND replacement to avoid escape issues
SENSITIVE_PATTERNS: list[tuple[str, str]] = [
    # User paths (macOS, Linux, Windows)
    (r'/Users/[^/]+/', r'/Users/[USER]/'),
    (r'/home/[^/]+/', r'/home/[USER]/'),
    (r'C:\\Users\\[^\\]+\\', r'C:\\Users\\[USER]\\'),
    # MAC addresses (AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF)
    (r'([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}', r'[MAC_ADDR]'),
    # IPv4 addresses
    (r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', r'[IP_ADDR]'),
    # IPv6 addresses (simplified pattern)
    (r'\b([0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}\b', r'[IPv6_ADDR]'),
    # Serial numbers and UUIDs (common formats)
    (r'[A-Za-z0-9]{8,}-[A-Za-z0-9]{4,}-[A-Za-z0-9]{4,}-[A-Za-z0-9]{4,}-[A-Za-z0-9]{12,}', r'[UUID]'),
    (r'[A-Za-z0-9]{8,}-[A-Za-z0-9]{4,}-', r'[SERIAL]'),
    # Email addresses
    (r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', r'[EMAIL]'),
    # Hostname patterns that might reveal identity
    (r"hostname['\"]?\s*[:=]\s*['\"]?[A-Za-z0-9.-]+['\"]?", r'hostname: [HOSTNAME]'),
]


def anonymize_string(text: str) -> str:
    """Anonymize a string by replacing sensitive patterns.

    Applies all patterns from SENSITIVE_PATTERNS to remove or replace
    potentially identifying information.

    Args:
        text: The string to anonymize.

    Returns:
        The anonymized string with sensitive data replaced.

    Example:
        >>> anonymize_string('/Users/john/Documents/file.txt')
        '/Users/[USER]/Documents/file.txt'
        >>> anonymize_string('IP: 192.168.1.100')
        'IP: [IP_ADDR]'
    """
    result = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        result = re.sub(pattern, replacement, result)
    return result


def anonymize_context(context: dict[str, Any]) -> dict[str, Any]:
    """Recursively anonymize a context dictionary before sending to cloud.

    Traverses the dictionary and applies anonymization to all string values.
    Nested dictionaries are processed recursively. Lists are processed
    element by element.

    Non-string primitives (numbers, booleans) are preserved as they may
    contain useful optimization data (e.g., CPU usage percentage).

    Args:
        context: Dictionary containing system context to anonymize.

    Returns:
        New dictionary with all string values anonymized.

    Example:
        >>> ctx = {'path': '/Users/john/app', 'cpu': 45.2}
        >>> anonymize_context(ctx)
        {'path': '/Users/[USER]/app', 'cpu': 45.2}
    """
    result: dict[str, Any] = {}

    for key, value in context.items():
        if isinstance(value, str):
            result[key] = anonymize_string(value)
        elif isinstance(value, dict):
            result[key] = anonymize_context(value)
        elif isinstance(value, list):
            result[key] = _anonymize_list(value)
        else:
            # Preserve numbers, booleans, None, etc.
            result[key] = value

    return result


def _anonymize_list(items: list[Any]) -> list[Any]:
    """Anonymize items in a list.

    Args:
        items: List of items to anonymize.

    Returns:
        New list with anonymized items.
    """
    result: list[Any] = []
    for item in items:
        if isinstance(item, str):
            result.append(anonymize_string(item))
        elif isinstance(item, dict):
            result.append(anonymize_context(item))
        elif isinstance(item, list):
            result.append(_anonymize_list(item))
        else:
            result.append(item)
    return result


def get_anonymization_summary(original: dict[str, Any], anonymized: dict[str, Any]) -> list[str]:
    """Generate a summary of what was anonymized for transparency.

    Compares original and anonymized contexts to identify what fields
    were changed. This is displayed in the UI so users can see exactly
    what data protection was applied.

    Args:
        original: The original context dictionary.
        anonymized: The anonymized context dictionary.

    Returns:
        List of human-readable descriptions of what was anonymized.

    Example:
        >>> orig = {'path': '/Users/john/app', 'cpu': 45.2}
        >>> anon = {'path': '/Users/[USER]/app', 'cpu': 45.2}
        >>> get_anonymization_summary(orig, anon)
        ['path: username in path anonymized']
    """
    changes: list[str] = []
    _compare_dicts(original, anonymized, changes, prefix='')
    return changes


def _compare_dicts(
    original: dict[str, Any],
    anonymized: dict[str, Any],
    changes: list[str],
    prefix: str
) -> None:
    """Recursively compare dictionaries and record changes.

    Args:
        original: Original dictionary.
        anonymized: Anonymized dictionary.
        changes: List to append change descriptions to.
        prefix: Key prefix for nested dicts.
    """
    for key in original:
        full_key = f"{prefix}{key}" if prefix else key
        orig_val = original.get(key)
        anon_val = anonymized.get(key)

        if isinstance(orig_val, dict) and isinstance(anon_val, dict):
            _compare_dicts(orig_val, anon_val, changes, f"{full_key}.")
        elif isinstance(orig_val, list) and isinstance(anon_val, list):
            _compare_lists(orig_val, anon_val, changes, full_key)
        elif orig_val != anon_val:
            change_type = _identify_change_type(str(orig_val), str(anon_val))
            changes.append(f"{full_key}: {change_type}")


def _compare_lists(
    original: list[Any],
    anonymized: list[Any],
    changes: list[str],
    key: str
) -> None:
    """Compare lists and record changes.

    Args:
        original: Original list.
        anonymized: Anonymized list.
        changes: List to append change descriptions to.
        key: Key name for this list.
    """
    if len(original) != len(anonymized):
        return

    for i, (orig_item, anon_item) in enumerate(zip(original, anonymized)):
        if isinstance(orig_item, dict) and isinstance(anon_item, dict):
            _compare_dicts(orig_item, anon_item, changes, f"{key}[{i}].")
        elif orig_item != anon_item:
            change_type = _identify_change_type(str(orig_item), str(anon_item))
            changes.append(f"{key}[{i}]: {change_type}")


def _identify_change_type(original: str, anonymized: str) -> str:
    """Identify what type of anonymization was applied.

    Args:
        original: Original string value.
        anonymized: Anonymized string value.

    Returns:
        Human-readable description of the change.
    """
    if '[USER]' in anonymized:
        return 'username in path anonymized'
    if '[MAC_ADDR]' in anonymized:
        return 'MAC address anonymized'
    if '[IP_ADDR]' in anonymized or '[IPv6_ADDR]' in anonymized:
        return 'IP address anonymized'
    if '[SERIAL]' in anonymized or '[UUID]' in anonymized:
        return 'serial number/identifier anonymized'
    if '[EMAIL]' in anonymized:
        return 'email address anonymized'
    if '[HOSTNAME]' in anonymized:
        return 'hostname anonymized'
    return 'sensitive data anonymized'
