# Databricks notebook source
from datetime import datetime, timedelta, timezone
from market import BERLIN, ZONE, fetch, gold_intervals_sql, hourly_windows_sql, namespace, read_prices

dbutils.widgets.text("catalog", "main")
dbutils.widgets.text("schema", "power_window")
ns = namespace(dbutils.widgets.get("catalog"), dbutils.widgets.get("schema"))
spark.conf.set("spark.sql.session.timeZone", "UTC")

today = datetime.now(BERLIN).date()
start, end = today - timedelta(days=1), today + timedelta(days=1)
raw, url, snapshot = fetch(start, end)
points, license_info = read_prices(raw, start, end)
observed = datetime.now(timezone.utc)

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {ns}")
spark.sql(f"""CREATE TABLE IF NOT EXISTS {ns}.bronze_snapshots (
    zone STRING, snapshot_sha STRING, source_url STRING, source_license STRING,
    observed_at TIMESTAMP, response_json STRING
) USING DELTA""")
spark.sql(f"""CREATE TABLE IF NOT EXISTS {ns}.silver_prices (
    zone STRING, start_epoch BIGINT, eur_mwh DOUBLE, snapshot_sha STRING, observed_at TIMESTAMP
) USING DELTA""")

spark.createDataFrame(
    [(ZONE, snapshot, url, license_info, observed, raw.decode("utf-8"))],
    "zone STRING, snapshot_sha STRING, source_url STRING, source_license STRING, observed_at TIMESTAMP, response_json STRING",
).createOrReplaceTempView("incoming_snapshot")
spark.sql(f"""MERGE INTO {ns}.bronze_snapshots AS target USING incoming_snapshot AS source
    ON target.zone = source.zone AND target.snapshot_sha = source.snapshot_sha
    WHEN NOT MATCHED THEN INSERT *""")

spark.createDataFrame(
    [(ZONE, epoch, price, snapshot, observed) for epoch, price in points],
    "zone STRING, start_epoch BIGINT, eur_mwh DOUBLE, snapshot_sha STRING, observed_at TIMESTAMP",
).createOrReplaceTempView("incoming_prices")
spark.sql(f"""MERGE INTO {ns}.silver_prices AS target USING incoming_prices AS source
    ON target.zone = source.zone AND target.start_epoch = source.start_epoch
    WHEN MATCHED AND NOT (source.eur_mwh <=> target.eur_mwh)
        AND source.observed_at >= target.observed_at THEN UPDATE SET *
    WHEN NOT MATCHED THEN INSERT *""")
spark.sql(f"CREATE OR REPLACE VIEW {ns}.gold_market_intervals AS " + gold_intervals_sql(ns))
spark.sql(f"CREATE OR REPLACE VIEW {ns}.gold_hour_windows AS " + hourly_windows_sql(ns))
print(f"{len(points)} source intervals processed for {ZONE}, snapshot {snapshot}")
