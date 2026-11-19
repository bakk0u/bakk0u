# Power Window lakehouse

An hourly Lakeflow Job reads yesterday, today and tomorrow in the Germany/Luxembourg bidding zone. Re-reading overlapping dates picks up published corrections and newly released delivery periods. The source is Bundesnetzagentur | SMARD.de via Fraunhofer ISE Energy-Charts, under CC BY 4.0. Price amounts are wholesale EUR/MWh. A delivery day follows Europe/Berlin time and contains 92, 96 or 100 quarter-hours.

| Dataset | Key | Purpose |
| --- | --- | --- |
| `bronze_snapshots` | Zone and SHA-256 of response bytes | Keep each distinct accepted response, URL, first retrieval time and licence |
| `silver_prices` | Zone and UTC interval start | Apply price corrections and explicit nulls using Delta MERGE |
| `gold_market_intervals` | Zone and UTC interval start | Serve priced intervals with exclusive end, local delivery date and last price change time |
| `gold_hour_windows` | Zone and UTC start of a complete hour | Compute a rolling mean only where four consecutive quarter-hours are priced |

A failed fetch or invalid payload raises a job error before any writes. A retry after the bronze write can finish the silver merge without duplicating the raw response. Unpublished future periods have no recommendation. Null prices remove a period from the serving view. A missing timestamp in a later partial response leaves the last reported value in the archive. The two gold views read committed silver rows. The job is limited to one concurrent run.

## Deploy

Use an authenticated Databricks CLI with a Unity Catalog workspace, serverless jobs compute and outbound HTTPS access to api.energy-charts.info. Give the job identity USE CATALOG and CREATE SCHEMA on the catalog, or provision the schema and grant USE SCHEMA and CREATE TABLE there. Give a separate serving identity USE CATALOG, USE SCHEMA and SELECT on the gold view, plus CAN USE on its SQL warehouse.

Run these commands from this directory. The first deployment leaves the recurring schedule paused.

```sh
databricks bundle validate -t prod --var catalog=main,schema=power_window
databricks bundle deploy -t prod --var catalog=main,schema=power_window
databricks bundle run -t prod refresh_prices
```

After the first successful run, enable the hourly schedule with `databricks bundle deploy -t prod --var catalog=main,schema=power_window,schedule_state=UNPAUSED`. Preserve those target variable values on later deployments. In the Databricks Jobs run history, check failures and always verify that the next requested delivery period exists before using its price.

```sql
SELECT start_epoch, end_epoch, eur_mwh, observed_at
FROM main.power_window.gold_market_intervals
WHERE zone = 'DE-LU'
  AND start_epoch >= unix_timestamp(current_timestamp())
ORDER BY start_epoch;
```

## Verify locally

```sh
python -m unittest discover -s tests -v
```

The parser rejects a mismatched unit or licence, invalid numbers, unaligned timestamps and duplicate source keys. Its tests cover both Berlin clock changes. The integration check below also runs Delta MERGE and both serving views against a temporary Spark SQL warehouse. It needs Java, PySpark 4.0.1, delta-spark 4.0.0 and the matching Delta jars.

```sh
spark-submit --master 'local[2]' --packages io.delta:delta-spark_2.13:4.0.0 tests/check_delta.py
```

[Energy-Charts API](https://api.energy-charts.info/) · [Source licence](https://creativecommons.org/licenses/by/4.0/) · [Databricks bundle examples](https://docs.databricks.com/aws/en/dev-tools/bundles/examples) · [Delta merge](https://docs.databricks.com/aws/en/delta/merge)
