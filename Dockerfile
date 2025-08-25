FROM python:3.11-slim

# System deps (optional but common)
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . .

# App Runner/containers use a PORT env var; default to 8080
ENV PORT=8080
EXPOSE 8080

# If your Flask entrypoint is app.py with "app = Flask(__name__)"
# change "app:app" below to match your module and variable.
CMD ["bash", "-lc", "exec gunicorn app:app -w 2 -k gthread -b 0.0.0.0:${PORT} --timeout 120"]
