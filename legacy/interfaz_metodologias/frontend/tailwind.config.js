/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                oirse: {
                    bg: {
                        primary: '#0f1117',
                        secondary: '#161923',
                        surface: '#1c1f2e',
                        elevated: '#242838',
                        hover: '#2a2f42',
                    },
                    border: {
                        DEFAULT: '#2e3348',
                        light: '#363b52',
                    },
                    text: {
                        primary: '#edf0f5',
                        secondary: '#b0b8cc',
                        muted: '#8891a8',
                    },
                    accent: {
                        DEFAULT: '#6366f1',
                        hover: '#818cf8',
                        dim: 'rgba(99, 102, 241, 0.15)',
                    },
                    semantic: {
                        green: '#34d399',
                        red: '#f87171',
                        amber: '#fbbf24',
                        purple: '#a78bfa',
                        cyan: '#22d3ee',
                    },
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['Fira Code', 'SF Mono', 'Cascadia Code', 'monospace'],
            },
            backdropBlur: {
                glass: '12px',
            },
            borderRadius: {
                oirse: '10px',
            },
            boxShadow: {
                'oirse-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
                'oirse-md': '0 4px 8px rgba(0, 0, 0, 0.4)',
                'oirse-lg': '0 10px 25px rgba(0, 0, 0, 0.5)',
                'oirse-glow': '0 0 20px rgba(99, 102, 241, 0.15)',
                'oirse-glow-green': '0 0 18px rgba(52, 211, 153, 0.25)',
                'oirse-glow-red': '0 0 18px rgba(248, 113, 113, 0.2)',
            },
            keyframes: {
                iridescent: {
                    '0%': { backgroundPosition: '0% 50%' },
                    '100%': { backgroundPosition: '300% 50%' },
                },
            },
            animation: {
                iridescent: 'iridescent 6s linear infinite',
            },
        },
    },
    plugins: [],
}
