FROM python:3.11-slim

WORKDIR /app

RUN adduser --disabled-password --gecos "" --uid 1000 appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# 1 воркер: admin-API без нагрузки, а несколько воркеров гонятся в init_db
# (CREATE TABLE) и падают на duplicate key в pg_type при первом старте.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
