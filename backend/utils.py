import re
import unicodedata


def slugify(name: str) -> str:
    """
    Normalize string to ASCII, replace non-alphanumeric chars with dashes,
    lowercase, strip extra dashes. If empty, return 'prompt'.
    """
    if not name:
        return "prompt"

    # Normalize to NFKD and encode to ASCII
    normalized = unicodedata.normalize("NFKD", name)
    ascii_str = normalized.encode("ascii", "ignore").decode("ascii")

    # Replace non-alphanumeric with dashes
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_str)
    slug = slug.strip("-").lower()

    if not slug:
        slug = "prompt"

    return slug



