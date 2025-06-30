// components/ExperienceSection.tsx
import React from "react";

interface ResumeExperienceDetail {
    workTitle: string;
    workDesc: string;
    workStartDt: string;
    workEndDt?: string;
}

interface ResumeExperience {
    companyNm: string;
    employmentType: string;
    position: string;
    duty: string;
    workStartDt: string;
    workEndDt?: string;
    resumeExperienceDetailList: ResumeExperienceDetail[];
}

interface ExperienceSectionProps {
    resumeExperienceList: ResumeExperience[];
}

const ExperienceSection = ({resumeExperienceList}: ExperienceSectionProps) => {
    function getTotalCareerText(list: { workStartDt: string; workEndDt?: string | null }[]): string {
        if (!list || list.length === 0) return "총 0년 0개월";

        // 1. workStartDt 중 가장 빠른 날짜
        const validStartDates = list
            .map(item => {
                const [year, month] = item.workStartDt.split('.').map(Number);
                return new Date(year, month - 1);
            });

        const minStartDate = new Date(Math.min(...validStartDates.map(d => d.getTime())));

        // 2. workEndDt 중 가장 늦은 날짜 또는 현재 시점
        const hasOngoing = list.some(item => !item.workEndDt || item.workEndDt.trim() === "");

        let maxEndDate: Date;
        if (hasOngoing) {
            maxEndDate = new Date(); // 현재 날짜
        } else {
            const validEndDates = list
                .map(item => {
                    const [year, month] = item.workEndDt!.split('.').map(Number);
                    return new Date(year, month - 1);
                });

            maxEndDate = new Date(Math.max(...validEndDates.map(d => d.getTime())));
        }

        // 3. 차이 계산
        let totalMonths =
            (maxEndDate.getFullYear() - minStartDate.getFullYear()) * 12 +
            (maxEndDate.getMonth() - minStartDate.getMonth());

        if (maxEndDate.getDate() >= minStartDate.getDate()) {
            totalMonths += 1; // 동일 월이라도 일자 기준으로 +1개월 포함 가능
        }

        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;

        return `총 ${years}년 ${months}개월`;
    }

    return (
        <section className="pdf-section">
            <h2 className="pdf-experience-section-title">경력 ({getTotalCareerText(resumeExperienceList)})</h2>
            {resumeExperienceList?.map((item, idx) => (
            <div className="pdf-company" key={idx}>
                <div className="pdf-company-header">
                    <h3 className="pdf-company-name">{item.companyNm}</h3>
                    <p className="pdf-company-period">{item.workStartDt} - {item.workEndDt && item.workEndDt.trim() !== '' ? item.workEndDt : '재직 중'} | {item.employmentType} | {item.duty} | {item.position}</p>
                </div>
                <ul className="pdf-project-list">
                    {item.resumeExperienceDetailList?.map((detail, index) => (
                    <li className="pdf-project" key={index}>
                        <div className="pdf-project-header">
                            <h4 className="pdf-project-title">{detail.workTitle}</h4>
                            <span className="pdf-project-period">{detail.workStartDt} - {detail.workEndDt && detail.workEndDt.trim() !== '' ? detail.workEndDt : '진행 중'}</span>
                        </div>
                        <p className="pdf-project-desc whitespace-pre-wrap">
                            {detail.workDesc}
                        </p>
                    </li>
                    ))}
                </ul>
            </div>
            ))}
        </section>
    );
};

export default ExperienceSection;