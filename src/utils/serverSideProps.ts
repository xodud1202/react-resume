// utils/serverSideProps.ts
import {GetServerSideProps, GetServerSidePropsContext} from 'next';
import type { ResumeBase } from "@/components/HeaderSection";

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

// 공통 getServerSideProps 함수
export const getResumeInfoServerSideProps: GetServerSideProps<ResumePageProps> = async (
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

    const requestParam = {loginId, method: 'GET'};

    const response = await fetch(`${baseUrl}/api/backend-api`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            requestUri: `/api/resume/info?loginId=${loginId}`,
            requestParam: requestParam
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