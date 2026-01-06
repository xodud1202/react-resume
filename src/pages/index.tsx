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

export const getServerSideProps: GetServerSideProps<ResumePageProps> = async (
    ctx: GetServerSidePropsContext
) => {
    const { loginId } = ctx.query;

    let data = {} as ResumeResponse;
    if(!loginId) {
        return {
            props: {
                data
            },
        };
    }

    // 서버 사이드에서 API 호출 시 절대 URL 필요
    const protocol = ctx.req.headers['x-forwarded-proto'] || 'http';
    const host = ctx.req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/backend-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requestUri: `/api/resume/info?loginId=${loginId}`,
            requestParam: {loginId, method: 'GET'}
        })
    });

    if (response.ok) {
        data = await response.json();
    }

    // 반드시 객체 형태로 반환!
    return {
        props: {
            data,
        }
    };
};

const HomePage = ({ data }: ResumePageProps) => {
    const router = useRouter();

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