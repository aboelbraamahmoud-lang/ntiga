/* eslint-disable @next/next/no-img-element */
"use client";

import type { CSSProperties } from "react";
import { coordinatorForSubject, type Workspace } from "@/lib/results-engine";

export const reportStyle = (workspace: Workspace) => ({ "--report-primary": workspace.settings.reportDesign.primaryColor, "--report-secondary": workspace.settings.reportDesign.secondaryColor, "--report-accent": workspace.settings.reportDesign.accentColor } as CSSProperties);

export function ReportHeader({ workspace, title, subject, assessment }: { workspace: Workspace; title: string; subject: string; assessment: string }) {
  const design = workspace.settings.reportDesign;
  return <>
    <div className="report-head">
      <div className="report-brand">{design.showLogo && (design.logoDataUrl ? <img src={design.logoDataUrl} alt="شعار التقرير" className="report-logo-image"/> : <span className="report-brand-mark">{design.logoLetter}</span>)}<div><b>{design.ministryHeader}</b><small>{design.systemHeader}</small></div></div>
      <div className="report-identity"><p><span>{design.schoolLabel}</span><b>{workspace.settings.schoolName}</b></p><p><span>{design.yearLabel}</span><b>{workspace.settings.academicYear}</b></p></div>
    </div>
    <h1 className="report-title">{title}</h1>
    <div className="report-context"><p><span>{design.assessmentLabel}</span><b>{assessment}</b></p><p><span>{design.subjectLabel}</span><b>{subject}</b></p></div>
  </>;
}

export function ReportFooter({ workspace, teacher = "", subject = "", customFooter = "" }: { workspace: Workspace; teacher?: string; subject?: string; customFooter?: string }) {
  const design = workspace.settings.reportDesign;
  const settings = workspace.settings;
  const signatures = [[design.signatureLabels.teacher, teacher], [design.signatureLabels.coordinator, coordinatorForSubject(workspace, subject)], [design.signatureLabels.vice, settings.academicViceName], [design.signatureLabels.principal, settings.principalName]];
  const attribution = [settings.preparedByName && `إعداد: ${settings.preparedByName}`, settings.reviewedByName && `مراجعة: ${settings.reviewedByName}`, settings.programmerDesignerName && `البرمجة والتصميم: ${settings.programmerDesignerName}`, settings.reportSystemName && `طُبع بواسطة: ${settings.reportSystemName}`].filter(Boolean);
  return <div className="report-footer">
    {design.showSignatures && <div className="report-signatures">{signatures.map(([label, value]) => <div key={label}><b>{label}</b><span>{value || ""}</span></div>)}</div>}
    {(customFooter || design.footerText) && <p className="report-custom-footer">{customFooter || design.footerText}</p>}
    {design.showVision && settings.schoolVision && <p>الرؤية: {settings.schoolVision}</p>}
    {design.showAttribution && (attribution.length > 0 || settings.showGeneratedAt) && <div className="report-attribution">{attribution.length > 0 && <span>{attribution.join(" · ")}</span>}{settings.showGeneratedAt && <span suppressHydrationWarning>تاريخ الإصدار: {new Date().toLocaleString("ar-EG")}</span>}</div>}
    {design.showStamp && design.stampDataUrl && <img src={design.stampDataUrl} alt="ختم التقرير" className="report-stamp-image"/>}
  </div>;
}
