"""Minimal license stub for offline demo (always alive)."""
class _S:
    alive = True
    product = "trugame"
    mode = "demo"
def reset_for_testing(): pass
def create_entitlement(**kw): return "demo-token"
def apply_entitlement(tok): return _S()
def require_alive(product="trugame"): return _S()
def gate(product="trugame"): return _S()
