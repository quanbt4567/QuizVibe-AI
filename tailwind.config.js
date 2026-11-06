/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Approved QuizVibe AI Unified Dark Design System Surface & Border Tokens
        canvas: "hsl(var(--background))",              // #06080D
        recessed: "hsl(var(--recessed))",              // #121723
        interactive: "hsl(var(--interactive))",        // #1A2130
        "border-subtle": "hsl(var(--border))",         // #1E2433
        "border-tactile": "hsl(var(--border-tactile))",// #2A3246
        "border-tactile-depth": "hsl(var(--border-tactile-depth))", // #1B2232

        // Approved Text Hierarchy Tokens
        content: {
          primary: "hsl(var(--foreground))",           // #F8FAFC
          secondary: "hsl(var(--muted-foreground))",   // #94A3B8
          muted: "hsl(var(--subtle-foreground))",      // #64748B
        },

        // Shadcn-compatible Semantic Tokens (mapped to approved HSL channels)
        border: "hsl(var(--border))",                  // #1E2433
        input: "hsl(var(--input))",                    // #1E2433
        ring: "hsl(var(--ring))",                      // #6366F1
        background: "hsl(var(--background))",          // #06080D
        foreground: "hsl(var(--foreground))",          // #F8FAFC
        card: {
          DEFAULT: "hsl(var(--card))",                 // #0B0E17
          foreground: "hsl(var(--card-foreground))",   // #F8FAFC
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",              // #0B0E17
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",                // #121723
          foreground: "hsl(var(--muted-foreground))",  // #94A3B8
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",          // #F43F5E
          depth: "hsl(var(--destructive-depth))",      // #BE123C
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",              // #10B981
          depth: "hsl(var(--success-depth))",          // #047857
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",              // #F59E0B
          depth: "hsl(var(--warning-depth))",          // #B45309
          foreground: "hsl(var(--warning-foreground))",
        },
        // Primary & Secondary Brand Tokens (combining CSS variables & existing scales)
        primary: {
          DEFAULT: "hsl(var(--primary))",              // #6366F1
          depth: "hsl(var(--primary-depth))",          // #4338CA
          foreground: "hsl(var(--primary-foreground))",
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",            // #121723
          foreground: "hsl(var(--secondary-foreground))",
          50: "#FDF4FF",
          500: "#D946EF",
          600: "#C026D3",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",               // #1A2130
          foreground: "hsl(var(--accent-foreground))",
          amber: "#F59E0B",
          emerald: "#10B981",
          rose: "#F43F5E",
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        admin: "var(--radius-admin)",
        player: "var(--radius-player)",
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        key: "inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 4px 16px -4px rgba(0, 0, 0, 0.5)",
        elevated: "inset 0 1px 0 0 rgba(255, 255, 255, 0.07), 0 16px 40px -8px rgba(0, 0, 0, 0.65)",
        "player-card": "inset 0 1px 0 0 rgba(255, 255, 255, 0.07), 0 16px 40px -8px rgba(0, 0, 0, 0.65)",
        "inset-well": "inset 0 1px 2px 0 rgba(0, 0, 0, 0.45)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleUp: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
        scaleUp: "scaleUp 160ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
    },
  },
  plugins: [],
};
