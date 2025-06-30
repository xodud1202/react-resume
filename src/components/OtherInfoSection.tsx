// components/OtherInfoSection.tsx
import React from "react";

interface resumeOtherExperience {
    experienceTitle: string;
    experienceSubTitle?: string;
    experienceDesc: string;
    experienceStartDt: string;
    experienceEndDt?: string;
}

interface OtherInfoSectionProps {
    resumeOtherExperienceList?: resumeOtherExperience[]
}

const OtherInfoSection = ({resumeOtherExperienceList}: OtherInfoSectionProps) => {
    return (
        <section className="pdf-section">
            <h2 className="pdf-section-title">기타 경력 및 자격</h2>
            <div className="pdf-other">
                {resumeOtherExperienceList?.map((item, idx) => (
                <div className="pdf-other-item" key={idx}>
                    <div className="pdf-other-header">
                        <h3 className="pdf-other-title">{item.experienceTitle}</h3>
                        <p className="pdf-other-period">{item.experienceStartDt} - {item.experienceEndDt}</p>
                    </div>
                    {item?.experienceSubTitle && (
                        <p className="pdf-other-position">{item.experienceSubTitle}</p>
                    )}
                    <p className="pdf-other-desc">{item.experienceDesc}</p>
                </div>
                ))}
            </div>

        </section>
    );
};

export default OtherInfoSection;