import React from 'react';

const ParameterEditor = ({ params, setParams }) => {
    if (!params) return <div className="text-oirse-text-muted italic">Loading...</div>;

    const handleChange = (section, key, field, value) => {
        setParams(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: field
                    ? { ...prev[section][key], [field]: parseFloat(value) }
                    : parseFloat(value)
            }
        }));
    };

    return (
        <div className="space-y-6">
            <div className="bg-oirse-bg-surface p-6 rounded-lg shadow-oirse-md border border-oirse-border border-l-4 border-l-oirse-accent">
                <h3 className="text-xl font-semibold mb-4 text-oirse-text-primary border-b border-oirse-border pb-2">⚙️ Generators</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(params.GEN).map(([key, gen]) => (
                        <div key={key} className="p-4 bg-oirse-bg-elevated rounded border border-oirse-border hover:shadow-oirse-glow transition-shadow">
                            <div className="font-semibold text-oirse-accent-hover mb-2">{key} ({gen.country})</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-oirse-text-muted font-medium">Cost ($/MWh)</label>
                                    <input
                                        type="number"
                                        value={gen.c}
                                        onChange={(e) => handleChange('GEN', key, 'c', e.target.value)}
                                        className="w-full border border-oirse-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-oirse-accent outline-none bg-oirse-bg-primary text-oirse-text-primary oirse-number"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-oirse-text-muted font-medium">Pmax (MW)</label>
                                    <input
                                        type="number"
                                        value={gen.pmax}
                                        onChange={(e) => handleChange('GEN', key, 'pmax', e.target.value)}
                                        className="w-full border border-oirse-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-oirse-accent outline-none bg-oirse-bg-primary text-oirse-text-primary oirse-number"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-oirse-bg-surface p-6 rounded-lg shadow-oirse-md border border-oirse-border border-l-4 border-l-oirse-accent">
                <h3 className="text-xl font-semibold mb-4 text-oirse-text-primary border-b border-oirse-border pb-2">⚙️ Demand (MW)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {Object.entries(params.D).map(([key, val]) => (
                        <div key={key} className="p-4 bg-oirse-bg-elevated rounded border border-oirse-border">
                            <label className="block text-sm font-medium text-oirse-text-secondary mb-1">{params.NODES[key]}</label>
                            <input
                                type="number"
                                value={val}
                                onChange={(e) => handleChange('D', key, null, e.target.value)}
                                className="w-full border border-oirse-border rounded p-2 focus:ring-2 focus:ring-oirse-accent outline-none bg-oirse-bg-primary text-oirse-text-primary oirse-number"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-oirse-bg-surface p-6 rounded-lg shadow-oirse-md border border-oirse-border border-l-4 border-l-oirse-accent">
                <h3 className="text-xl font-semibold mb-4 text-oirse-text-primary border-b border-oirse-border pb-2">⚙️ Transmission Lines</h3>
                <div className="space-y-3">
                    {Object.entries(params.LINES).map(([key, line]) => (
                        <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-oirse-bg-elevated rounded border border-oirse-border">
                            <span className="font-medium text-oirse-text-secondary">{key}: {line.fr} -&gt; {line.to}</span>
                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                <label className="text-sm text-oirse-text-muted">Fmax (MW):</label>
                                <input
                                    type="number"
                                    value={line.fmax}
                                    onChange={(e) => handleChange('LINES', key, 'fmax', e.target.value)}
                                    className="w-32 border border-oirse-border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-oirse-accent outline-none bg-oirse-bg-primary text-oirse-text-primary oirse-number"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ParameterEditor;
