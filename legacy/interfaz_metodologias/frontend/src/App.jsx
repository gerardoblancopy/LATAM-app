import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ParameterEditor from './components/ParameterEditor';
import ResultsViewer from './components/ResultsViewer';
import Methodologies from './components/Methodologies';

function App() {
    const [params, setParams] = useState(null);
    const [results, setResults] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('params');

    const [error, setError] = useState(null);

    useEffect(() => {
        // Fetch default params
        axios.get('http://localhost:8888/params')
            .then(res => {
                setParams(res.data);
                setError(null);
            })
            .catch(err => {
                console.error("Error fetching params:", err);
                setError("Could not connect to backend (http://localhost:8888/). Make sure it is running.");
            });
    }, []);

    const runSimulation = () => {
        setLoading(true);
        setResults(null);
        axios.post('http://localhost:8888/simulate', params)
            .then(res => {
                setResults(res.data);
                setActiveTab('results');
            })
            .catch(err => {
                console.error("Error running simulation:", err);
                alert("Error running simulation. Check console.");
            })
            .finally(() => setLoading(false));
    };

    return (
        <div className="min-h-screen bg-oirse-bg-primary flex flex-col font-sans text-oirse-text-primary">
            <header className="relative iridescent-border bg-gradient-to-r from-oirse-bg-secondary to-oirse-bg-surface text-oirse-text-primary p-6 shadow-oirse-lg border-b border-oirse-border">
                <h1 className="text-3xl font-black tracking-tight">OIRSE Interconexión Explorer</h1>
                <p className="text-sm mt-1 text-oirse-text-secondary">Evaluación regulatoria y operativa de interconexiones internacionales</p>
            </header>

            <div className="container mx-auto p-6 flex-1 max-w-6xl">
                <div className="bg-oirse-bg-surface rounded-xl shadow-oirse-lg overflow-hidden border border-oirse-border">

                    <nav className="flex items-center bg-oirse-bg-elevated border-b border-oirse-border">
                        <button
                            onClick={() => setActiveTab('params')}
                            className={`px-6 py-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'params'
                                ? 'border-oirse-accent text-oirse-accent-hover bg-oirse-accent-dim'
                                : 'border-transparent text-oirse-text-muted hover:text-oirse-text-primary'
                                }`}
                        >
                            ⚙️ Parámetros
                        </button>
                        <button
                            onClick={() => setActiveTab('results')}
                            className={`px-6 py-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'results'
                                ? 'border-oirse-semantic-green text-oirse-semantic-green bg-emerald-400/10'
                                : 'border-transparent text-oirse-text-muted hover:text-oirse-text-primary'
                                }`}
                        >
                            📊 Resultados
                        </button>
                        <button
                            onClick={() => setActiveTab('methodologies')}
                            className={`px-6 py-4 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'methodologies'
                                ? 'border-oirse-semantic-purple text-oirse-semantic-purple bg-purple-400/10'
                                : 'border-transparent text-oirse-text-muted hover:text-oirse-text-primary'
                                }`}
                        >
                            🧩 Metodologías
                        </button>
                        <div className="flex-1"></div>
                        <button
                            onClick={runSimulation}
                            disabled={loading}
                            className={`m-3 px-6 py-2 rounded-lg font-bold shadow-oirse-md transition-all transform hover:scale-[1.02] active:scale-95 ${loading
                                ? 'bg-oirse-bg-elevated text-oirse-text-muted cursor-not-allowed'
                                : 'bg-oirse-accent hover:bg-oirse-accent-hover text-white'
                                }`}
                        >
                            {loading ? 'Ejecutando optimizador...' : '▶ Ejecutar simulación'}
                        </button>
                    </nav>

                    <main className="p-6 min-h-[500px] bg-oirse-bg-secondary">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-4 py-3 rounded relative mb-4" role="alert">
                                <strong className="font-bold">Connection Error: </strong>
                                <span className="block sm:inline">{error}</span>
                            </div>
                        )}
                        {activeTab === 'params' && (
                            <div className="animate-fadeIn">
                                <ParameterEditor params={params} setParams={setParams} />
                            </div>
                        )}
                        {activeTab === 'results' && (
                            <div className="animate-fadeIn">
                                <ResultsViewer results={results} />
                            </div>
                        )}
                        {activeTab === 'methodologies' && (
                            <div className="animate-fadeIn">
                                <Methodologies results={results} params={params} />
                            </div>
                        )}
                    </main>

                </div>
            </div>
        </div>
    );
}

export default App;
