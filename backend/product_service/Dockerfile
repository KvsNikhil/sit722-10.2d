FROM python:3.11-slim

# Avoid prompts during install
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps (psycopg2 etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Workdir per service
WORKDIR /app

# Install runtime deps
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy service code
COPY app /app/app

# Default envs (override in real deployments)
ENV HOST=0.0.0.0 \
    PORT=8000

EXPOSE 8000

# Run FastAPI with uvicorn
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]