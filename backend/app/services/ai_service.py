"""Claude AI service — network diagnostics, config analysis, log interpretation, chat, reports."""
from __future__ import annotations

import json
from typing import Any, AsyncIterator

import anthropic

from app.config import settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

_client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """You are NetSupportAI, a senior network engineer with 20+ years of experience.

Your deep expertise covers:
- Cisco IOS / IOS-XE / NX-OS — routing, switching, BGP, OSPF, EIGRP, spanning tree, QoS
- MikroTik RouterOS — all menu paths, scripting, Winbox, CLI /export and /import
- IPSec VPN, GRE tunnels, MPLS, SD-WAN troubleshooting
- Juniper Junos, Huawei VRP, Palo Alto PAN-OS, Fortinet FortiOS
- Linux networking — iptables/nftables, iproute2, tcpdump, netstat, ss
- Network monitoring — SNMP, NetFlow, syslog analysis
- Security — firewall auditing, ACL review, CVE awareness

When diagnosing issues:
1. Identify the most probable root cause first
2. List specific, actionable fix steps
3. Provide exact CLI commands (Cisco or MikroTik) where applicable
4. Flag security risks or data-loss risks immediately
5. Estimate confidence honestly based on available evidence
6. Recommend escalation only when genuinely needed"""


def _strip_code_fence(text: str) -> str:
    """Remove markdown code fences from AI response."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # remove opening fence line
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()


# ─── 1. Ticket diagnosis ─────────────────────────────────────────────────────

async def diagnose_ticket(
    ticket_description: str,
    device_info: str = "",
    logs: str = "",
    additional_context: str = "",
) -> dict[str, Any]:
    """
    Diagnose a support ticket. Returns structured JSON with:
    diagnosis, root_cause, fix_steps[], cli_commands[], confidence_score, escalate_to_human.
    """
    context_parts = []
    if device_info:
        context_parts.append(f"DEVICE INFO:\n{device_info}")
    if logs:
        context_parts.append(f"LOGS/OUTPUT:\n{logs[:6000]}")
    if additional_context:
        context_parts.append(f"ADDITIONAL CONTEXT:\n{additional_context}")

    prompt = f"""Analyse this IT support ticket and respond ONLY with valid JSON.

TICKET DESCRIPTION:
{ticket_description}

{chr(10).join(context_parts)}

Respond with exactly this JSON schema:
{{
  "diagnosis": "2-3 sentence technical diagnosis",
  "root_cause": "single sentence identifying the root cause",
  "fix_steps": ["step 1", "step 2", "step 3"],
  "cli_commands": ["command1", "command2"],
  "confidence_score": 0.85,
  "escalate_to_human": false,
  "category": "connectivity|vpn|bgp|ospf|routing|hardware|config|other",
  "priority": "low|medium|high|critical",
  "estimated_resolution_minutes": 30,
  "security_risk": false,
  "prevention_tips": ["tip 1", "tip 2"]
}}"""

    try:
        response = await _client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _strip_code_fence(response.content[0].text)
        result = json.loads(raw)
        logger.info("AI ticket diagnosis complete")
        return result
    except json.JSONDecodeError:
        logger.warning("AI returned non-JSON for ticket diagnosis")
        return {
            "diagnosis": response.content[0].text if "response" in dir() else "AI unavailable",
            "root_cause": "Unable to parse structured response",
            "fix_steps": [],
            "cli_commands": [],
            "confidence_score": 0.0,
            "escalate_to_human": True,
        }
    except Exception as exc:
        logger.error(f"AI diagnosis error: {exc}")
        return {"error": str(exc), "confidence_score": 0.0, "escalate_to_human": True}


# ─── 2. Config analysis ──────────────────────────────────────────────────────

async def analyze_config(config_text: str, device_type: str = "cisco") -> dict[str, Any]:
    """
    Analyse a raw device configuration for security issues, misconfigurations, and optimisations.
    """
    prompt = f"""Analyse this {device_type} network device configuration.

CONFIG:
{config_text[:10000]}

