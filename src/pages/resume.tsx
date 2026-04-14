import React from "react";
import Head from "next/head";
import HeaderSection from "@/components/HeaderSection";
import IntroSection from "@/components/IntroSection";
import ExperienceSection from "@/components/ExperienceSection";
import EducationSection from "@/components/EducationSection";
import SkillsSection from "@/components/SkillsSection";
import OtherInfoSection from "@/components/OtherInfoSection";
import { useRouter } from "next/router";
import { GetServerSideProps, GetServerSidePropsContext } from "next";
import { ResumeBase } from "@/components/HeaderSection";

// API 응답 타입을 정의합니다.
export interface ResumeResponse {
	resumeBase: ResumeBase;
	result?: string;
	message?: string;
	resumeIntroduceList?: [];
	resumeExperienceList?: [];
	resumeEducationList?: [];
	resumeOtherExperienceList?: [];
}

// 페이지 props 타입을 정의합니다.
export interface ResumePageProps {
	data: ResumeResponse;
}

/**
 * resume.resolveQueryStringValue : Next.js query 값을 문자열로 정규화합니다.
 */
function resolveQueryStringValue(value: string | string[] | undefined): string | undefined {
	// 배열 파라미터는 첫 번째 값 기준으로 처리합니다.
	if (Array.isArray(value)) {
		return value[0];
	}

	return value;
}

/**
 * resume.getServerSideProps : SSR에서 이력서 정보를 조회하여 페이지 props를 구성합니다.
 */
export const getServerSideProps: GetServerSideProps<ResumePageProps> = async (ctx: GetServerSidePropsContext) => {
	// 쿼리 파라미터 존재 여부와 값(빈값 포함)을 분리 판정합니다.
	const hasLoginIdQuery = Object.prototype.hasOwnProperty.call(ctx.query, "loginId");
	const rawLoginId = resolveQueryStringValue(ctx.query.loginId);
	const trimmedLoginId = rawLoginId?.trim();
	const loginId = hasLoginIdQuery ? trimmedLoginId : "xodud1202";

	let data = {} as ResumeResponse;

	// loginId 파라미터가 존재하지만 빈값인 경우 조회하지 않고 실패 분기로 보냅니다.
	if (!loginId) {
		return {
			props: {
				data,
			},
		};
	}

	try {
		// 서버 사이드 fetch는 절대 URL로 /api 리라이트 경로를 직접 호출합니다.
		const response = await fetch(`https://be.xodud1202.kro.kr/api/resume/info?loginId=${encodeURIComponent(loginId)}`, {
			method: "GET",
			headers: { "Content-Type": "application/json" },
		});

		// 성공 응답일 때만 기존 응답 구조를 props에 반영합니다.
		if (response.ok) {
			data = await response.json();
		}
	} catch (error) {
		// SSR 조회 실패 시 기존 실패 분기(noResume)로 흐르도록 빈 객체를 유지합니다.
		console.error(error);
	}

	return {
		props: {
			data,
		},
	};
};

/**
 * resume.ResumeRoutePage : SSR로 조회한 이력서 데이터를 화면에 렌더링합니다.
 */
export default function ResumeRoutePage({ data }: ResumePageProps) {
	const router = useRouter();

	// 조회 실패 시 noResume 페이지로 이동합니다.
	if (!data || data.result !== "OK") {
		if (typeof window !== "undefined") {
			router.replace("/noResume");
		}
		return null;
	}

	return (
		<>
			<Head>
				<title>{`${data.resumeBase.userNm} 이력서`}</title>
				<meta name="description" content="이력서" />
			</Head>

			<div className="pdf-resume">
				<HeaderSection resumeBase={data.resumeBase} />
				<div className="pdf-divider"></div>
				<IntroSection resumeIntroduceList={data.resumeIntroduceList} />
				<div className="pdf-divider"></div>
				{data?.resumeExperienceList ? <ExperienceSection resumeExperienceList={data.resumeExperienceList} /> : null}
				<div className="pdf-divider"></div>
				{data?.resumeEducationList ? <EducationSection resumeEducationList={data.resumeEducationList} /> : null}
				<div className="pdf-divider"></div>
				{data.resumeBase?.skillList ? <SkillsSection skillList={data.resumeBase.skillList} /> : null}
				<div className="pdf-divider"></div>
				{data?.resumeOtherExperienceList ? <OtherInfoSection resumeOtherExperienceList={data.resumeOtherExperienceList} /> : null}
			</div>
		</>
	);
}
