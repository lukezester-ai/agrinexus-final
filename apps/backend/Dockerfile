FROM python:3.12-slim

WORKDIR /workspace

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY apps/backend/pyproject.toml apps/backend/README.md /packages/core/
COPY apps/backend/app /packages/core/app
RUN pip install --no-cache-dir /packages/core

ARG INSTALL_AGRICULTURE=1
RUN --mount=type=bind,source=.,target=/build-context \
    if [ "$INSTALL_AGRICULTURE" = "1" ]; then \
      cp -R /build-context/verticals/agriculture/python /packages/agriculture && \
      pip install --no-cache-dir /packages/agriculture; \
    fi

WORKDIR /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
