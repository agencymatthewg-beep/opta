#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

List schemes for one project or all known targets.

Options:
  --target <name>   Known preset target (repeatable)
  --project <path>  Custom .xcodeproj path
  --all             List all known targets (default when no selector is given)
  -h, --help        Show this help
EOF
  xcode_print_known_targets
}

targets=()
project_arg=""
list_all="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || xcode_die "--target requires a value"
      targets+=("$2")
      shift 2
      ;;
    --project)
      [[ $# -ge 2 ]] || xcode_die "--project requires a value"
      project_arg="$2"
      shift 2
      ;;
    --all)
      list_all="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      xcode_die "Unknown argument: $1"
      ;;
  esac
done

if [[ "${list_all}" == "0" && ${#targets[@]} -eq 0 && -z "${project_arg}" ]]; then
  list_all="1"
fi

list_one() {
  local project_rel="$1"
  local label="$2"
  local project_path

  project_path="$(xcode_resolve_project_path "${project_rel}")"
  printf '\n== %s ==\n' "${label}"
  printf 'Project: %s\n' "${project_path}"
  xcodebuild -list -project "${project_path}"
}

if [[ -n "${project_arg}" ]]; then
  list_one "${project_arg}" "custom"
fi

if [[ ${#targets[@]} -gt 0 ]]; then
  for target in "${targets[@]}"; do
    if ! xcode_resolve_target "${target}"; then
      xcode_die "Unknown target: ${target}"
    fi
    list_one "${XCODE_TARGET_PROJECT_REL}" "${target}"
  done
fi

if [[ "${list_all}" == "1" ]]; then
  while IFS= read -r target; do
    if ! xcode_resolve_target "${target}"; then
      xcode_die "Unknown target: ${target}"
    fi
    list_one "${XCODE_TARGET_PROJECT_REL}" "${target}"
  done < <(xcode_all_targets)
fi
