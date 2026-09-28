from __future__ import annotations

V1_LONG_RULE = {
    "version": 1,
    "entry": "long",
    "all": [
        {"op": "gt", "left": {"sma": 20}, "right": {"sma": 50}},
        {"op": "lt", "left": {"rsi": 14}, "right": {"value": 70}},
    ],
}

V2_LONG_RULE = {
    "version": 2,
    "entry": {
        "all": [
            {"op": "gt", "left": {"sma": 20}, "right": {"sma": 50}},
            {"op": "lt", "left": {"rsi": 14}, "right": {"value": 70}},
        ]
    },
    "exit": {
        "any": [
            {"op": "lte", "left": {"sma": 20}, "right": {"sma": 50}},
            {"op": "gte", "left": {"rsi": 14}, "right": {"value": 70}},
        ]
    },
}

INITIAL_CASH = "100000"
