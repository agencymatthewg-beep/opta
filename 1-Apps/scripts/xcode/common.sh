#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

XCODE_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

xcode_die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

xcode_warn() {
  printf 'warn: %s\n' "$*" >&2
}

xcode_info() {
  printf 'info: %s\n' "$*" >&2
}

xcode_command_exists() {
  command -v "$1" >/dev/null 2>&1
}

xcode_find_repo_root() {
  if [[ -n "${XCODE_REPO_ROOT:-}" && -d "${XCODE_REPO_ROOT}" ]]; then
    printf '%s\n' "${XCODE_REPO_ROOT}"
    return 0
  fi

  local from_scripts
  from_scripts="$(cd "${XCODE_COMMON_DIR}/../.." && pwd -P)"
  if [[ -d "${from_scripts}/optamize" ]]; then
    printf '%s\n' "${from_scripts}"
    return 0
  fi

  local dir="${PWD}"
  while [[ "${dir}" != "/" ]]; do
    if [[ -d "${dir}/optamize" ]]; then
      printf '%s\n' "${dir}"
      return 0
    fi
    dir="$(dirname "${dir}")"
  done

  printf '%s\n' "${from_scripts}"
}

XCODE_REPO_ROOT="${XCODE_REPO_ROOT:-$(xcode_find_repo_root)}"

