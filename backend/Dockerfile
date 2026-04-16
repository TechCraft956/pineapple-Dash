FROM python:3.11-slim

WORKDIR /app

# Install dependencies first for better layer caching
# Use slim requirements (only packages actually imported by server.py)
# Full requirements.txt includes dev/unused deps that break in containers
COPY requirements.docker.txt .
RUN pip install --no-cache-dir -r requirements.docker.txt

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
