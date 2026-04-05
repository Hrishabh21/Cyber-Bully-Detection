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
