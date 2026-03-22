from __future__ import annotations

import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlparse


class UnsafeUrlError(ValueError):
    pass


@dataclass(slots=True)
class ValidatedUrl:
    url: str
    hostname: str


def _hostname_allowed(hostname: str, allowlist: list[str]) -> bool:
    if not allowlist:
        return True
    host = hostname.lower().rstrip(".")
    return any(host == allowed or host.endswith(f".{allowed}") for allowed in allowlist)


PRIVATE_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def validate_public_url(raw_url: str, allowlist: list[str]) -> ValidatedUrl:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeUrlError("Only http and https URLs are allowed.")

    hostname = parsed.hostname
    if not hostname:
        raise UnsafeUrlError("URL must include a hostname.")

    host = hostname.lower().rstrip(".")
    if host in {"localhost", "0.0.0.0"}:
        raise UnsafeUrlError("Localhost URLs are not allowed.")

    if not _hostname_allowed(host, allowlist):
        raise UnsafeUrlError("Hostname is not in PUBLIC_CRAWL_ALLOWLIST.")

    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise UnsafeUrlError("Hostname could not be resolved.") from exc

    for info in infos:
        address = info[4][0]
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            continue
        if any(ip in network for network in PRIVATE_NETWORKS):
            raise UnsafeUrlError("Private, loopback, or link-local addresses are not allowed.")

    return ValidatedUrl(url=raw_url, hostname=host)
