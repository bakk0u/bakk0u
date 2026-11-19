"""Exercise the deployed notebook with local Spark, Delta and a controlled upstream feed."""
import hashlib
import json
import os
import runpy
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch

from pyspark.sql import SparkSession

SRC = Path(__file__).resolve().parents[1] / "src"
sys.path.insert(0, str(SRC))
import market


def run(spark):
    widgets = Mock()
    widgets.get.side_effect = {"catalog": "spark_catalog", "schema": "pwtest"}.__getitem__
    today = datetime.now(market.BERLIN).date()
    start, _ = market.bounds(today, today)
    points = [start + i * 900 for i in range(6)]

    def refresh(prices):
        payload = {"unix_seconds": points, "price": prices, "unit": "EUR / MWh",
                   "license_info": "CC BY 4.0 SMARD test fixture"}
        raw = json.dumps(payload).encode()
        fixture = (raw, "local-fixture", hashlib.sha256(raw).hexdigest())
        with patch.object(market, "fetch", return_value=fixture):
            runpy.run_path(str(SRC / "refresh.py"),
                           init_globals={"spark": spark, "dbutils": Mock(widgets=widgets)})

    def table(name):
        return spark.table(f"spark_catalog.pwtest.{name}")

    refresh([10, 20, 30, 40, None, 50])
    refresh([10, 20, 30, 40, None, 50])
    assert table("bronze_snapshots").count() == 1
    assert table("silver_prices").count() == 6
    assert table("gold_market_intervals").count() == 5
    windows = table("gold_hour_windows").collect()
    assert len(windows) == 1 and windows[0].start_epoch == start and windows[0].mean_eur_mwh == 25
    refresh([10, 20, 30, 40, 0, 50])
    assert table("bronze_snapshots").count() == 2
    assert table("silver_prices").count() == 6
    assert table("gold_hour_windows").count() == 3


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as workspace:
        original = Path.cwd()
        os.chdir(workspace)
        try:
            spark = (SparkSession.builder.appName("Power Window validation")
                     .config("spark.sql.warehouse.dir", f"{workspace}/warehouse")
                     .config("spark.sql.shuffle.partitions", "1")
                     .config("spark.databricks.delta.snapshotPartitions", "1")
                     .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
                     .config("spark.sql.catalog.spark_catalog", "org.apache.spark.sql.delta.catalog.DeltaCatalog")
                     .getOrCreate())
            try:
                run(spark)
                print("PASS: duplicate delivery, corrected price, missing interval and consecutive hourly windows")
            finally:
                spark.stop()
        finally:
            os.chdir(original)
