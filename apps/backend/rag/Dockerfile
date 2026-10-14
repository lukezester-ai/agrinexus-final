FROM python:3.11-slim

WORKDIR /app

# Build from the repository root so optional vertical distributions are available.
COPY apps/backend/rag/requirements.txt .
ARG TORCH_VERSION=2.7.1
RUN pip install --no-cache-dir "torch==${TORCH_VERSION}" --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt

# Install the shared capability contract through normal package metadata.
COPY apps/backend/pyproject.toml apps/backend/README.md /packages/core/
COPY apps/backend/app /packages/core/app
RUN pip install --no-cache-dir --no-deps /packages/core

ARG INSTALL_AGRICULTURE=1
COPY verticals/agriculture/python /packages/agriculture
RUN if [ "$INSTALL_AGRICULTURE" = "1" ]; then pip install --no-cache-dir --no-deps /packages/agriculture; fi

# Install the Academy/RAG application as a real Python package context.
COPY apps/backend/rag /app/rag

# Експозиране на порт 8000
EXPOSE 8000

# Стартиране на сървъра
CMD ["uvicorn", "rag.main:app", "--host", "0.0.0.0", "--port", "8000"]
