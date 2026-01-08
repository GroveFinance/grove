"""
Payee name normalization utilities.

Handles normalization of check-style payee names to reduce clutter from numbered checks.
"""

import re


def normalize_check_payee(payee_name: str, description: str = "") -> str:
    """
    Normalize check payee names to avoid clutter from check numbers.

    Detects payee names like "Check #1234" and attempts to extract a more
    meaningful payee name from the transaction description. Falls back to
    generic "Check" if no meaningful name can be extracted.

    Args:
        payee_name: The original payee name from the bank
        description: The transaction description (may contain more detail)

    Returns:
        Normalized payee name (extracted from description, or "Check", or original)

    Examples:
        >>> normalize_check_payee("Check #1234", "Check #1234 - John's Plumbing")
        "John's Plumbing"

        >>> normalize_check_payee("Check #1234", "Check #1234")
        "Check"

        >>> normalize_check_payee("Amazon", "Purchase at Amazon")
        "Amazon"
    """
    if not payee_name:
        return payee_name

    # Pattern to detect check-style payee names
    # Matches: "Check #1234", "CHECK 5678", "Check No. 999", "Check Paid #1234", etc.
    check_pattern = r"^check\s+(paid\s+)?(#|no\.?)?\s*\d+$"

    if not re.match(check_pattern, payee_name, re.IGNORECASE):
        # Not a check payee, return as-is
        return payee_name

    # This is a check payee - try to extract a better name from description
    extracted_name = _extract_payee_from_description(description)

    if extracted_name:
        return extracted_name

    # No meaningful name found, use generic "Check"
    return "Check"


def _extract_payee_from_description(description: str) -> str | None:
    """
    Attempt to extract a meaningful payee name from a transaction description.

    Tries multiple common patterns used by banks to embed payee information
    in check descriptions.

    Args:
        description: Transaction description string

    Returns:
        Extracted payee name, or None if no pattern matches
    """
    if not description:
        return None

    # Extraction patterns (in priority order)
    # Each pattern should have exactly one capture group for the payee name
    patterns = [
        r"check\s*#?\d+\s*[-–]\s*(.+?)(?:\s*[-–]|$)",  # "Check #1234 - Payee Name"
        r"check\s*#?\d+\s*to\s+(.+?)(?:\s*[-–]|$)",  # "Check #1234 to Payee Name"
        r"check\s+payment\s+to\s+(.+?)(?:\s*[-–]|$)",  # "Check payment to Payee"
        r"check\s*#?\d+\s*payable\s+to\s+(.+?)(?:\s*[-–]|$)",  # "Check #1234 payable to Payee"
    ]

    for pattern in patterns:
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            extracted_name = match.group(1).strip()
            if extracted_name and not re.match(r"^check\s*#?\d+$", extracted_name, re.IGNORECASE):
                # Found a name that isn't just another check number
                return extracted_name

    return None
