import type { Metadata } from "next";
import { Inter, Lora, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });
const dmSerif = DM_Serif_Display({ 
  weight: "400", 
  subsets: ["latin"], 
  variable: "--font-dm-serif" 
});

export const metadata: Metadata = {
  title: "Bea",
  description: "A whānau intelligence companion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${lora.variable} ${dmSerif.variable} font-body bg-bea-milk text-bea-charcoal antialiased min-h-screen`}
      >
        <main className="max-w-md mx-auto min-h-screen p-6 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}