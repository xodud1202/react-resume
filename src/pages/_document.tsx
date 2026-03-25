import { Head, Html, Main, NextScript } from "next/document";

/**
 * _document.ResumeDocument : 문서 공통 메타와 외부 폰트 링크를 정의한다.
 */
export default function ResumeDocument() {
    return (
        <Html lang="ko">
            <Head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
