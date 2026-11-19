"""DE-LU day-ahead quarter-hour records from public Energy-Charts responses."""
from datetime import date, datetime, time, timedelta
from hashlib import sha256
import json
from math import isfinite
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

BERLIN = ZoneInfo("Europe/Berlin")
ZONE = "DE-LU"
QUARTER_SECONDS = 900


def namespace(catalog, schema):
    for identifier in (catalog, schema):
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", identifier):
            raise ValueError("Catalog and schema must be simple SQL identifiers")
    return f"`{catalog}`.`{schema}`"


def bounds(start: date, end: date):
    if start > end or start < date(2025, 10, 1):
        raise ValueError("Expected a DE-LU quarter-hour delivery date range")
    first = datetime.combine(start, time.min, BERLIN)
    stop = datetime.combine(end + timedelta(days=1), time.min, BERLIN)
    return int(first.timestamp()), int(stop.timestamp())


def read_prices(payload: bytes, start: date, end: date):
    lower, upper = bounds(start, end)
    data = json.loads(payload)
    license_info = data.get("license_info") or ""
    if "CC BY 4.0" not in license_info or "SMARD" not in license_info:
        raise ValueError("Unexpected source licence or attribution")
    if data.get("unit") != "EUR / MWh":
        raise ValueError("Expected EUR / MWh")
    times, prices = data.get("unix_seconds"), data.get("price")
    if not isinstance(times, list) or not isinstance(prices, list) or not times or len(times) != len(prices):
        raise ValueError("Expected aligned, nonempty timestamp and price arrays")
    result = []
    for epoch, price in zip(times, prices):
        if (type(epoch) is not int or epoch % QUARTER_SECONDS or not lower <= epoch < upper
                or (result and epoch <= result[-1][0])):
            raise ValueError("Timestamp outside range, duplicated, unordered or off grid")
        if price is not None and (type(price) not in (float, int) or not isfinite(price)):
            raise ValueError("Price must be finite or null")
        result.append((epoch, float(price) if price is not None else None))
    return result, license_info


def fetch(start, end):
    bounds(start, end)
    url = "https://api.energy-charts.info/price?" + urlencode(
        {"bzn": ZONE, "start": start.isoformat(), "end": end.isoformat()}
    )
    request = Request(url, headers={"User-Agent": "PowerWindow/1.0", "Accept": "application/json"})
    with urlopen(request, timeout=30) as response:
        payload = response.read(1_000_001)
    if len(payload) > 1_000_000:
        raise ValueError("Response exceeded the expected market snapshot size")
    return payload, url, sha256(payload).hexdigest()


def gold_intervals_sql(ns):
    return f"""
        SELECT zone, start_epoch, start_epoch + 900 AS end_epoch, eur_mwh,
               to_date(from_utc_timestamp(timestamp_seconds(start_epoch), 'Europe/Berlin')) AS delivery_date,
               observed_at
        FROM {ns}.silver_prices
        WHERE eur_mwh IS NOT NULL
    """


def hourly_windows_sql(ns):
    # Each row covers exactly 900 seconds. Four unique starts inside an elapsed
    # 45-minute range guarantee four consecutive market intervals, including DST.
    return f"""
        SELECT zone, delivery_date, start_epoch, start_epoch + 3600 AS end_epoch,
               mean_eur_mwh
        FROM (
            SELECT *, count(*) OVER w AS quarters, avg(eur_mwh) OVER w AS mean_eur_mwh
            FROM {ns}.gold_market_intervals
            WINDOW w AS (PARTITION BY zone ORDER BY start_epoch
                         RANGE BETWEEN CURRENT ROW AND 2700 FOLLOWING)
        ) AS candidates WHERE quarters = 4
    """
