FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

WORKDIR /app

COPY apps/api/requirements.txt /app/apps/api/requirements.txt
RUN pip install --no-cache-dir -r /app/apps/api/requirements.txt

COPY apps/api/app /app/apps/api/app

RUN mkdir -p /app/apps/api/data \
    && useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app/apps/api

USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "apps.api.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
