# Usa imagen oficial de Python 3.9
FROM python:3.9-slim

# Configura entorno
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Define el directorio de trabajo
WORKDIR /app

# Copia los requerimientos e instálalos
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto del código
COPY . .

# Expone el puerto (Railway usará $PORT)
EXPOSE 8000

# Comando para iniciar Flask con Gunicorn
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:$PORT"]
