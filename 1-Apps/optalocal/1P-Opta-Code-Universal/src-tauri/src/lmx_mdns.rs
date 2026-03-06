use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::Serialize;
use std::collections::BTreeMap;
use std::time::{Duration, Instant};

const OPTA_LMX_SERVICE_TYPE: &str = "_opta-lmx._tcp.local.";
const DISCOVERY_WINDOW: Duration = Duration::from_millis(2500);
const SOURCE_MDNS: &str = "mdns";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LmxMdnsCandidate {
    pub host: String,
    pub port: u16,
    pub hostname: String,
    pub service_instance: String,
    pub source: String,
}

#[tauri::command]
pub async fn discover_lmx_mdns() -> Result<Vec<LmxMdnsCandidate>, String> {
    tauri::async_runtime::spawn_blocking(discover_lmx_mdns_blocking)
        .await
        .map_err(|e| format!("mDNS discovery task failed: {e}"))?
}

fn discover_lmx_mdns_blocking() -> Result<Vec<LmxMdnsCandidate>, String> {
    let daemon = ServiceDaemon::new().map_err(|e| format!("Failed to start mDNS browser: {e}"))?;
    let receiver = daemon
        .browse(OPTA_LMX_SERVICE_TYPE)
        .map_err(|e| format!("Failed to browse {OPTA_LMX_SERVICE_TYPE}: {e}"))?;

    let deadline = Instant::now() + DISCOVERY_WINDOW;
    let mut collected: Vec<LmxMdnsCandidate> = Vec::new();

    while Instant::now() < deadline {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            break;
        }

        match receiver.recv_timeout(remaining) {
            Ok(ServiceEvent::ServiceResolved(resolved)) => {
                collected.extend(candidates_from_resolved(&resolved));
            }
            Ok(_) => {}
            Err(_) => break,
        }
    }

    let _ = daemon.stop_browse(OPTA_LMX_SERVICE_TYPE);
    let _ = daemon.shutdown();

    Ok(normalize_candidates(collected))
}

fn candidates_from_resolved(resolved: &mdns_sd::ResolvedService) -> Vec<LmxMdnsCandidate> {
    let hostname = normalize_hostname_or_service(resolved.get_hostname());
    let service_instance = normalize_hostname_or_service(resolved.get_fullname());
    let port = resolved.get_port();

    let mut candidates: Vec<LmxMdnsCandidate> = resolved
        .get_addresses()
        .iter()
        .map(|scoped| LmxMdnsCandidate {
            host: normalize_host(&scoped.to_ip_addr().to_string()),
            port,
            hostname: hostname.clone(),
            service_instance: service_instance.clone(),
            source: SOURCE_MDNS.to_string(),
        })
        .collect();

    if candidates.is_empty() && !hostname.is_empty() {
        candidates.push(LmxMdnsCandidate {
            host: hostname.clone(),
            port,
            hostname,
            service_instance,
            source: SOURCE_MDNS.to_string(),
        });
    }

    candidates
}

fn normalize_candidates(candidates: Vec<LmxMdnsCandidate>) -> Vec<LmxMdnsCandidate> {
    let mut deduped: BTreeMap<(String, u16, String, String, String), LmxMdnsCandidate> =
        BTreeMap::new();

    for candidate in candidates.into_iter().map(canonicalize_candidate) {
        let key = candidate_sort_key(&candidate);
        deduped.entry(key).or_insert(candidate);
    }

    deduped.into_values().collect()
}

fn candidate_sort_key(candidate: &LmxMdnsCandidate) -> (String, u16, String, String, String) {
    (
        candidate.host.clone(),
        candidate.port,
        candidate.hostname.clone(),
        candidate.service_instance.clone(),
        candidate.source.clone(),
    )
}

fn canonicalize_candidate(candidate: LmxMdnsCandidate) -> LmxMdnsCandidate {
    LmxMdnsCandidate {
        host: normalize_host(&candidate.host),
        port: candidate.port,
        hostname: normalize_hostname_or_service(&candidate.hostname),
        service_instance: normalize_hostname_or_service(&candidate.service_instance),
        source: normalize_source(&candidate.source),
    }
}

fn normalize_host(host: &str) -> String {
    let trimmed = host.trim().trim_end_matches('.');
    if trimmed.is_empty() {
        String::new()
    } else if trimmed.parse::<std::net::IpAddr>().is_ok() {
        trimmed.to_string()
    } else {
        trimmed.to_ascii_lowercase()
    }
}

fn normalize_hostname_or_service(value: &str) -> String {
    value.trim().trim_end_matches('.').to_ascii_lowercase()
}

fn normalize_source(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        SOURCE_MDNS.to_string()
    } else {
        trimmed.to_ascii_lowercase()
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_candidates, LmxMdnsCandidate};

    #[test]
    fn normalize_candidates_dedupes_and_sorts_stably() {
        let input = vec![
            LmxMdnsCandidate {
                host: "192.168.1.12".into(),
                port: 9000,
                hostname: "Lmx-A.local.".into(),
                service_instance: "Office._opta-lmx._tcp.local.".into(),
                source: "mDNS".into(),
            },
            LmxMdnsCandidate {
                host: "10.0.0.5".into(),
                port: 9000,
                hostname: "lmx-b.local".into(),
                service_instance: "lab._opta-lmx._tcp.local".into(),
                source: "MDNS".into(),
            },
            LmxMdnsCandidate {
                host: "192.168.1.12".into(),
                port: 9000,
                hostname: "lmx-a.local".into(),
                service_instance: "office._opta-lmx._tcp.local".into(),
                source: "mdns".into(),
            },
        ];

        let normalized = normalize_candidates(input);
        assert_eq!(normalized.len(), 2);
        assert_eq!(normalized[0].host, "10.0.0.5");
        assert_eq!(normalized[1].host, "192.168.1.12");
        assert_eq!(
            normalized[1].service_instance,
            "office._opta-lmx._tcp.local"
        );
    }

    #[test]
    fn normalize_candidates_keeps_distinct_service_instances() {
        let input = vec![
            LmxMdnsCandidate {
                host: "lmx-gateway.local.".into(),
                port: 4500,
                hostname: "LMX-GATEWAY.local.".into(),
                service_instance: "b._opta-lmx._tcp.local.".into(),
                source: "".into(),
            },
            LmxMdnsCandidate {
                host: "LMX-GATEWAY.local".into(),
                port: 4500,
                hostname: "lmx-gateway.local".into(),
                service_instance: "a._opta-lmx._tcp.local".into(),
                source: "mDns".into(),
            },
        ];

        let normalized = normalize_candidates(input);
        assert_eq!(normalized.len(), 2);
        assert_eq!(normalized[0].service_instance, "a._opta-lmx._tcp.local");
        assert_eq!(normalized[1].service_instance, "b._opta-lmx._tcp.local");
        assert_eq!(normalized[0].source, "mdns");
    }
}
