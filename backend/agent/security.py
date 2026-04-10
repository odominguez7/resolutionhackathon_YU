"""
YU agent security guardrails (Q32 application).

Egress allowlist: every outbound HTTP call from the agent layer should pass
through assert_egress_allowed() so a confused-deputy or prompt-injection
attack cannot exfiltrate data to an arbitrary host.

Memory provenance: tag any long-term memory write with its source so
poisoned facts can be traced and revoked.
"""

from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

BOSTON_TZ = ZoneInfo("America/New_York")

# Hosts the YU agent is allowed to talk to. Anything else is blocked.
EGRESS_ALLOWLIST = {
    "generativelanguage.googleapis.com",  # Gemini
    "api.ouraring.com",                   # Oura
    "cloud.ouraring.com",
    "api.telegram.org",                   # Telegram notify
    "firestore.googleapis.com",
    "us-east1-firestore.googleapis.com",
    "oauth2.googleapis.com",
    "graph.facebook.com",             # WhatsApp Business Cloud API
}


class EgressBlocked(Exception):
    pass


def assert_egress_allowed(url: str) -> None:
    """Raise EgressBlocked if the URL host is not in the allowlist."""
    host = urlparse(url).hostname or ""
    if host not in EGRESS_ALLOWLIST:
        raise EgressBlocked(f"egress blocked: {host} not in allowlist")


def provenance_tag(source: str, trust: str = "internal") -> dict:
    """Standard provenance tag for memory writes and RAG chunks.
    trust: internal | user | external | model_generated
    """
    return {
        "source": source,
        "trust": trust,
        "recorded_at": datetime.now(BOSTON_TZ).isoformat(),
    }
