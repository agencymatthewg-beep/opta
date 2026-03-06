use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::time::{Duration, Instant};

const OPTA_LMX_SERVICE_TYPE: &str = "_opta-lmx._tcp.local.";
const DISCOVERY_WINDOW: Duration = Duration::from_millis(2500);
const SOURCE_MDNS: &str = "mdns";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LmxMdnsCandidate {
    pub host: String,
    pub port: u16,
    pub hostname: String,
    pub service_name: String,
    pub addresses: Vec<String>,
    pub source: String,
}

pub fn discover_lmx_mdns_blocking() -> Vec<LmxMdnsCandidate> {
    let daemon = match ServiceDaemon::new() {
        Ok(daemon) => daemon,
        Err(_) => return Vec::new(),
    };
    let receiver = match daemon.browse(OPTA_LMX_SERVICE_TYPE) {
        Ok(receiver) => receiver,
        Err(_) => {
            let _ = daemon.shutdown();
            return Vec::new();
        }
    };

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
    normalize_candidates(collected)
}

fn candidates_from_resolved(resolved: &ServiceInfo) -> Vec<LmxMdnsCandidate> {
    let hostname = normalize_hostname_or_service(resolved.get_hostname());
    let service_name = normalize_hostname_or_service(resolved.get_fullname());
    let port = resolved.get_port();

    let mut addresses: Vec<String> = resolved
        .get_addresses()
        .iter()
        .map(|addr| normalize_host(&addr.to_string()))
        .filter(|value| !value.is_empty())
        .collect();
    addresses.sort();
    addresses.dedup();

    if addresses.is_empty() && !hostname.is_empty() {
        addresses.push(hostname.clone());
    }

    addresses
        .iter()
        .map(|host| LmxMdnsCandidate {
            host: host.clone(),
            port,
            hostname: hostname.clone(),
            service_name: service_name.clone(),
            addresses: addresses.clone(),
            source: SOURCE_MDNS.to_string(),
        })
        .collect()
}

fn normalize_candidates(candidates: Vec<LmxMdnsCandidate>) -> Vec<LmxMdnsCandidate> {
    let mut deduped: BTreeMap<(String, u16, String), LmxMdnsCandidate> = BTreeMap::new();
    for candidate in candidates.into_iter().map(canonicalize_candidate) {
        let key = (
            candidate.host.clone(),
            candidate.port,
            candidate.service_name.clone(),
        );
        deduped.entry(key).or_insert(candidate);
    }
    deduped.into_values().collect()
}

fn canonicalize_candidate(candidate: LmxMdnsCandidate) -> LmxMdnsCandidate {
    let mut addresses = candidate
        .addresses
        .iter()
        .map(|value| normalize_host(value))
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    addresses.sort();
    addresses.dedup();

    LmxMdnsCandidate {
        host: normalize_host(&candidate.host),
        port: candidate.port,
        hostname: normalize_hostname_or_service(&candidate.hostname),
        service_name: normalize_hostname_or_service(&candidate.service_name),
        addresses,
        source: normalize_source(&candidate.source),
    }
}

fn normalize_host(value: &str) -> String {
    let trimmed = value.trim().trim_end_matches('.');
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
                hostname: "LMX-A.local.".into(),
                service_name: "Office._opta-lmx._tcp.local.".into(),
                addresses: vec!["192.168.1.12".into(), "192.168.1.12".into()],
                source: "mDNS".into(),
            },
            LmxMdnsCandidate {
                host: "10.0.0.5".into(),
                port: 9000,
                hostname: "lmx-b.local".into(),
                service_name: "lab._opta-lmx._tcp.local".into(),
                addresses: vec!["10.0.0.5".into()],
                source: "MDNS".into(),
            },
            LmxMdnsCandidate {
                host: "192.168.1.12".into(),
                port: 9000,
                hostname: "lmx-a.local".into(),
                service_name: "office._opta-lmx._tcp.local".into(),
                addresses: vec!["192.168.1.12".into()],
                source: "mdns".into(),
            },
        ];

        let normalized = normalize_candidates(input);
        assert_eq!(normalized.len(), 2);
        assert_eq!(normalized[0].host, "10.0.0.5");
        assert_eq!(normalized[1].service_name, "office._opta-lmx._tcp.local");
        assert_eq!(normalized[1].addresses, vec!["192.168.1.12".to_string()]);
    }

    #[test]
    fn normalize_candidates_keeps_distinct_service_names() {
        let input = vec![
            LmxMdnsCandidate {
                host: "lmx-gateway.local.".into(),
                port: 4500,
                hostname: "LMX-GATEWAY.local.".into(),
                service_name: "b._opta-lmx._tcp.local.".into(),
                addresses: vec!["LMX-GATEWAY.local.".into()],
                source: "".into(),
            },
            LmxMdnsCandidate {
                host: "LMX-GATEWAY.local".into(),
                port: 4500,
                hostname: "lmx-gateway.local".into(),
                service_name: "a._opta-lmx._tcp.local".into(),
                addresses: vec!["lmx-gateway.local".into()],
                source: "mDns".into(),
            },
        ];

        let normalized = normalize_candidates(input);
        assert_eq!(normalized.len(), 2);
        assert_eq!(normalized[0].service_name, "a._opta-lmx._tcp.local");
        assert_eq!(normalized[1].service_name, "b._opta-lmx._tcp.local");
        assert_eq!(normalized[0].source, "mdns");
    }
}
