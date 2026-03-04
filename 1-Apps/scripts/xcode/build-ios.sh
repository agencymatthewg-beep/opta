#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Build an iOS scheme with stable, repo-friendly defaults.

Options:
  --target <name>         Known preset target (default: scan-ios)
  --project <path>        .xcodeproj path (relative to repo root or absolute)
  --scheme <name>         Xcode scheme name
  --configuration <name>  Build configuration (default: Debug)
  --destination <dest>    Simulator destination (default: $(xcode_default_ios_destination))
  --jobs <n>              xcodebuild parallel jobs (default: $(xcode_default_jobs))
  --clean                 Run clean before build
  -h, --help              Show this help

Notes:
  - If --project/--scheme are omitted, --target defaults are used.
  - Set XCODE_BUILD_RESULT_BUNDLE=1 to emit an .xcresult for build (off by default).
  - Uses:
      -parallelizeTargets
      -showBuildTimingSummary
      -derivedDataPath
      -disableAutomaticPackageResolution
      -onlyUsePackageVersionsFromResolvedFile
      -skipPackageUpdates
EOF
  xcode_print_known_targets
}

target="scan-ios"
project_arg=""
scheme_arg=""
configuration="${CONFIGURATION:-Debug}"
destination="$(xcode_default_ios_destination)"
jobs="$(xcode_default_jobs)"
do_clean="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      [[ $# -ge 2 ]] || xcode_die "--target requires a value"
      target="$2"
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
    --configuration)
      [[ $# -ge 2 ]] || xcode_die "--configuration requires a value"
      configuration="$2"
      shift 2
      ;;
    --destination)
      [[ $# -ge 2 ]] || xcode_die "--destination requires a value"
      destination="$2"
      shift 2
      ;;
    --jobs)
      [[ $# -ge 2 ]] || xcode_die "--jobs requires a value"
      jobs="$2"
      shift 2
      ;;
    --clean)
      do_clean="1"
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

if [[ -n "${project_arg}" && -z "${scheme_arg}" ]] || [[ -n "${scheme_arg}" && -z "${project_arg}" ]]; then
  xcode_die "Provide both --project and --scheme, or neither to use --target defaults"
fi

if [[ -z "${project_arg}" || -z "${scheme_arg}" ]]; then
  if ! xcode_resolve_target "${target}"; then
    xcode_die "Unknown target: ${target}"
  fi
  if [[ "${XCODE_TARGET_PLATFORM}" != "ios" ]]; then
    xcode_die "Target '${target}' is not an iOS target"
  fi
  [[ -z "${project_arg}" ]] && project_arg="${XCODE_TARGET_PROJECT_REL}"
  [[ -z "${scheme_arg}" ]] && scheme_arg="${XCODE_TARGET_SCHEME}"
fi

project_path="$(xcode_resolve_project_path "${project_arg}")"
spm_cache="$(xcode_spm_cache_dir)"
mkdir -p "${spm_cache}"
xcode_preflight "${project_path}" "${scheme_arg}" "${destination}"
xcode_prepare_output_paths "build-ios" "${scheme_arg}" "${configuration}"

xcode_info "Building iOS scheme '${scheme_arg}'"
xcode_info "Project: ${project_path}"
xcode_info "Destination: ${destination}"
xcode_info "DerivedData: ${XCODE_DERIVED_DATA_PATH}"
if xcode_build_result_bundle_enabled; then
  xcode_info "Result bundle: ${XCODE_RESULT_BUNDLE_PATH}"
else
  xcode_info "Result bundle: disabled (set XCODE_BUILD_RESULT_BUNDLE=1 to enable)"
fi

clean_args=(
  -project "${project_path}"
  -scheme "${scheme_arg}"
  -configuration "${configuration}"
  -destination "${destination}"
  -parallelizeTargets
  -jobs "${jobs}"
  -showBuildTimingSummary
  -derivedDataPath "${XCODE_DERIVED_DATA_PATH}"
  -clonedSourcePackagesDirPath "${spm_cache}"
  -disableAutomaticPackageResolution
  -onlyUsePackageVersionsFromResolvedFile
  -skipPackageUpdates
)

build_args=("${clean_args[@]}")
if xcode_build_result_bundle_enabled; then
  build_args+=(-resultBundlePath "${XCODE_RESULT_BUNDLE_PATH}")
fi

if [[ "${do_clean}" == "1" ]]; then
  xcode_run_xcodebuild "${clean_args[@]}" clean
fi

xcode_run_xcodebuild "${build_args[@]}" build
