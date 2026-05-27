FROM python:3.11-slim

WORKDIR /app

# Копираме requirements първо, за по-бърз build (Docker cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копираме целия бекенд код
COPY . .

# Експозиране на порт 8000
EXPOSE 8000

# Стартиране на сървъра
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
