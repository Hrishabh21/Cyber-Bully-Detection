# Cyber-Bully-Detection

This project combines trained cyberbullying models with the `ToxiSense AI` browser extension.

## Local BERTweet API

The extension is already configured to call `http://127.0.0.1:5000/predict`, so the quickest backend to run is the saved BERTweet checkpoint:

- model path: `saved models/bertweet_epochs5_maxlen128_lr2e-5_acc87.7`
- API entrypoint: `backend/app.py`

### Install backend dependencies

```powershell
python -m pip install -r backend/requirements.txt
```

### Run the API

```powershell
python backend/app.py
```

### Optional environment variables

- `TOXISENSE_MODEL_DIR`: load a different Hugging Face checkpoint directory
- `TOXISENSE_HOST`: override the host, default `127.0.0.1`
- `TOXISENSE_PORT`: override the port, default `5000`

### Test the API

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:5000/predict `
  -ContentType 'application/json' `
  -Body '{"text":"You are such an idiot and nobody likes you"}'
```

### Response shape

The API converts the saved 6-class BERTweet model into the extension-friendly format:

- `prediction`: `clean` or `bullying`
- `category`: original model label such as `gender`, `religion`, or `not_cyberbullying`
- `severity`: empty, `moderate`, or `aggressive`
- `confidence`: top-class probability
- `scores`: probabilities for all saved labels

## Local FastAPI For HingmBERT

This project now also includes a separate FastAPI backend for the saved HingmBERT BullySenti checkpoint.

- model path: `saved models/hingmbert_bullysenti_epochs5_maxlen128_lr2e-5`
- API entrypoint: `backend/fastapi_app.py`
- default URL: `http://127.0.0.1:8000`

### Install FastAPI dependencies

```powershell
python -m pip install -r backend/requirements-fastapi.txt
```

### Run the FastAPI server

```powershell
python backend/fastapi_app.py
```

### Optional environment variables

- `TOXISENSE_FASTAPI_MODEL_DIR`: override the default HingmBERT checkpoint directory
- `TOXISENSE_FASTAPI_HOST`: override the host, default `127.0.0.1`
- `TOXISENSE_FASTAPI_PORT`: override the port, default `8000`

### Test the FastAPI server

```powershell
Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/predict `
  -ContentType 'application/json' `
  -Body '{"text":"tum bahut bekar ho"}'
```

### Response shape

The FastAPI service keeps the same extension-friendly response format, but uses the binary HingmBERT labels:

- `prediction`: `clean` or `bullying`
- `category`: `positive`, `negative`, or `heuristic_harassment`
- `severity`: empty, `moderate`, or `aggressive`
- `confidence`: top-class probability
- `scores`: probabilities for `positive` and `negative`
