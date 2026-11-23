# Power Window

The public interactive demo is maintained in the [Power Window demo repository](https://github.com/bakk0u/Power-window). [Open the demo](https://bakk0u.github.io/Power-window/).

Choose a delivery day, a run time and an average power draw. Power Window finds the cheapest continuous period still available in the German/Luxembourg day-ahead market and estimates its wholesale energy cost. It uses quarter-hour delivery intervals and displays Europe/Berlin time, including the UTC offset in the interval table.

Choose a finish time to fit a run into your day. The planner compares the recommended window with the earliest feasible start on the same day. Power accepts up to two decimal places with a comma or a point, for example `1250,75`. Your browser remembers the last valid power and duration on this device. Euro estimates display to the nearest cent.

## Run the application

Use Node 22 or later. Run `npm test` followed by `npm run dev` and open http://localhost:5173. No npm dependencies or API key are required for the market-feed mode. The deployed Worker serves the frontend and `GET /api/prices` from one origin. Successful price responses are cached for five minutes. A failed live refresh is labelled in the interface.

## Backend

The serving layer reads newly published prices from Energy-Charts and retries directly against SMARD quarter-hour data when the primary feed is unavailable. For ongoing analysis, the [Databricks bundle](lakehouse/README.md) ingests the same source into Delta tables. Its hourly job can be enabled after deployment. Use the gold interval view to switch the serving backend to Databricks SQL.

| Server setting | Value |
| --- | --- |
| DBX_HOST | HTTPS origin of the Databricks workspace |
| DBX_WAREHOUSE_ID | SQL warehouse ID |
| DBX_INTERVAL_TABLE | Fully qualified gold_market_intervals view, e.g. main.power_window.gold_market_intervals |
| DBX_TOKEN | Server-side workspace credential with warehouse use and read access to the view |

Configure all four settings together. With warehouse settings present, a failed query returns an unavailable status. The UI displays the data source used. Setup and runtime can incur Databricks charges.

Prices are EUR/MWh in storage. The display divides by ten for ct/kWh. Cost in euros uses average EUR/MWh × kW × hours ÷ 1,000. Missing intervals break candidate windows. Tied windows use the earliest available start. A constant-price retail contract does not pass wholesale changes through to the customer's bill.

## Source

German/Luxembourg day-ahead prices from Bundesnetzagentur | SMARD.de via [Fraunhofer ISE Energy-Charts](https://api.energy-charts.info/), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Window selection and derived costs are calculated by this application.
