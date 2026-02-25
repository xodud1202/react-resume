// pages/index.tsx
import React from "react";
import Head from "next/head";
import HeaderSection from "@/components/HeaderSection";
import IntroSection from "@/components/IntroSection";
import ExperienceSection from "@/components/ExperienceSection";
import EducationSection from "@/components/EducationSection";
import SkillsSection from "@/components/SkillsSection";
import OtherInfoSection from "@/components/OtherInfoSection";

import {useRouter} from "next/router";
import {GetServerSideProps, GetServerSidePropsContext} from "next";
import {ResumeBase} from "@/components/HeaderSection";

// API 응답 타입 정의
export interface ResumeResponse {
    resumeBase: ResumeBase;
    result?: string;
    message?: string;
    resumeIntroduceList?: [];
    resumeExperienceList?: [];
    resumeEducationList?: [];
    resumeOtherExperienceList?: [];
}

// Props 타입 정의
export interface ResumePageProps {
    data: ResumeResponse
}

/**
 * index.resolveQueryStringValue : Next.js query 값을 문자열로 정규화한다.
 */
function resolveQueryStringValue(value: string | string[] | undefined): string | undefined {
    // 배열 파라미터는 첫 번째 값 기준으로 처리한다.
    if (Array.isArray(value)) {
        return value[0];
    }

    return value;
}

/**
 * index.getRequestBaseUrl : SSR 요청의 절대 URL 생성을 위한 baseUrl을 계산한다.
 */
function getRequestBaseUrl(ctx: GetServerSidePropsContext): string {
    // 프록시 환경에서는 x-forwarded-proto를 우선 사용한다.
    const protocolHeader = ctx.req.headers["x-forwarded-proto"];
    const protocol = Array.isArray(protocolHeader) ? protocolHeader[0] : (protocolHeader || "http");
    const host = ctx.req.headers.host;

    return `${protocol}://${host}`;
}

/**
 * index.getServerSideProps : SSR에서 이력서 정보를 조회하여 페이지 props를 구성한다.
 */
export const getServerSideProps: GetServerSideProps<ResumePageProps> = async (
    ctx: GetServerSidePropsContext
) => {
    // 쿼리 파라미터 존재 여부와 값(빈값 포함)을 분리 판정한다.
    const hasLoginIdQuery = Object.prototype.hasOwnProperty.call(ctx.query, "loginId");
    const rawLoginId = resolveQueryStringValue(ctx.query.loginId);
    const trimmedLoginId = rawLoginId?.trim();
    const loginId = hasLoginIdQuery ? trimmedLoginId : "xodud1202";

    let data = {} as ResumeResponse;
    // loginId 파라미터가 존재하지만 빈값인 경우 조회하지 않고 실패 분기로 보낸다.
    if (!loginId) {
        return {
            props: {
                data
            },
        };
    }

    try {
        // 서버 사이드 fetch는 절대 URL로 /api 리라이트 경로를 직접 호출한다.
        const baseUrl = getRequestBaseUrl(ctx);
        const response = await fetch(`${baseUrl}/api/resume/info?loginId=${encodeURIComponent(loginId)}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });

        // 성공 응답일 때만 기존 응답 구조를 props에 반영한다.
        if (response.ok) {
            data = await response.json();
        }
    } catch (error) {
        // SSR 조회 실패 시 기존 실패 분기(noResume)로 흐르도록 빈 객체를 유지한다.
        console.error(error);
    }

    // 반드시 객체 형태로 반환!
    return {
        props: {
            data,
        }
    };
};

/**
 * index.HomePage : SSR로 조회한 이력서 데이터를 화면에 렌더링한다.
 */
const HomePage = ({ data }: ResumePageProps) => {
    const router = useRouter();

    // 조회 실패 시 noResume 페이지로 이동한다.
    if (!data || data.result !== 'OK') {
        if (typeof window !== 'undefined') {
            router.replace('/noResume');
        }
        return null;
    }

    return (
        <>
            <Head>
                <title>{data.resumeBase.userNm} 이력서</title>
                <meta name="description" content="이력서" />
            </Head>

            {/* 이력서 본문 */}
            <div className="pdf-resume">
                {/* 헤더 섹션 */}
                <HeaderSection resumeBase={data.resumeBase} />

                {/* 구분선 */}
                <div className="pdf-divider"></div>

                {/* 자기소개 섹션 */}
                <IntroSection resumeIntroduceList={data.resumeIntroduceList} />

                {/* 구분선 */}
                <div className="pdf-divider"></div>

                {/* 경력사항 섹션 */}
                {data?.resumeExperienceList && (
                    <ExperienceSection resumeExperienceList={data.resumeExperienceList} />
                )}

                {/* 구분선 */}
                <div className="pdf-divider"></div>

                {/* 학력 섹션 */}
                {data?.resumeEducationList && (
                    <EducationSection resumeEducationList={data.resumeEducationList}/>
                )}

                {/* 구분선 */}
                <div className="pdf-divider"></div>

                {/* 보유 기술 섹션 */}
                {data.resumeBase?.skillList && (
                <SkillsSection skillList={data.resumeBase.skillList} />
                )}

                {/* 구분선 */}
                <div className="pdf-divider"></div>

                {/* 기타 경력 및 자격 섹션 */}
                {data?.resumeOtherExperienceList && (
                <OtherInfoSection resumeOtherExperienceList={data.resumeOtherExperienceList} />
                )}
            </div>
        </>
    );
};

export default HomePage;
