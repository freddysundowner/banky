import httpx
import time
from typing import Dict, Optional

_cached_rates: Dict[str, float] = {}
_cache_timestamp: float = 0
_CACHE_TTL = 3600 * 6

EXCHANGE_RATE_API_URL = "https://open.exchangerate-api.com/v6/latest/USD"

FALLBACK_RATES = {
    "KES": 130.0,
    "NGN": 1550.0,
    "GHS": 16.0,
    "ZAR": 18.5,
    "USD": 1.0,
}


async def fetch_exchange_rates() -> Dict[str, float]:
    global _cached_rates, _cache_timestamp

    if _cached_rates and (time.time() - _cache_timestamp) < _CACHE_TTL:
        return _cached_rates

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(EXCHANGE_RATE_API_URL)
            if response.status_code == 200:
                data = response.json()
                all_rates = data.get("rates", {})
                _cached_rates = {
                    "USD": 1.0,
                    "KES": all_rates.get("KES", FALLBACK_RATES["KES"]),
                    "NGN": all_rates.get("NGN", FALLBACK_RATES["NGN"]),
                    "GHS": all_rates.get("GHS", FALLBACK_RATES["GHS"]),
                    "ZAR": all_rates.get("ZAR", FALLBACK_RATES["ZAR"]),
                }
                _cache_timestamp = time.time()
                print(f"[ExchangeRate] Fetched live rates: {_cached_rates}")
                return _cached_rates
    except Exception as e:
        print(f"[ExchangeRate] Error fetching rates: {e}")

    if _cached_rates:
        print("[ExchangeRate] Using previously cached rates")
        return _cached_rates

    print("[ExchangeRate] Using fallback rates")
    _cached_rates = FALLBACK_RATES.copy()
    _cache_timestamp = time.time()
    return _cached_rates


def convert_usd_to(amount_usd: float, target_currency: str, rates: Dict[str, float]) -> float:
    if target_currency == "USD":
        return amount_usd
    rate = rates.get(target_currency, 1.0)
    converted = amount_usd * rate
    return round(converted)


def get_currency_symbol(currency: str) -> str:
    symbols = {
        "USD": "$",
        "KES": "KES ",
        "NGN": "₦",
        "GHS": "GH₵",
        "ZAR": "R",
    }
    return symbols.get(currency, currency + " ")


def get_cached_rates() -> Dict[str, float]:
    if _cached_rates:
        return _cached_rates
    return FALLBACK_RATES.copy()
