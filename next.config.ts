import type { NextConfig } from "next";

// snippet API 개발 경로와 운영 경로를 환경별로 분기합니다.
const SNIPPET_API_PROXY_TARGET =
	process.env.NODE_ENV === "development"
		? "http://localhost:3010/api/snippet/:path*"
		: "https://be.xodud1202.kro.kr/api/snippet/:path*";

// 업무관리 API 개발 경로와 운영 경로를 환경별로 분기합니다.
const WORK_API_PROXY_TARGET =
	process.env.NODE_ENV === "development"
		? "http://localhost:3010/api/work/:path*"
		: "https://be.xodud1202.kro.kr/api/work/:path*";

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
                // snippet API: 개발환경은 로컬 Spring, 운영환경은 기존 백엔드로 프록시
                source: '/api/snippet/:path*',
                destination: SNIPPET_API_PROXY_TARGET,
            },
            {
                // work API: 개발환경은 로컬 Spring, 운영환경은 기존 백엔드로 프록시
                source: '/api/work/:path*',
                destination: WORK_API_PROXY_TARGET,
            },
            {
                // 기존 API 프록시: /api/* → be.xodud1202.kro.kr/api/*
                source: '/api/:path*',
                destination: `https://be.xodud1202.kro.kr/api/:path*`,
            },
        ];
    },
    /**
     * react-resume.nextConfig.headers : 구글 로그인 팝업이 postMessage를 전달할 수 있도록 로그인 페이지 COOP를 완화합니다.
     */
    async headers() {
        return [
            {
                // 스니펫 로그인 페이지에서만 Google GIS 팝업 연동을 허용합니다.
                source: '/snippet/login',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin-allow-popups',
                    },
                ],
            },
        ];
    },
};

export default nextConfig;
