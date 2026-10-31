import type { Metadata } from "next";
import "./globals.css";
import Nav from "./Nav";

export const metadata: Metadata = {
  title: "Reddit Radar",
  description: "Find the Reddit conversations worth acting on.",
};

// Runs before first paint so the saved theme never flashes. Default is dark.
const themeScript = `var t=null;try{t=localStorage.getItem("theme")}catch(e){}if(t!=="light")document.documentElement.classList.add("dark")`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className="min-h-screen bg-zinc-50 text-zinc-900 antialiased"
        style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}
      >
        <Nav />
        {children}
      </body>
    </html>
  );
}
