"""
ML models for YU Training OS (v2.1 AI/ML system).

1. Readiness scorer — XGBoost predicting load-absorption capacity (0-100)
2. Dosage policy v0 — contextual bandit (LinUCB) for load selection
3. Multi-signal overtraining guardian — anomaly detection across 4+ signals

All models cold-start with heuristics and improve as data accumulates.
Per the v2.1 spec: "shared backbone, per-user head" — for now, single
user with the heuristic fallback as the population model.
"""

from __future__ import annotations

import json
import math
import os
import pickle
from datetime import datetime
from typing import Any

import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "ml_models")
os.makedirs(MODEL_DIR, exist_ok=True)

GCS_BUCKET = "resolution-hack-ml-models"
GCS_PREFIX = "yu-restos/"


def _gcs_upload(local_path: str, gcs_name: str):
    """Upload a model file to GCS for persistence across deploys."""
    try:
        from google.cloud import storage
        client = storage.Client(project="resolution-hack")
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(f"{GCS_PREFIX}{gcs_name}")
        blob.upload_from_filename(local_path)
    except Exception as e:
        print(f"[ml] GCS upload failed: {e}")


def _gcs_download(gcs_name: str, local_path: str) -> bool:
    """Download a model file from GCS. Returns True if successful."""
    try:
        from google.cloud import storage
        client = storage.Client(project="resolution-hack")
        bucket = client.bucket(GCS_BUCKET)
        blob = bucket.blob(f"{GCS_PREFIX}{gcs_name}")
        if blob.exists():
            blob.download_to_filename(local_path)
            return True
    except Exception as e:
        print(f"[ml] GCS download failed: {e}")
    return False


# ═══════════════════════════════════════════════════════════════════════════
# 1. READINESS SCORER (XGBoost)
# ═══════════════════════════════════════════════════════════════════════════

def _build_readiness_features(bio: dict, baseline: dict) -> list[float]:
    """Extract feature vector for readiness prediction.
    Features: hrv_z, rhr_delta, sleep_score, deep_sleep_ratio,
              sleep_debt_proxy, stress_min, resp_rate_delta."""
    hrv = bio.get("hrv") or 0
    hrv_bl = (baseline.get("hrv") or {}).get("ewma") or hrv or 1
    rhr = bio.get("rhr") or 0
    rhr_bl = (baseline.get("rhr") or {}).get("ewma") or rhr or 1
    sleep = bio.get("sleep_score") or 70
    deep = bio.get("deep_min") or 0
    total = bio.get("total_sleep_hrs") or 7
    stress = bio.get("stress_min") or 0

    hrv_z = (hrv - hrv_bl) / max(1, (baseline.get("hrv") or {}).get("std") or 5)
    rhr_delta = rhr - rhr_bl
    deep_ratio = deep / max(1, total * 60) * 100  # % of total sleep
    sleep_debt = max(0, 7.5 - total)  # hours under 7.5

    return [hrv_z, rhr_delta, sleep, deep_ratio, sleep_debt, stress]


def train_readiness_model(training_data: list[dict]) -> dict:
    """Train an XGBoost readiness model from historical data.
    training_data: [{features: [float], label: float (readiness 0-100)}]
    Returns: model stats. Model saved to disk."""
    if len(training_data) < 20:
        return {"error": "Need at least 20 samples", "n": len(training_data)}

    try:
        import xgboost as xgb
        X = np.array([d["features"] for d in training_data])
        y = np.array([d["label"] for d in training_data])

        model = xgb.XGBRegressor(
            n_estimators=50,
            max_depth=3,
            learning_rate=0.1,
            objective="reg:squarederror",
        )
        model.fit(X, y)

        path = os.path.join(MODEL_DIR, "readiness_xgb.pkl")
        with open(path, "wb") as f:
            pickle.dump(model, f)
        # Persist to GCS so model survives deploys + scale-to-zero
        _gcs_upload(path, "readiness_xgb.pkl")

        preds = model.predict(X)
        mae = float(np.mean(np.abs(preds - y)))
        return {"trained": True, "n": len(training_data), "mae": round(mae, 2), "path": path, "gcs": True}
    except Exception as e:
        return {"error": str(e)[:200]}


