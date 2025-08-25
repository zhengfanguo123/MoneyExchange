# Use AWS's public ECR mirror of Docker Official Images to avoid Docker Hub rate limits
FROM public.ecr.aws/docker/library/python:3.11-slim

# (Optional) system deps commonly needed to build wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc curl \
 && rm -rf /var/lib/apt/lists/*

# Python runtime niceties
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install Python deps first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the app
COPY . .

# App Runner (and many PaaS) provide PORT; default to 8080 for local/dev
ENV PORT=8080
EXPOSE 8080

# Run gunicorn; shell form lets $PORT expand correctly
# If your entry is not app:app, change it (e.g., wsgi:application)
CMD exec gunicorn app:app -w 2 -k gthread -b 0.0.0.0:$PORT --timeout 120
