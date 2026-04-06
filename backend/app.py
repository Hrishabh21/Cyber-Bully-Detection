import json
import os
import re
from pathlib import Path

from flask import Flask, jsonify, request

try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
except ImportError as exc:  # pragma: no cover - handled at runtime
    torch = None
    AutoModelForSequenceClassification = None
    AutoTokenizer = None
    IMPORT_ERROR = exc
else:
    IMPORT_ERROR = None


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_DIR = ROOT_DIR / "saved models" / "bertweet_epochs5_maxlen128_lr2e-5_acc87.7"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5000
MAX_INPUT_CHARS = 5000
DIRECT_HARASSMENT_PATTERNS = (
    re.compile(
        r"\byou(?:'re| are)?\s+(?:such\s+)?(?:an?\s+)?"
        r"(idiot|moron|loser|clown|trash|pathetic|stupid|ugly|worthless|disgusting)\b"
    ),
    re.compile(r"\bnobody likes you\b"),
    re.compile(r"\b(?:go die|kill yourself)\b"),
    re.compile(r"\byou should (?:die|disappear|go away)\b"),
    re.compile(r"\bi hate you\b"),
    re.compile(r"\byou (?:disgust me|make me sick)\b"),
)
SEVERE_HARASSMENT_PATTERNS = (
    re.compile(r"\bkill yourself\b"),
    re.compile(r"\bgo die\b"),
    re.compile(r"\byou should (?:die|disappear)\b"),
)

app = Flask(__name__)


class BertweetPredictor:
    def __init__(self, model_dir: Path) -> None:
        if IMPORT_ERROR is not None:
            raise RuntimeError(
                "Missing inference dependencies. Install backend/requirements.txt first."
            ) from IMPORT_ERROR

        self.model_dir = model_dir
        self.label_mapping = self._load_label_mapping(model_dir / "label_mapping.json")
        self.id_to_label = {index: label for label, index in self.label_mapping.items()}
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
        self.model = AutoModelForSequenceClassification.from_pretrained(str(model_dir))
        self.model.to(self.device)
        self.model.eval()

    @staticmethod
    def _load_label_mapping(mapping_path: Path) -> dict[str, int]:
        with mapping_path.open("r", encoding="utf-8") as file:
            raw_mapping = json.load(file)

        return {label: int(index) for label, index in raw_mapping.items()}

    def predict(self, text: str) -> dict:
        encoded = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=128,
        )
        encoded = {name: tensor.to(self.device) for name, tensor in encoded.items()}

        with torch.no_grad():
            logits = self.model(**encoded).logits.squeeze(0)
            probabilities = torch.softmax(logits, dim=-1).cpu()

        predicted_index = int(torch.argmax(probabilities).item())
        predicted_label = self.id_to_label[predicted_index]
        confidence = round(float(probabilities[predicted_index].item()), 4)
        prediction = "clean" if predicted_label == "not_cyberbullying" else "bullying"

        return {
            "prediction": prediction,
            "category": predicted_label,
            "severity": infer_severity(prediction, confidence),
            "confidence": confidence,
            "scores": {
                self.id_to_label[index]: round(float(score.item()), 4)
                for index, score in enumerate(probabilities)
            },
        }


def detect_obvious_harassment(text: str) -> dict | None:
    normalized = " ".join(text.lower().split())

    if any(pattern.search(normalized) for pattern in SEVERE_HARASSMENT_PATTERNS):
        return {
            "prediction": "bullying",
            "category": "heuristic_harassment",
            "severity": "aggressive",
            "confidence": 0.98,
            "scores": {},
            "source": "heuristic",
        }

    if any(pattern.search(normalized) for pattern in DIRECT_HARASSMENT_PATTERNS):
        return {
            "prediction": "bullying",
            "category": "heuristic_harassment",
            "severity": "moderate",
            "confidence": 0.9,
            "scores": {},
            "source": "heuristic",
        }

    return None


def infer_severity(prediction: str, confidence: float) -> str:
    if prediction != "bullying":
        return ""

    return "aggressive" if confidence >= 0.85 else "moderate"


def get_model_dir() -> Path:
    model_dir = Path(os.getenv("TOXISENSE_MODEL_DIR", DEFAULT_MODEL_DIR))
    return model_dir.resolve()


def build_predictor() -> BertweetPredictor:
    model_dir = get_model_dir()

    if not model_dir.exists():
        raise FileNotFoundError(f"Model directory not found: {model_dir}")

    return BertweetPredictor(model_dir)


predictor = None
startup_error = None

try:
    predictor = build_predictor()
except Exception as exc:  # pragma: no cover - depends on local environment
    startup_error = str(exc)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.get("/health")
def health_check():
    model_dir = str(get_model_dir())

    if startup_error:
        return (
            jsonify(
                {
                    "ok": False,
                    "model_dir": model_dir,
                    "error": startup_error,
                }
            ),
            500,
        )

    return jsonify(
        {
            "ok": True,
            "model_dir": model_dir,
            "device": str(predictor.device),
            "labels": predictor.label_mapping,
        }
    )


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict():
    if request.method == "OPTIONS":
        return ("", 204)

    if startup_error:
        return jsonify({"error": startup_error}), 500

    payload = request.get_json(silent=True) or {}
    text = payload.get("text", "")

    if not isinstance(text, str):
        return jsonify({"error": "'text' must be a string."}), 400

    normalized_text = " ".join(text.split())

    if not normalized_text:
        return jsonify({"error": "'text' cannot be empty."}), 400

    if len(normalized_text) > MAX_INPUT_CHARS:
        normalized_text = normalized_text[:MAX_INPUT_CHARS]

    heuristic_result = detect_obvious_harassment(normalized_text)

    if heuristic_result is not None:
        result = heuristic_result
    else:
        result = predictor.predict(normalized_text)

    result["text_length"] = len(normalized_text)
    return jsonify(result)


if __name__ == "__main__":
    host = os.getenv("TOXISENSE_HOST", DEFAULT_HOST)
    port = int(os.getenv("TOXISENSE_PORT", DEFAULT_PORT))
    app.run(host=host, port=port, debug=False)
