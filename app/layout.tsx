import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RECITE — English Presentation Trainer",
  description:
    "Upload a presentation, get an AI study plan, and drill it with cloze recall on a spaced-repetition schedule.",
};

// Apply the persisted theme before paint to avoid a flash of the wrong mode.
const noFlashTheme = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Space Grotesk (UI), Space Mono (labels/data), Doto (hero dot-matrix) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Doto:wght@400;700&family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-primary">
        {children}
      </body>
    </html>
  );
}
