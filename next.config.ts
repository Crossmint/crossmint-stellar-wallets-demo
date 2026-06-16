import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Configure Turbopack only if you're using `next dev --turbo`
    turbopack: {
        rules: {
            "*.svg": {
                loaders: ["@svgr/webpack"],
                as: "*.js",
            },
        },
        resolveAlias: {
            // add optional aliases here
        },
    },
};

export default nextConfig;
