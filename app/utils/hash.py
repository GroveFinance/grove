"""Utilities for computing content hashes."""

import hashlib
from datetime import datetime
from decimal import Decimal


def compute_transaction_hash(
    account_id: str, posted: datetime | None, amount: Decimal, description: str
) -> str:
    """Compute SHA256 hash of transaction signature for deduplication.

    Args:
        account_id: Account ID
        posted: Posted datetime (can be None)
        amount: Transaction amount
        description: Transaction description

    Returns:
        64-character hex SHA256 hash
    """
    # Build signature string from transaction attributes
    # Format: account_id:posted_iso:amount:description
    posted_str = posted.isoformat() if posted else "none"
    sig = f"{account_id}:{posted_str}:{float(amount)}:{description or ''}"

    # Compute SHA256 hash
    return hashlib.sha256(sig.encode()).hexdigest()
