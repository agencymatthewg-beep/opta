#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Resolve Swift package dependencies into a shared cache:
  ${XCODE_REPO_ROOT}/.build/xcode-spm-cache

Options:
  --target <name>         Known preset target (repeatable)
  --project <path>        Custom .xcodeproj path (requires --scheme)
  --scheme <name>         Custom scheme (requires --project)
  --all                   Resolve all known targets (default when no selector is given)
  --allow-updates         Allow package updates while resolving
  -h, --help              Show this help

Notes:
  - By default this runs in locked mode using:
      -onlyUsePackageVersionsFromResolvedFile
      -skipPackageUpdates
EOF
  xcode_print_known_targets
}

targets=()
project_arg=""
scheme_arg=""
resolve_all="0"
allow_updates="0"

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
    --scheme)
      [[ $# -ge 2 ]] || xcode_die "--scheme requires a value"
      scheme_arg="$2"
      shift 2
      ;;
    --all)
      resolve_all="1"
      shift
      ;;
    --allow-updates)
      allow_updates="1"
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

if [[ -n "${project_arg}" || -n "${scheme_arg}" ]]; then
  [[ -n "${project_arg}" ]] || xcode_die "--project is required when --scheme is provided"
  [[ -n "${scheme_arg}" ]] || xcode_die "--scheme is required when --project is provided"
fi

if [[ "${resolve_all}" == "0" && ${#targets[@]} -eq 0 && -z "${project_arg}" ]]; then
  resolve_all="1"
fi

spm_cache="$(xcode_spm_cache_dir)"
mkdir -p "${spm_cache}"
xcode_info "Using SPM cache: ${spm_cache}"

locked_flags=()
if [[ "${allow_updates}" != "1" ]]; then
  locked_flags=(
    -onlyUsePackageVersionsFromResolvedFile
    -skipPackageUpdates
  )
fi

resolved_projects=()

already_resolved_project() {
  local candidate="$1"
  local project
  for project in "${resolved_projects[@]-}"; do
    if [[ "${project}" == "${candidate}" ]]; then
      return 0
    fi
  done
  return 1
}

resolve_one() {
  local project_rel="$1"
  local scheme="$2"
  local label="$3"
  local project_path

  project_path="$(xcode_resolve_project_path "${project_rel}")"
  if already_resolved_project "${project_path}"; then
    xcode_info "Skipping ${label} (${scheme}); already resolved: ${project_path}"
    return 0
  fi
  resolved_projects+=("${project_path}")
  xcode_info "Resolving packages for ${label} (${scheme})"

  xcode_run_xcodebuild \
    -resolvePackageDependencies \
    -project "${project_path}" \
    -scheme "${scheme}" \
    -clonedSourcePackagesDirPath "${spm_cache}" \
    "${locked_flags[@]}"
}

if [[ -n "${project_arg}" ]]; then
  resolve_one "${project_arg}" "${scheme_arg}" "custom"
fi

if [[ ${#targets[@]} -gt 0 ]]; then
  for target in "${targets[@]}"; do
    if ! xcode_resolve_target "${target}"; then
      xcode_die "Unknown target: ${target}"
    fi
    resolve_one "${XCODE_TARGET_PROJECT_REL}" "${XCODE_TARGET_SCHEME}" "${target}"
  done
fi

if [[ "${resolve_all}" == "1" ]]; then
  while IFS= read -r target; do
    if ! xcode_resolve_target "${target}"; then
      xcode_die "Unknown target: ${target}"
    fi
    resolve_one "${XCODE_TARGET_PROJECT_REL}" "${XCODE_TARGET_SCHEME}" "${target}"
  done < <(xcode_all_targets)
fi
