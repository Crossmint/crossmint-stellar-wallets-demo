import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/app/providers";

export const metadata: Metadata = {
    title: "Crossmint Stellar Wallets Demo",
    description: "Stellar wallet migration, device signers, and private key export",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <head>
            {/* Load Geist Sans & Mono from Google Fonts */}
            <link
                href="https://fonts.googleapis.com/css2?family=Geist&family=Geist+Mono&display=swap"
                rel="stylesheet"
            />
        </head>
        <body className="antialiased">
        <Providers>{children}</Providers>
        </body>
        </html>
    );
}
