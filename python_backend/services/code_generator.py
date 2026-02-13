import uuid
from datetime import date


def generate_code(prefix: str) -> str:
    today = date.today().strftime("%Y%m%d")
    suffix = uuid.uuid4().hex[:6].upper()
    return f"{prefix}{today}{suffix}"


def generate_txn_code() -> str:
    return generate_code("TXN")


def generate_journal_code() -> str:
    return generate_code("JE")


def generate_fd_code() -> str:
    return generate_code("FD")


def generate_repayment_code() -> str:
    return generate_code("REP")