def predict_readiness(bio: dict, baseline: dict) -> dict:
    """Predict readiness score. Uses XGBoost if trained, else heuristic."""
    features = _build_readiness_features(bio, baseline)

    # Try trained model: local first, then GCS
    path = os.path.join(MODEL_DIR, "readiness_xgb.pkl")
    if not os.path.exists(path):
        _gcs_download("readiness_xgb.pkl", path)
    if os.path.exists(path):
        try:
            with open(path, "rb") as f:
                model = pickle.load(f)
            pred = float(model.predict(np.array([features]))[0])
            return {
                "score": round(max(0, min(100, pred)), 1),
                "source": "xgboost",
                "features": features,
            }
        except Exception:
            pass

    # Heuristic fallback (the 4-tier system, linearized)
    hrv_z = features[0]
    rhr_delta = features[1]
    sleep = features[2]
    sleep_debt = features[4]
    stress = features[5]

    score = 50 + (hrv_z * 10) - (rhr_delta * 2) + ((sleep - 70) * 0.5) - (sleep_debt * 5) - (stress * 0.1)
    score = max(0, min(100, score))
    return {
        "score": round(score, 1),
        "source": "heuristic",
        "features": features,
    }


# ═══════════════════════════════════════════════════════════════════════════
# 2. DOSAGE POLICY v0 (LinUCB contextual bandit)
# ═══════════════════════════════════════════════════════════════════════════

class LinUCBDosage:
    """Contextual bandit for load selection.
    Context: readiness_score, hrv_z, days_since_last_heavy, consecutive_clean
    Arms: load options (e.g. 35, 40, 45, 50 lb)
    Reward: completion (1/0) * RPE_proximity * next_day_hrv_recovery"""

    def __init__(self, n_arms: int = 4, d: int = 4, alpha: float = 1.0):
        self.n_arms = n_arms
        self.d = d
        self.alpha = alpha
        self.A = [np.eye(d) for _ in range(n_arms)]
        self.b = [np.zeros(d) for _ in range(n_arms)]
        self.arm_labels = [35, 40, 45, 50]  # load options in lbs

    def select(self, context: list[float]) -> dict:
        """Select the best load given context. Returns {arm, load_lbs, ucb_scores}."""
        x = np.array(context[:self.d])
        ucb_scores = []
        for a in range(self.n_arms):
            A_inv = np.linalg.inv(self.A[a])
            theta = A_inv @ self.b[a]
            p = float(theta @ x + self.alpha * math.sqrt(x @ A_inv @ x))
            ucb_scores.append(p)
        best = int(np.argmax(ucb_scores))
        return {
            "arm": best,
            "load_lbs": self.arm_labels[best],
            "ucb_scores": [round(s, 3) for s in ucb_scores],
            "source": "linucb",
        }

    def update(self, arm: int, context: list[float], reward: float):
        """Update the model after observing a reward."""
        x = np.array(context[:self.d])
        self.A[arm] += np.outer(x, x)
        self.b[arm] += reward * x

    def save(self, path: str | None = None):
        path = path or os.path.join(MODEL_DIR, "dosage_linucb.pkl")
        with open(path, "wb") as f:
            pickle.dump({"A": self.A, "b": self.b, "arm_labels": self.arm_labels}, f)
        _gcs_upload(path, "dosage_linucb.pkl")

    def load(self, path: str | None = None):
        path = path or os.path.join(MODEL_DIR, "dosage_linucb.pkl")
        if not os.path.exists(path):
            _gcs_download("dosage_linucb.pkl", path)
        if os.path.exists(path):
            with open(path, "rb") as f:
                data = pickle.load(f)
            self.A = data["A"]
            self.b = data["b"]
            self.arm_labels = data.get("arm_labels", self.arm_labels)


