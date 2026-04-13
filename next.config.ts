import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'standalone',
    images: {
        // 1) 도메인 허용할 때
        remotePatterns: [
          {
            protocol: 'https',
            hostname: 'image.xodud1202.kro.kr',
            pathname: '/publist/**',
          },
        ],
        unoptimized: true,
    },
    /**
     * react-resume.nextConfig.rewrites : /api 요청을 백엔드로 프록시한다.
     */
    async rewrites() {
        return [
            {
                // 뉴스 API: 백엔드 경로에 /api/ 접두사 유지
                source: '/api/last/news/:path*',
                destination: `https://be.xodud1202.kro.kr/api/last/news/:path*`,
            },
            {
                // 기존 API 프록시: /api/* → be.xodud1202.kro.kr/api/*
                source: '/api/:path*',
                destination: `https://be.xodud1202.kro.kr/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
