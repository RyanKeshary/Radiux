import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "Radiux - Real-Time Collaborative IDE",
  description: "High-performance collaborative web IDE powered by Monaco Editor, Yjs, and Supabase",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", type: "image/png" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var settingsStr = localStorage.getItem('radiux_editor_settings') || localStorage.getItem('codecollab_editor_settings');
                  var theme = 'dark';
                  if (settingsStr) {
                    var parsed = JSON.parse(settingsStr);
                    if (parsed && parsed.theme) theme = parsed.theme;
                  } else {
                    var savedTheme = localStorage.getItem('radiux_theme') || localStorage.getItem('codecollab_theme');
                    if (savedTheme) theme = savedTheme;
                  }
                  var themes = {
                    dark: { bg: '#1e1e1e', sidebar: '#252526', activity: '#333333', dock: '#181818', dockHeader: '#252526', tabActive: '#1e1e1e', tabInactive: '#2d2d2d', border: '#3c3c3c', text: '#cccccc', textMuted: '#858585', accent: '#007acc', accentHover: '#0098ff', statusBar: '#007acc', statusBarText: '#ffffff', inputBg: '#3c3c3c', cardBg: '#252526' },
                    light: { bg: '#ffffff', sidebar: '#f3f4f6', activity: '#e5e7eb', dock: '#f9fafb', dockHeader: '#f3f4f6', tabActive: '#ffffff', tabInactive: '#e5e7eb', border: '#d1d5db', text: '#1f2937', textMuted: '#6b7280', accent: '#0284c7', accentHover: '#0369a1', statusBar: '#007acc', statusBarText: '#ffffff', inputBg: '#ffffff', cardBg: '#ffffff' },
                    midnight: { bg: '#0a0d14', sidebar: '#0f141c', activity: '#080a0f', dock: '#07090e', dockHeader: '#0f141c', tabActive: '#0a0d14', tabInactive: '#141b26', border: '#1f293d', text: '#e2e8f0', textMuted: '#64748b', accent: '#38bdf8', accentHover: '#0ea5e9', statusBar: '#0284c7', statusBarText: '#ffffff', inputBg: '#141b26', cardBg: '#0f141c' },
                    dracula: { bg: '#282a36', sidebar: '#21222c', activity: '#191a21', dock: '#1e1f29', dockHeader: '#21222c', tabActive: '#282a36', tabInactive: '#21222c', border: '#44475a', text: '#f8f8f2', textMuted: '#6272a4', accent: '#bd93f9', accentHover: '#ff79c6', statusBar: '#6272a4', statusBarText: '#f8f8f2', inputBg: '#44475a', cardBg: '#21222c' },
                    monokai: { bg: '#272822', sidebar: '#1e1f1c', activity: '#171814', dock: '#191a17', dockHeader: '#1e1f1c', tabActive: '#272822', tabInactive: '#1e1f1c', border: '#3e3d32', text: '#f8f8f2', textMuted: '#75715e', accent: '#a6e22e', accentHover: '#e6db74', statusBar: '#75715e', statusBarText: '#f8f8f2', inputBg: '#3e3d32', cardBg: '#1e1f1c' },
                    nord: { bg: '#2e3440', sidebar: '#272c36', activity: '#22262f', dock: '#1e222a', dockHeader: '#272c36', tabActive: '#2e3440', tabInactive: '#272c36', border: '#434c5e', text: '#eceff4', textMuted: '#7b88a1', accent: '#88c0d0', accentHover: '#81a1c1', statusBar: '#5e81ac', statusBarText: '#eceff4', inputBg: '#3b4252', cardBg: '#272c36' },
                    solarized: { bg: '#002b36', sidebar: '#073642', activity: '#00212b', dock: '#001e26', dockHeader: '#073642', tabActive: '#002b36', tabInactive: '#073642', border: '#586e75', text: '#93a1a1', textMuted: '#657b83', accent: '#268bd2', accentHover: '#2aa198', statusBar: '#073642', statusBarText: '#93a1a1', inputBg: '#073642', cardBg: '#073642' },
                    'high-contrast': { bg: '#000000', sidebar: '#000000', activity: '#000000', dock: '#000000', dockHeader: '#000000', tabActive: '#000000', tabInactive: '#111111', border: '#6fc3df', text: '#ffffff', textMuted: '#cccccc', accent: '#ffff00', accentHover: '#ffffff', statusBar: '#000000', statusBarText: '#ffffff', inputBg: '#000000', cardBg: '#000000' }
                  };
                  var t = themes[theme] || themes.dark;
                  var root = document.documentElement;
                  root.style.setProperty('--ide-bg', t.bg);
                  root.style.setProperty('--ide-sidebar', t.sidebar);
                  root.style.setProperty('--ide-activity', t.activity);
                  root.style.setProperty('--ide-dock', t.dock);
                  root.style.setProperty('--ide-dock-header', t.dockHeader);
                  root.style.setProperty('--ide-tab-active', t.tabActive);
                  root.style.setProperty('--ide-tab-inactive', t.tabInactive);
                  root.style.setProperty('--ide-border', t.border);
                  root.style.setProperty('--ide-text', t.text);
                  root.style.setProperty('--ide-text-muted', t.textMuted);
                  root.style.setProperty('--ide-accent', t.accent);
                  root.style.setProperty('--ide-accent-hover', t.accentHover);
                  root.style.setProperty('--ide-status-bg', t.statusBar);
                  root.style.setProperty('--ide-status-text', t.statusBarText);
                  root.style.setProperty('--ide-input-bg', t.inputBg);
                  root.style.setProperty('--ide-card-bg', t.cardBg);
                  root.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased" style={{ backgroundColor: 'var(--ide-bg)', color: 'var(--ide-text)', minHeight: '100vh' }}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
