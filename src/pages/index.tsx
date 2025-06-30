// pages/index.tsx
import React from "react";
import Head from "next/head";
import HeaderSection from "@/components/HeaderSection";
import IntroSection from "@/components/IntroSection";
import ExperienceSection from "@/components/ExperienceSection";
import EducationSection from "@/components/EducationSection";
import SkillsSection from "@/components/SkillsSection";
import OtherInfoSection from "@/components/OtherInfoSection";

import {getResumeInfoServerSideProps, ResumePageProps} from '@/utils/serverSideProps'
import {useRouter} from "next/router";

export const getServerSideProps = getResumeInfoServerSideProps;

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