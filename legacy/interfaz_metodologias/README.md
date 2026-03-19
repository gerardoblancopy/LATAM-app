# Ameba Power System Optimization App

A web interface for optimizing a 3-country power system (Chile, Peru, Argentina) and comparing interconnection remuneration methodologies.

## Prerequisites

1.  **Anaconda / Miniconda**: Ensure you have `conda` installed.
2.  **Environment**: You must have the `amebamaps` environment created. If not, create it and install dependencies:
    ```bash
    conda create -n amebamaps python=3.9
    conda activate amebamaps
    pip install -r backend/requirements.txt
    ```
    *(Note: the backend now falls back to GLPK when a Gurobi license is not available.)*

3.  **Node.js**: Required to run the frontend.

## How to Run

### Method 1: Automatic (Recommended)
Double-click `run_app.bat`. This script will open two terminal windows:
- **Backend**: Runs the FastAPI server on `http://localhost:8000`.
- **Frontend**: Runs the React app on `http://localhost:5173`.

**Note**: If the backend window closes immediately or shows "conda not found", try running `run_app.bat` from an **Anaconda Prompt**.

### Method 2: Manual Check

**1. Start Backend**
Open a terminal (Anaconda Prompt recommended):
```bash
cd backend
conda activate amebamaps
python main.py
```
The server should start at `http://localhost:8000`. You can check `http://localhost:8000/docs` for API documentation.

**2. Start Frontend**
Open a new terminal:
```bash
cd frontend
npm install  # (Only the first time)
npm run dev
```
Open your browser at `http://localhost:5173`.

## Features
- **Parameter Editor**: Modify demand, generation costs/capacities, and transmission limits.
- **Simulation**: Run optimization for both isolated (SIN) and interconnected (CON) cases.
- **Results**: View detailed LMP prices, dispatch, and winner/loser analysis based on market surplus changes.
- **Methodologies**: Compare SIEPAC, Asia, Europe/CBCA, and the new LATAM hybrid remuneration proposal.
