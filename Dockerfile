# Usa una imagen base oficial de Python
FROM python:3.10-slim

# Instala dependencias del sistema operativo (Node.js y GLPK para Pyomo en caso de usarlo)
RUN apt-get update && apt-get install -y \
    curl \
    lsb-release \
    gnupg \
    glpk-utils \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Establecer directorio de trabajo
WORKDIR /app

# 1. Copiar y empaquetar entorno Node.js (Servidor)
COPY package*.json ./
RUN npm install

# 2. Copiar y empaquetar entorno Python (Data-Processing)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copiar el resto del repositorio
COPY . .

# Variables de Entorno esperadas por Hugging Face Spaces
ENV PORT=7860
ENV PYTHON_CMD=python3

# Exponer el puerto
EXPOSE 7860

# Comando para levantar la aplicación Node
CMD ["node", "server.js"]
