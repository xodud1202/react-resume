// components/SkillsSection.tsx
import React from "react";

interface SkillsSectionProps {
    skillList?: string[] | undefined
}

const SkillsSection = ({skillList}: SkillsSectionProps) => {

    return (
        <section className="pdf-section">
            <h2 className="pdf-section-title">보유 기술</h2>
            <div className="pdf-skills">
                <div className="pdf-skill-category">
                    <div className="pdf-skill-tags">
                        {skillList?.map((item, idx) => (
                        <span className="pdf-skill-tag" key={idx}>{item}</span>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SkillsSection;