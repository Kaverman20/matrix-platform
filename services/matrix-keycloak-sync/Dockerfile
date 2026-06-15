FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY sync.py .
COPY mapping.yaml .

CMD ["python", "sync.py", "--watch"]

