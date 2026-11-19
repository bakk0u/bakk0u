import json
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from market import bounds, namespace, read_prices


class MarketTests(unittest.TestCase):
    day = date(2026, 11, 19)
    epoch = bounds(day, day)[0]

    def parse(self, **changes):
        record = {"price": [-12.5, None], "unix_seconds": [self.epoch, self.epoch + 900],
                  "license_info": "CC BY 4.0 from Bundesnetzagentur | SMARD.de", "unit": "EUR / MWh"}
        record.update(changes)
        return read_prices(json.dumps(record).encode(), self.day, self.day)[0]

    def test_negative_and_unpublished_prices(self):
        self.assertEqual(self.parse(), [(self.epoch, -12.5), (self.epoch + 900, None)])

    def test_clock_change_days(self):
        for day, quarters in [(date(2026, 3, 29), 92), (date(2026, 10, 25), 100)]:
            start, end = bounds(day, day)
            self.assertEqual((end-start)//900, quarters)

    def test_invalid_inputs(self):
        for changes in [{"price": []}, {"price": [None, True]}, {"price": [None, float("nan")]},
                        {"unit": "EUR/kWh"}, {"license_info": "private only"},
                        {"unix_seconds": [self.epoch, self.epoch]}, {"unix_seconds": [1, 2]}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                self.parse(**changes)

    def test_sql_namespace(self):
        self.assertEqual(namespace("main", "power_window"), "`main`.`power_window`")
        with self.assertRaises(ValueError):
            namespace("main.other", "prices")
