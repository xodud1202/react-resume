import React from "react";

interface ResumeIntroduce {
    introduceTitle: string;
    introduce: string;
}

interface IntroSectionProps {
    resumeIntroduceList?: ResumeIntroduce[];
}

const IntroSection = ({ resumeIntroduceList }: IntroSectionProps) => {
    return (
        <section className="pdf-section">
            {resumeIntroduceList?.map((item, idx) => (
                <React.Fragment key={idx}>
                    <h2 className="pdf-section-title">{item.introduceTitle}</h2>
                    <div className="pdf-intro" dangerouslySetInnerHTML={{ __html: item.introduce }}></div>
                </React.Fragment>
            ))}
        </section>
    );
};

export default IntroSection;
