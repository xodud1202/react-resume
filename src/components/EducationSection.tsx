// components/EducationSection.tsx
import React from "react";
import Image from "next/image";

interface ResumeEducation {
    educationNm: string;
    department: string;
    educationScore?: string;
    educationStat: string;
    educationStartDt: string;
    educationEndDt?: string;
    logoPath?: string;
}

interface EducationSectionProps {
    resumeEducationList?: ResumeEducation[]
}

const EducationSection = ({resumeEducationList}: EducationSectionProps) => {
    return (
        <section className="pdf-section">
            <h2 className="pdf-section-title">학력</h2>
            <div className="pdf-education-list">
                {resumeEducationList?.map((item, idx) => (
                    <div className="pdf-education flex items-start gap-4" key={idx}>
                        {item?.logoPath && (
                            <div className="shrink-0 relative w-[35px] h-[35px] flex justify-center items-center overflow-hidden">
                                <Image className="object-contain" fill src={item.logoPath.trim()} alt="학교로고" />
                            </div>
                        )}
                        <div className="flex-1">
                            <div className="pdf-education-header">
                                <h3 className="pdf-school-name">{item.educationNm}</h3>
                                <p className="pdf-education-period">{item.educationStartDt} - {item?.educationEndDt} ({item.educationStat})</p>
                            </div>
                            <div className="pdf-education-header">
                                <p className="pdf-education-details">{item.department}</p>
                                <p className="pdf-education-details">{item.educationScore}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default EducationSection;