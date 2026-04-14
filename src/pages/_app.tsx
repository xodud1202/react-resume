// src/pages/_app.tsx
import "react-quill-new/dist/quill.snow.css";
import "@/styles/globals.css";
import type { AppProps } from "next/app";

/**
 * _app.MyApp : 전체 페이지에 공통 전역 스타일을 적용한다.
 */
function MyApp({ Component, pageProps }: AppProps) {
    return (
        <Component {...pageProps} />
    );
}

export default MyApp;
