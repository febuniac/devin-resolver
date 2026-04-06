/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
			devin: {
				purple: '#3969CA',
				green: '#21C19A',
				blue: '#0294DE',
			}
		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