xcode_abs_path() {
  local path="$1"
  if [[ "${path}" == /* ]]; then
    printf '%s\n' "${path}"
  else
    printf '%s\n' "${XCODE_REPO_ROOT}/${path}"
  fi
}

xcode_resolve_project_path() {
  local raw_path="$1"
  local project_path
  project_path="$(xcode_abs_path "${raw_path}")"
  if [[ ! -d "${project_path}" ]]; then
    xcode_die "Project not found: ${project_path}"
  fi
  printf '%s\n' "${project_path}"
}

xcode_default_jobs() {
  if [[ -n "${XCODE_JOBS:-}" ]]; then
    printf '%s\n' "${XCODE_JOBS}"
    return 0
  fi

  local cpu_count
  cpu_count="$(sysctl -n hw.logicalcpu 2>/dev/null || true)"
  if [[ -z "${cpu_count}" ]]; then
    cpu_count="8"
  fi
  printf '%s\n' "${cpu_count}"
}

xcode_default_ios_destination() {
  if [[ -n "${IOS_DESTINATION:-}" ]]; then
    printf '%s\n' "${IOS_DESTINATION}"
    return 0
  fi

  if xcode_command_exists xcrun; then
    local available
    available="$(xcrun simctl list devices available 2>/dev/null || true)"
    if printf '%s' "${available}" | grep -q "iPhone 17 Pro"; then
      printf '%s\n' "platform=iOS Simulator,name=iPhone 17 Pro"
      return 0
    fi
    if printf '%s' "${available}" | grep -q "iPhone 17"; then
      printf '%s\n' "platform=iOS Simulator,name=iPhone 17"
      return 0
    fi
  fi

  printf '%s\n' "platform=iOS Simulator"
}

xcode_spm_cache_dir() {
  printf '%s\n' "${XCODE_SPM_CACHE_DIR:-${XCODE_REPO_ROOT}/.build/xcode-spm-cache}"
}

xcode_slugify() {
  printf '%s' "$1" | tr -cs '[:alnum:]._-' '-'
}

xcode_prepare_output_paths() {
  local action="$1"
  local scheme="$2"
  local configuration="${3:-${CONFIGURATION:-Debug}}"
  local timestamp
  local action_slug
  local scheme_slug
  local config_slug
  local derived_root
  local results_root
  local derived_leaf

  timestamp="$(date +%Y%m%d-%H%M%S)"
  action_slug="$(xcode_slugify "${action}")"
  scheme_slug="$(xcode_slugify "${scheme}")"
  config_slug="$(xcode_slugify "${configuration}")"
  derived_root="${XCODE_REPO_ROOT}/.build/xcode-derived"
  results_root="${XCODE_REPO_ROOT}/.build/xcode-results"

  mkdir -p "${derived_root}" "${results_root}"

  derived_leaf="${scheme_slug}-${action_slug}-${config_slug}"
  if [[ -n "${XCODE_DERIVED_DATA_SUFFIX:-}" ]]; then
    derived_leaf="${derived_leaf}-$(xcode_slugify "${XCODE_DERIVED_DATA_SUFFIX}")"
  fi

  XCODE_DERIVED_DATA_PATH="${DERIVED_DATA_PATH:-${derived_root}/${derived_leaf}}"
  XCODE_RESULT_BUNDLE_PATH="${RESULT_BUNDLE_PATH:-${results_root}/${scheme_slug}-${action_slug}-${config_slug}-${timestamp}.xcresult}"

  mkdir -p "${XCODE_DERIVED_DATA_PATH}" "$(dirname "${XCODE_RESULT_BUNDLE_PATH}")"
}

xcode_build_result_bundle_enabled() {
  case "${XCODE_BUILD_RESULT_BUNDLE:-0}" in
    1|true|TRUE|yes|YES)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

xcode_assert_scheme_exists() {
  local project_path="$1"
  local scheme="$2"
  local list_output
  local schemes

  if ! list_output="$(xcodebuild -list -project "${project_path}" 2>&1)"; then
    xcode_die "Unable to list schemes for project '${project_path}': ${list_output}"
  fi

  schemes="$(printf '%s\n' "${list_output}" | awk '
    /^    Schemes:/ { in_schemes = 1; next }
    in_schemes && NF == 0 { exit }
    in_schemes { gsub(/^[[:space:]]+|[[:space:]]+$/, "", $0); if (length($0) > 0) print $0 }
  ')"

  if ! printf '%s\n' "${schemes}" | grep -Fxq "${scheme}"; then
    xcode_die "Scheme '${scheme}' not found in '${project_path}'. Available schemes: ${schemes//$'\n'/, }"
  fi
}

xcode_destination_value() {
  local destination="$1"
  local key="$2"
  local parts
  local part

  IFS=',' read -r -a parts <<<"${destination}"
  for part in "${parts[@]}"; do
    part="${part#"${part%%[![:space:]]*}"}"
    part="${part%"${part##*[![:space:]]}"}"
    if [[ "${part}" == "${key}="* ]]; then
      printf '%s\n' "${part#*=}"
      return 0
    fi
  done
  return 1
}

xcode_assert_destination_available() {
  local project_path="$1"
  local scheme="$2"
  local destination="$3"
  local destinations_output
  local available_block
  local platform
  local name
  local os

  if ! destinations_output="$(xcodebuild -showdestinations -project "${project_path}" -scheme "${scheme}" 2>&1)"; then
    xcode_die "Unable to query destinations for '${scheme}' in '${project_path}': ${destinations_output}"
  fi

  available_block="$(printf '%s\n' "${destinations_output}" | awk '
    /Available destinations for the/ { in_available = 1; next }
    /Ineligible destinations for the/ { in_available = 0 }
    in_available { print }
  ')"
  if [[ -z "${available_block}" ]]; then
    available_block="${destinations_output}"
  fi

  platform="$(xcode_destination_value "${destination}" "platform" || true)"
  name="$(xcode_destination_value "${destination}" "name" || true)"
  os="$(xcode_destination_value "${destination}" "OS" || true)"

  if [[ -n "${platform}" ]] && ! printf '%s\n' "${available_block}" | grep -Fq "platform:${platform}"; then
    xcode_die "Destination platform '${platform}' is not available for scheme '${scheme}'. Requested: ${destination}"
  fi

  if [[ -n "${name}" ]] && ! printf '%s\n' "${available_block}" | grep -Fq "name:${name}"; then
    xcode_die "Destination name '${name}' is not available for scheme '${scheme}'. Requested: ${destination}"
  fi

  if [[ -n "${os}" ]] && ! printf '%s\n' "${available_block}" | grep -Fq "OS:${os}"; then
    xcode_die "Destination OS '${os}' is not available for scheme '${scheme}'. Requested: ${destination}"
  fi
}

xcode_preflight() {
  local project_path="$1"
  local scheme="$2"
  local destination="$3"

  xcode_assert_scheme_exists "${project_path}" "${scheme}"
  xcode_assert_destination_available "${project_path}" "${scheme}" "${destination}"
}

xcode_run_xcodebuild() {
  if [[ "${NO_XCBEAUTIFY:-0}" == "1" ]]; then
    xcodebuild "$@"
    return
  fi

  if xcode_command_exists xcbeautify; then
    xcodebuild "$@" 2>&1 | xcbeautify
  else
    xcodebuild "$@"
  fi
}

xcode_all_targets() {
  cat <<'EOF'
life-ios
mini-macos
scan-ios
native-macos
plus-ios
plus-ios-shared
plus-macos
plus-macos-shared
EOF
}

xcode_target_tuple() {
  local target="$1"
  case "${target}" in
    life-ios)
      printf '%s\n' "optamize/1E-Opta-Life-IOS/OptaLMiOS.xcodeproj|OptaLMiOS|ios"
      ;;
    mini-macos)
      printf '%s\n' "optamize/1G-Opta-Mini-MacOS/OptaMini.xcodeproj|OptaMini|macos"
      ;;
    scan-ios)
      printf '%s\n' "optamize/1H-Opta-Scan-IOS/Opta.xcodeproj|Opta|ios"
      ;;
    native-macos)
      printf '%s\n' "optamize/1J-Optamize-MacOS/OptaNative.xcodeproj|OptaNative|macos"
      ;;
    plus-ios)
      printf '%s\n' "shared/1I-OptaPlus/iOS/OptaPlusIOS.xcodeproj|OptaPlusIOS|ios"
      ;;
    plus-ios-shared)
      printf '%s\n' "shared/1I-OptaPlus/iOS/OptaPlusIOS.xcodeproj|OptaMolt|ios"
      ;;
    plus-macos)
      printf '%s\n' "shared/1I-OptaPlus/macOS/OptaPlusMacOS.xcodeproj|OptaPlusMacOS|macos"
      ;;
    plus-macos-shared)
      printf '%s\n' "shared/1I-OptaPlus/macOS/OptaPlusMacOS.xcodeproj|OptaMolt|macos"
      ;;
    *)
      return 1
      ;;
  esac
}

xcode_resolve_target() {
  local target="$1"
  local tuple
  local IFS='|'

  tuple="$(xcode_target_tuple "${target}")" || return 1
  read -r XCODE_TARGET_PROJECT_REL XCODE_TARGET_SCHEME XCODE_TARGET_PLATFORM <<<"${tuple}"
}

xcode_print_known_targets() {
  cat <<'EOF'
Known targets:
  life-ios     -> optamize/1E-Opta-Life-IOS/OptaLMiOS.xcodeproj (scheme: OptaLMiOS)
  mini-macos   -> optamize/1G-Opta-Mini-MacOS/OptaMini.xcodeproj (scheme: OptaMini)
  scan-ios     -> optamize/1H-Opta-Scan-IOS/Opta.xcodeproj (scheme: Opta)
  native-macos -> optamize/1J-Optamize-MacOS/OptaNative.xcodeproj (scheme: OptaNative)
  plus-ios     -> shared/1I-OptaPlus/iOS/OptaPlusIOS.xcodeproj (scheme: OptaPlusIOS)
  plus-ios-shared -> shared/1I-OptaPlus/iOS/OptaPlusIOS.xcodeproj (scheme: OptaMolt)
  plus-macos   -> shared/1I-OptaPlus/macOS/OptaPlusMacOS.xcodeproj (scheme: OptaPlusMacOS)
  plus-macos-shared -> shared/1I-OptaPlus/macOS/OptaPlusMacOS.xcodeproj (scheme: OptaMolt)
EOF
}
