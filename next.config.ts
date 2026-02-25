import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    images: {
        // 1) 도메인 허용할 때
        domains: ['image.xodud1202.kro.kr'],
    },
    /**
     * react-resume.nextConfig.rewrites : /api 요청을 백엔드로 프록시한다.
     */
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.BACKEND_URL}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