def get_dosage_recommendation(readiness: float, hrv_z: float,
                               days_since_heavy: int, consecutive_clean: int) -> dict:
    """Get a load recommendation from the dosage policy."""
    policy = LinUCBDosage()
    policy.load()
    context = [readiness / 100, hrv_z, min(days_since_heavy, 7) / 7, min(consecutive_clean, 5) / 5]
    return policy.select(context)


def update_dosage_policy(readiness: float, hrv_z: float,
                          days_since_heavy: int, consecutive_clean: int,
                          arm: int, reward: float):
    """Update the dosage policy after a session. Reward = completion * RPE_proximity * recovery."""
    policy = LinUCBDosage()
    policy.load()
    context = [readiness / 100, hrv_z, min(days_since_heavy, 7) / 7, min(consecutive_clean, 5) / 5]
    policy.update(arm, context, reward)
    policy.save()


# ═══════════════════════════════════════════════════════════════════════════
# 3. MULTI-SIGNAL OVERTRAINING GUARDIAN
# ═══════════════════════════════════════════════════════════════════════════

def compute_overtraining_risk(
    hrv: float | None,
    rhr: float | None,
    resp_rate: float | None,
    deep_sleep_ratio: float | None,
    hrv_baseline: dict | None = None,
    rhr_baseline: dict | None = None,
) -> dict:
    """Multi-signal overtraining risk assessment.
    Checks HRV, RHR, respiratory rate, and deep sleep ratio against
    their baselines and control limits. Returns a risk level and
    the contributing signals.

    Risk levels: none / watch / elevated / veto
    v2.1 spec: "If HRV crosses the lower EWMA limit, raises overtraining.risk"
    """
    signals: list[dict] = []
    risk_score = 0  # accumulates, thresholds below

    # Signal 1: HRV below LCL
    if hrv is not None and hrv_baseline:
        lcl = hrv_baseline.get("lcl")
        ewma = hrv_baseline.get("ewma")
        if lcl is not None and hrv < lcl:
            signals.append({"signal": "hrv", "value": hrv, "threshold": lcl, "direction": "below_lcl"})
            risk_score += 2
        elif ewma and hrv < ewma:
            signals.append({"signal": "hrv", "value": hrv, "threshold": ewma, "direction": "below_mean"})
            risk_score += 1

    # Signal 2: RHR above UCL
    if rhr is not None and rhr_baseline:
        ucl = rhr_baseline.get("ucl")
        ewma = rhr_baseline.get("ewma")
        if ucl is not None and rhr > ucl:
            signals.append({"signal": "rhr", "value": rhr, "threshold": ucl, "direction": "above_ucl"})
            risk_score += 2
        elif ewma and rhr > ewma:
            signals.append({"signal": "rhr", "value": rhr, "threshold": ewma, "direction": "above_mean"})
            risk_score += 1

    # Signal 3: Respiratory rate elevated (>2 br/min above typical ~15)
    if resp_rate is not None and resp_rate > 17:
        signals.append({"signal": "respiratory_rate", "value": resp_rate, "threshold": 17, "direction": "elevated"})
        risk_score += 1
        if resp_rate > 19:
            risk_score += 1  # strongly elevated

    # Signal 4: Deep sleep ratio crashed (<10% of total)
    if deep_sleep_ratio is not None and deep_sleep_ratio < 10:
        signals.append({"signal": "deep_sleep_ratio", "value": deep_sleep_ratio, "threshold": 10, "direction": "below"})
        risk_score += 1
        if deep_sleep_ratio < 5:
            risk_score += 1

    # Risk level from accumulated score
    if risk_score >= 5:
        level = "veto"
    elif risk_score >= 3:
        level = "elevated"
    elif risk_score >= 1:
        level = "watch"
    else:
        level = "none"

    return {
        "level": level,
        "score": risk_score,
        "signals": signals,
        "n_signals": len(signals),
    }
