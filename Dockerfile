FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    inkscape \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libsndfile1 \
    libxext6 \
    libxrender1 \
    libreoffice \
    poppler-utils \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && wget -q https://github.com/wkhtmltopdf/packaging/releases/download/0.12.6.1-3/wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends ./wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm wkhtmltox_0.12.6.1-3.bookworm_amd64.deb \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-base.txt requirements-paper.txt requirements-paper-backup.txt ./

RUN pip install --upgrade pip && \
    (pip install -r requirements-paper.txt || pip install -r requirements-paper-backup.txt)

COPY . .

EXPOSE 8000

CMD ["uvicorn", "fastapi_app.main:app", "--host", "0.0.0.0", "--port", "8000"]
