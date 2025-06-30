// components/HeaderSection.tsx
import React from "react";
import Image from "next/image";

export interface ResumeBase {
    userNm: string,
    subTitle: string | null,
    email: string | null,
    mobile: string | null,
    portfolio: string | null,
    faceImgPath: string | null,
    addr: string | null,
    skillList?: string[];
}

interface HeaderSectionProps {
    resumeBase: ResumeBase
}

const HeaderSection = ({resumeBase}: HeaderSectionProps) => {
    return (
        <>
            <div className="pdf-header">
                <div className="pdf-personal-info">
                    <p className="pdf-job-title">{resumeBase?.subTitle}</p>
                    <h1>{resumeBase?.userNm}</h1>
                    {resumeBase?.mobile && (
                        <p style={{marginTop: '1rem'}}><span className="inline-block w-5 text-center mr-2">📞</span> { resumeBase.mobile }</p>
                    )}
                    {resumeBase?.email && (
                        <p><span className="inline-block w-5 text-center mr-2">📧</span> { resumeBase.email }</p>
                    )}
                    {resumeBase?.portfolio && (
                        <p><span className="inline-block w-5 text-center mr-2">🔗</span> { resumeBase.portfolio }</p>
                    )}
                </div>
                <div className="pdf-contact-info">
                    {resumeBase?.faceImgPath && (
                        <Image
                            className="w-[110px] h-auto"
                            src={ resumeBase.faceImgPath }
                            alt="이력서 증명사진"
                            width={128}
                            height={165}
                        />
                    )}
                </div>
            </div>
            {resumeBase?.addr && (
            <div>
                거주지 : {resumeBase.addr}
            </div>
            )}
        </>
    );
};

export default HeaderSection;