---
title: LATAM Interconexión - Simulador de Remuneración
emoji: ⚡
colorFrom: indigo
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# LATAM Interconexión App

Aplicación web para simulación y visualización de interconexiones eléctricas LATAM.

## Estructura del repositorio

- `public/`: frontend estático (mapa, estilos y lógica cliente).
- `server.js`: API backend (Express) y servidor estático.
- `data_processing.py`: ejecución del modelo de optimización.
- `data/input/`: insumo principal (`MODELO PLANTILLA DE DATOS V9_INTx.xlsx`).
- `data/scenarios/`: escenarios operativos consumidos por la app (`S0`, `S1`).
- `data/analysis/`: artefactos de análisis y salidas auxiliares.
- `data/scenario_experiments/`: escenarios/experimentos históricos (no core runtime).
- `scripts/analysis/`: scripts de análisis reproducible.
- `scripts/maintenance/`: utilidades de limpieza/parcheo/verificación.
- `docs/`: documentación técnica.
- `legacy/`: código legado no crítico para operación diaria.

## Ejecutar local

1. Instalar dependencias Node:
   `npm install`
2. Instalar dependencias Python:
   `pip install -r requirements.txt`
3. Iniciar servidor:
   `node server.js`
4. Abrir en navegador:
   `http://localhost:3005`

## Notas de operación

- El backend lee y escribe escenarios en `data/scenarios/<escenario>/`.
- El modelo Python usa el archivo de entrada en `data/input/`.