Respond ONLY with valid JSON:
{{
  "security_issues": [
    {{"severity": "critical|high|medium|low", "issue": "description", "recommendation": "fix"}}
  ],
  "misconfigurations": [
    {{"issue": "description", "correct_config": "what it should be"}}
  ],
  "optimization_suggestions": ["suggestion 1", "suggestion 2"],
  "compliance_checks": [
    {{"check": "name", "passed": true, "detail": "explanation"}}
  ],
  "overall_security_score": 72,
  "summary": "2-3 sentence overall assessment"
}}"""

    try:
        response = await _client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=3000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _strip_code_fence(response.content[0].text)
        return json.loads(raw)
    except Exception as exc:
        logger.error(f"Config analysis error: {exc}")
        return {"error": str(exc)}


# ─── 3. Syslog / log interpretation ──────────────────────────────────────────

async def interpret_syslog(log_lines: str, device_type: str = "cisco") -> dict[str, Any]:
    """
    Parse syslog / log output and identify error patterns with recommended actions.
    """
    prompt = f"""Analyse these {device_type} syslog / system log entries.

LOGS:
{log_lines[:8000]}

Identify ALL notable events. Respond ONLY with valid JSON:
{{
  "error_patterns": [
    {{
      "pattern": "BGP neighbor down|OSPF adjacency lost|IKE failure|interface error|CPU spike|etc",
      "occurrences": 3,
      "severity": "critical|warning|info",
      "timestamps": ["2024-01-01 12:00:00"],
      "interpretation": "human-readable explanation",
      "recommended_action": "what to do"
    }}
  ],
  "timeline_summary": "narrative of what happened over the log period",
  "critical_events_count": 2,
  "recommended_actions": ["action 1", "action 2"],
  "requires_immediate_attention": false
}}"""

    try:
        response = await _client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=3000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = _strip_code_fence(response.content[0].text)
        return json.loads(raw)
    except Exception as exc:
        logger.error(f"Syslog interpretation error: {exc}")
        return {"error": str(exc)}


# ─── 4. Streaming multi-turn chat ────────────────────────────────────────────

async def chat_stream(
    messages: list[dict[str, str]],
    context: str = "",
    system_override: str | None = None,
) -> AsyncIterator[str]:
    """Stream a conversational response token-by-token (for SSE endpoints)."""
    system = system_override or (
        SYSTEM_PROMPT + (f"\n\nCURRENT CONTEXT:\n{context}" if context else "")
    )
    async with _client.messages.stream(
        model=settings.CLAUDE_MODEL,
        max_tokens=settings.CLAUDE_MAX_TOKENS,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


# ─── 5. Network health report ────────────────────────────────────────────────

async def generate_network_report(
    client_name: str,
    time_range: str,
    stats: dict[str, Any],
) -> str:
    """
    Generate a professional markdown network health report for a client.
    """
    prompt = f"""Generate a professional network health report for client: {client_name}
Period: {time_range}

STATISTICS:
{json.dumps(stats, indent=2)}

Write a professional markdown report with:
- Executive Summary (2-3 sentences)
- Key Metrics table
- Incident Analysis (top issues)
- Uptime Summary
- Recommendations (3-5 actionable items)
- Conclusion

Use professional language suitable for both technical and non-technical readers."""

    response = await _client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=3000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text


# ─── 6. Ticket auto-classification ──────────────────────────────────────────

async def suggest_ticket_category(title: str, description: str = "") -> dict[str, str]:
    """Auto-classify a ticket's category and priority."""
    response = await _client.messages.create(
        model=settings.CLAUDE_MODEL,
        max_tokens=200,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f'Classify this IT ticket. Respond ONLY with JSON: {{"category": "connectivity|vpn|bgp|ospf|routing|hardware|config|other", "priority": "low|medium|high|critical", "reason": "one sentence"}}\n\nTitle: {title}\nDescription: {description}',
        }],
    )
    try:
        return json.loads(_strip_code_fence(response.content[0].text))
    except Exception:
        return {"category": "other", "priority": "medium", "reason": "Auto-classification unavailable"}
