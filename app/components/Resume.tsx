// src/app/components/ResumeBuilder.tsx
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/app/page';
import { db } from '@/app/lib/firebase';

// ===============================================
// 1. CSS & GLOBAL STYLES
// ===============================================
if (typeof window !== 'undefined' && !document.getElementById('app-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'app-styles';
  styleSheet.innerHTML = `
    @import url('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css');
    @import url('https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css');
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&display=swap');

    :root {
      --primary-color: #4f46e5;
      --bg-color: #f8fafc;
      --paper-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    }

    body { background-color: var(--bg-color); font-family: 'Inter', sans-serif; }

    /* Custom Scrollbar */
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
    
    .form-control, .form-select {
      border: 1px solid #e2e8f0;
      background-color: #fff;
      padding: 0.5rem 0.7rem;
      font-size: 0.85rem;
      border-radius: 0.4rem;
    }
    .form-control:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
    }
    .form-label { font-weight: 600; font-size: 0.75rem; color: #64748b; margin-bottom: 0.3rem; text-transform: uppercase; letter-spacing: 0.5px; }

    .a4-paper {
      width: 210mm;
      min-height: 297mm;
      background: white;
      box-shadow: var(--paper-shadow);
      transform-origin: top center;
      transition: transform 0.2s ease;
    }

    .accordion-button { background-color: #fff; font-weight: 600; color: #334155; padding: 0.75rem; font-size: 0.9rem; }
    .accordion-button:not(.collapsed) { color: var(--primary-color); background-color: #eef2ff; }
    .accordion-item { border: 1px solid #e2e8f0; overflow: hidden; border-radius: 0.5rem; margin-bottom: 0.5rem; }
  `;
  document.head.appendChild(styleSheet);
}

// ===============================================
// 2. EXTENDED TYPE DEFINITIONS
// ===============================================
interface Experience {
  id: string;
  title: string;
  company: string;
  years: string;
  locationType?: string; // Remote, On-site
  employmentType?: string; // Full-time, Contract
  bullets: string;
}

interface Education {
  id: string;
  degree: string;
  institution: string;
  years: string;
  grade?: string; // GPA
}

interface Certification {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

interface Language {
  id: string;
  language: string;
  proficiency: string;
}

interface Skills {
  technical: string;
  soft: string;
}

interface ResumeData {
  jobTitle: string;
  name: string;
  phone: string;
  email: string;
  linkedin: string;
  website: string;
  summary: string;
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  languages: Language[];
  skills: Skills;
}

// ===============================================
// 3. INITIAL DATA
// ===============================================
const initialResumeData: ResumeData = {
  jobTitle: '',
  name: '',
  phone: '',
  email: '',
  linkedin: '',
  website: '',
  summary: '',
  experience: [],
  education: [],
  certifications: [],
  languages: [],
  skills: { technical: '', soft: '' },
};

// ===============================================
// 4. UPDATED TEMPLATE COMPONENTS
// ===============================================

const TemplateProfessional: React.FC<{ data: ResumeData }> = ({ data }) => (
  <div className="p-5 h-100 font-sans text-dark">
    {/* Header */}
    <header className="border-bottom border-2 border-dark pb-4 mb-4">
      <h1 className="display-5 fw-bold text-uppercase tracking-wide mb-1">{data.name || 'Your Name'}</h1>
      <p className="h5 text-primary fw-medium mb-3">{data.jobTitle || 'Target Role'}</p>
      <div className="d-flex flex-wrap gap-3 text-secondary small">
        {data.email && <span><i className="bi bi-envelope-fill me-1"></i>{data.email}</span>}
        {data.phone && <span><i className="bi bi-telephone-fill me-1"></i>{data.phone}</span>}
        {data.linkedin && <span><i className="bi bi-linkedin me-1"></i>{data.linkedin}</span>}
        {data.website && <span><i className="bi bi-globe me-1"></i>{data.website}</span>}
      </div>
    </header>

    {/* Summary */}
    {data.summary && (
      <section className="mb-4">
        <h3 className="h6 fw-bold text-uppercase border-bottom pb-1 mb-2">Professional Summary</h3>
        <p className="small text-secondary" style={{ lineHeight: 1.6 }}>{data.summary}</p>
      </section>
    )}

    {/* Experience */}
    <section className="mb-4">
      <h3 className="h6 fw-bold text-uppercase border-bottom pb-1 mb-3">Experience</h3>
      {data.experience.length > 0 ? data.experience.map(exp => (
        <div key={exp.id} className="mb-3">
          <div className="d-flex justify-content-between align-items-baseline">
            <h4 className="fw-bold small mb-0">{exp.title}</h4>
            <span className="small fw-bold text-dark">{exp.years}</span>
          </div>
          <div className="small text-primary fst-italic mb-1">
            {exp.company} 
            {exp.locationType && <span className="text-muted fw-normal"> • {exp.locationType}</span>}
          </div>
          <ul className="small text-secondary ps-3 mb-0">
            {exp.bullets.split('\n').map((b, i) => b.trim() && <li key={i}>{b.replace(/•/g, '').trim()}</li>)}
          </ul>
        </div>
      )) : <p className="small text-muted fst-italic">No experience listed.</p>}
    </section>

    <div className="row">
      <div className="col-7">
        {/* Education */}
        <h3 className="h6 fw-bold text-uppercase border-bottom pb-1 mb-2">Education</h3>
        {data.education.map(edu => (
          <div key={edu.id} className="mb-3 small">
            <div className="fw-bold">{edu.institution}</div>
            <div>{edu.degree}</div>
            <div className="d-flex justify-content-between text-muted">
              <span>{edu.years}</span>
              {edu.grade && <span>GPA: {edu.grade}</span>}
            </div>
          </div>
        ))}

        {/* Certifications */}
        {data.certifications.length > 0 && (
          <div className="mt-4">
            <h3 className="h6 fw-bold text-uppercase border-bottom pb-1 mb-2">Certifications</h3>
            {data.certifications.map(cert => (
              <div key={cert.id} className="mb-1 small">
                <span className="fw-bold">{cert.name}</span> <span className="text-muted">- {cert.issuer} ({cert.date})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="col-5">
        {/* Skills */}
        <h3 className="h6 fw-bold text-uppercase border-bottom pb-1 mb-2">Skills</h3>
        <div className="mb-3">
          <p className="small mb-1 fw-bold text-dark">Technical</p>
          <p className="small text-secondary">{data.skills.technical}</p>
        </div>
        <div className="mb-3">
          <p className="small mb-1 fw-bold text-dark">Soft Skills</p>
          <p className="small text-secondary">{data.skills.soft}</p>
        </div>

        {/* Languages */}
        {data.languages.length > 0 && (
          <div>
            <h3 className="h6 fw-bold text-uppercase border-bottom pb-1 mb-2">Languages</h3>
            <ul className="list-unstyled small text-secondary">
              {data.languages.map(lang => (
                <li key={lang.id} className="mb-1 d-flex justify-content-between">
                  <span>{lang.language}</span>
                  <span className="text-muted fst-italic">{lang.proficiency}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  </div>
);

const TemplateModern: React.FC<{ data: ResumeData }> = ({ data }) => (
  <div className="d-flex h-100 font-sans bg-white">
    {/* Sidebar */}
    <div className="bg-dark text-white p-4" style={{ width: '33%', backgroundColor: '#1e293b' }}>
      <div className="mb-5">
        <h1 className="h2 fw-bold mb-1 text-white">{data.name || 'Your Name'}</h1>
        <p className="text-info small text-uppercase letter-spacing-2">{data.jobTitle}</p>
      </div>

      <div className="mb-4">
        <h6 className="text-uppercase text-white-50 border-bottom border-secondary pb-1 mb-3 small">Contact</h6>
        <div className="small d-flex flex-column gap-2 opacity-75">
          <div>{data.email}</div>
          <div>{data.phone}</div>
          <div>{data.website}</div>
          <div>{data.linkedin.replace('https://', '')}</div>
        </div>
      </div>

      <div className="mb-4">
        <h6 className="text-uppercase text-white-50 border-bottom border-secondary pb-1 mb-3 small">Education</h6>
        {data.education.map(edu => (
          <div key={edu.id} className="mb-3 small">
            <div className="fw-bold text-white">{edu.degree}</div>
            <div className="opacity-75">{edu.institution}</div>
            <div className="d-flex justify-content-between opacity-50">
              <span>{edu.years}</span>
              {edu.grade && <span>{edu.grade}</span>}
            </div>
          </div>
        ))}
      </div>

      {data.skills.technical && (
        <div className="mb-4">
          <h6 className="text-uppercase text-white-50 border-bottom border-secondary pb-1 mb-3 small">Skills</h6>
          <div className="d-flex flex-wrap gap-1">
            {data.skills.technical.split(',').map((s, i) => (
              <span key={i} className="badge bg-secondary bg-opacity-25 fw-normal border border-secondary border-opacity-25">{s.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {data.languages.length > 0 && (
        <div>
          <h6 className="text-uppercase text-white-50 border-bottom border-secondary pb-1 mb-3 small">Languages</h6>
          <ul className="list-unstyled small opacity-75">
            {data.languages.map(lang => (
              <li key={lang.id} className="mb-1 d-flex justify-content-between">
                <span>{lang.language}</span>
                <span className="opacity-50">{lang.proficiency}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>

    {/* Main Content */}
    <div className="p-4 pt-5" style={{ width: '67%' }}>
      <section className="mb-5">
        <h3 className="h6 fw-bold text-uppercase text-primary mb-3">Profile</h3>
        <p className="small text-secondary" style={{ lineHeight: 1.7 }}>{data.summary}</p>
      </section>

      <section className="mb-5">
        <h3 className="h6 fw-bold text-uppercase text-primary mb-4">Experience</h3>
        {data.experience.map(exp => (
          <div key={exp.id} className="mb-4 position-relative ps-3 border-start border-2 border-light">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <h4 className="fw-bold small mb-0 text-dark">{exp.title}</h4>
              <span className="badge bg-light text-dark border">{exp.years}</span>
            </div>
            <div className="small text-primary fw-bold mb-2">
              {exp.company} 
              {exp.employmentType && <span className="text-muted fw-normal"> • {exp.employmentType}</span>}
            </div>
            <ul className="small text-secondary ps-3 mb-0">
              {exp.bullets.split('\n').map((b, i) => b.trim() && <li key={i} className="mb-1">{b.replace(/•/g, '').trim()}</li>)}
            </ul>
          </div>
        ))}
      </section>

      {data.certifications.length > 0 && (
        <section>
          <h3 className="h6 fw-bold text-uppercase text-primary mb-3">Certifications</h3>
          <div className="row g-2">
            {data.certifications.map(cert => (
              <div key={cert.id} className="col-6">
                <div className="p-2 border rounded bg-light small">
                  <div className="fw-bold text-dark">{cert.name}</div>
                  <div className="text-muted tiny">{cert.issuer} • {cert.date}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  </div>
);

const TemplateMinimal: React.FC<{ data: ResumeData }> = ({ data }) => (
  <div className="p-5 h-100 font-serif text-dark bg-white">
    <header className="text-center mb-5">
      <h1 className="display-4 fw-bold mb-2" style={{ fontFamily: 'Merriweather, serif' }}>{data.name}</h1>
      <p className="text-secondary fst-italic mb-3">{data.jobTitle}</p>
      <p className="small text-muted text-uppercase letter-spacing-2">
        {data.email} &bull; {data.phone} {data.website && <span>&bull; {data.website}</span>}
      </p>
    </header>

    <div className="px-4 mb-5">
      <p className="text-center small text-secondary" style={{ lineHeight: 1.8 }}>{data.summary}</p>
    </div>

    <hr className="my-5 opacity-25" />

    <div className="row g-0">
      <div className="col-3">
        <h3 className="h6 fw-bold text-uppercase text-secondary">Experience</h3>
      </div>
      <div className="col-9">
        {data.experience.map(exp => (
          <div key={exp.id} className="mb-4">
            <div className="d-flex justify-content-between mb-1">
              <h4 className="h6 fw-bold mb-0">{exp.title}</h4>
              <span className="small text-muted fst-italic">{exp.years}</span>
            </div>
            <div className="small text-secondary mb-2">{exp.company}</div>
            <p className="small text-muted" style={{ whiteSpace: 'pre-line' }}>{exp.bullets}</p>
          </div>
        ))}
      </div>
    </div>

    {(data.education.length > 0 || data.certifications.length > 0) && (
      <div className="row g-0 mt-4">
        <div className="col-3">
          <h3 className="h6 fw-bold text-uppercase text-secondary">Education</h3>
        </div>
        <div className="col-9">
          {data.education.map(edu => (
            <div key={edu.id} className="mb-3 small">
              <div className="fw-bold">{edu.institution}</div>
              <div className="text-muted">{edu.degree}, {edu.years} {edu.grade && <span>(GPA: {edu.grade})</span>}</div>
            </div>
          ))}
          {data.certifications.length > 0 && (
            <div className="mt-3">
              <p className="fw-bold small mb-1">Certifications</p>
              {data.certifications.map(cert => (
                <div key={cert.id} className="text-muted small">• {cert.name} ({cert.issuer})</div>
              ))}
            </div>
          )}
        </div>
      </div>
    )}
  </div>
);

// ===============================================
// 5. MAIN BUILDER LOGIC
// ===============================================

const ResumeBuilder: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<ResumeData>(initialResumeData);
  const [template, setTemplate] = useState<'professional' | 'modern' | 'minimal'>('modern');
  const [zoom, setZoom] = useState(0.65);
  const [isLoading, setIsLoading] = useState(true);

  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'default-app-id';

  // --- FETCH & MAP PROFILE DATA ---
  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user) { setIsLoading(false); return; }

      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'profile');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data();
          
          const resumeMappedData: ResumeData = {
            name: profile.name || '',
            jobTitle: profile.headline || '',
            phone: profile.phone || '', 
            email: user.email || '',
            linkedin: profile.socialLinks?.linkedin || '',
            website: profile.website || '',
            summary: profile.about || '',
            
            // Map Experience (with new fields)
            experience: Array.isArray(profile.experience) ? profile.experience.map((exp: any) => ({
              id: String(exp.id || Date.now()),
              title: exp.title || '',
              company: exp.company || '',
              years: exp.dates || '',
              locationType: exp.locationType || '',
              employmentType: exp.employmentType || '',
              bullets: exp.description || '' 
            })) : [],

            // Map Education (with Grade)
            education: Array.isArray(profile.education) ? profile.education.map((edu: any) => ({
              id: String(edu.id || Date.now()),
              institution: edu.school || '',
              degree: edu.degree || '',
              years: edu.dates || '',
              grade: edu.grade || ''
            })) : [],

            // Map Certifications
            certifications: Array.isArray(profile.certifications) ? profile.certifications.map((cert: any) => ({
              id: String(cert.id || Date.now()),
              name: cert.name || '',
              issuer: cert.issuer || '',
              date: cert.date || ''
            })) : [],

            // Map Languages
            languages: Array.isArray(profile.languages) ? profile.languages.map((lang: any) => ({
              id: String(lang.id || Date.now()),
              language: lang.language || '',
              proficiency: lang.proficiency || ''
            })) : [],

            // Map Skills
            skills: {
              technical: Array.isArray(profile.skills) ? profile.skills.map((s: any) => s.name).join(', ') : '',
              soft: '' 
            }
          };
          setData(resumeMappedData);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfileData();
  }, [user, appId]);

  // --- HANDLERS ---
  const updateField = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [section, key] = name.split('.');
      setData(prev => ({ ...prev, [section]: { ...(prev as any)[section], [key]: value } }));
    } else {
      setData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Generic Array Handlers
  const updateArray = (section: keyof ResumeData, index: number, field: string, value: string) => {
    setData(prev => {
      const newArr = [...(prev[section] as any[])];
      newArr[index] = { ...newArr[index], [field]: value };
      return { ...prev, [section]: newArr };
    });
  };

  const addArrayItem = (section: keyof ResumeData, template: any) => {
    setData(prev => ({ ...prev, [section]: [...(prev[section] as any[]), { ...template, id: Date.now().toString() }] }));
  };

  const removeArrayItem = (section: keyof ResumeData, index: number) => {
    setData(prev => ({ ...prev, [section]: (prev[section] as any[]).filter((_, i) => i !== index) }));
  };

  // Print
  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=900,height=1200');
    if (!printWindow) return alert('Allow popups to print');
    const content = document.getElementById('resume-page')?.innerHTML || '';
    printWindow.document.write(`<html><head><title>${data.name}</title><link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"><style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Merriweather:wght@300;400;700&display=swap'); body { margin: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } @page { margin: 0; size: auto; }</style></head><body>${content}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
  };

  // Score
  const atsScore = useMemo(() => {
    let score = 20;
    if(data.name && data.email) score += 10;
    if(data.summary.length > 50) score += 15;
    if(data.experience.length > 0) score += 20;
    if(data.education.length > 0) score += 15;
    if(data.skills.technical.length > 10) score += 20;
    return Math.min(100, score);
  }, [data]);

  if (isLoading) return <div className="vh-100 d-flex align-items-center justify-content-center"><div className="spinner-border text-primary" role="status"></div></div>;

  return (
    <div className="d-flex flex-column vh-100 overflow-hidden bg-light">
      {/* --- NAVBAR --- */}
      <nav className="navbar navbar-light bg-white border-bottom px-4 py-2 z-3 shadow-sm" style={{ height: '64px' }}>
        <div className="d-flex align-items-center gap-2">
          <div className="bg-dark rounded text-white p-1"><i className="bi bi-file-text fs-5"></i></div>
          <h6 className="fw-bold mb-0 text-dark">Resume Editor</h6>
        </div>
        <div className="mx-auto d-flex align-items-center gap-3">
          <div className="d-flex align-items-center gap-2 bg-light px-3 py-1 rounded-pill border">
            <span className="small fw-bold text-secondary">Completion:</span>
            <div className="progress" style={{ width: '60px', height: '6px' }}>
              <div className={`progress-bar ${atsScore > 80 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${atsScore}%` }}></div>
            </div>
            <span className="small fw-bold text-dark">{atsScore}%</span>
          </div>
        </div>
        <div className="d-flex gap-2">
          <div className="btn-group">
            <button className={`btn btn-sm ${template === 'professional' ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setTemplate('professional')}>Pro</button>
            <button className={`btn btn-sm ${template === 'modern' ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setTemplate('modern')}>Modern</button>
            <button className={`btn btn-sm ${template === 'minimal' ? 'btn-dark' : 'btn-outline-secondary'}`} onClick={() => setTemplate('minimal')}>Clean</button>
          </div>
          <button className="btn btn-primary btn-sm fw-medium shadow-sm" onClick={handlePrint}><i className="bi bi-download me-2"></i>Download</button>
        </div>
      </nav>

      {/* --- EDITOR WORKSPACE --- */}
      <div className="row g-0 h-100 overflow-hidden">
        {/* LEFT EDITOR */}
        <div className="col-lg-4 col-xl-3 h-100 border-end bg-white overflow-y-auto custom-scrollbar p-4 pb-5">
          
          {/* Personal Details */}
          <div className="mb-4">
            <label className="form-label"><i className="bi bi-person me-1"></i> Personal Details</label>
            <div className="card border-0 bg-light p-3">
              <div className="row g-2">
                <div className="col-12"><input name="name" className="form-control" placeholder="Full Name" value={data.name} onChange={updateField} /></div>
                <div className="col-12"><input name="jobTitle" className="form-control" placeholder="Target Job Title" value={data.jobTitle} onChange={updateField} /></div>
                <div className="col-6"><input name="email" className="form-control" placeholder="Email" value={data.email} onChange={updateField} /></div>
                <div className="col-6"><input name="phone" className="form-control" placeholder="Phone" value={data.phone} onChange={updateField} /></div>
                <div className="col-12"><input name="linkedin" className="form-control" placeholder="LinkedIn URL" value={data.linkedin} onChange={updateField} /></div>
                <div className="col-12"><input name="website" className="form-control" placeholder="Portfolio Website" value={data.website} onChange={updateField} /></div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-4">
            <label className="form-label"><i className="bi bi-text-paragraph me-1"></i> Professional Summary</label>
            <textarea name="summary" className="form-control bg-light border-0" rows={4} value={data.summary} onChange={updateField} />
          </div>

          {/* Experience */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0"><i className="bi bi-briefcase me-1"></i> Experience</label>
              <button className="btn btn-xs btn-outline-primary rounded-pill py-0" onClick={() => addArrayItem('experience', {title:'Title',company:'Company',years:'',bullets:''})}>+ Add</button>
            </div>
            <div className="accordion accordion-flush" id="expAccordion">
              {data.experience.map((exp, i) => (
                <div className="accordion-item bg-transparent" key={exp.id}>
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed py-2 bg-light rounded-2 mb-1 border" type="button" data-bs-toggle="collapse" data-bs-target={`#exp${exp.id}`}>
                      <span className="fw-bold text-dark small text-truncate">{exp.title || 'New Role'}</span>
                    </button>
                  </h2>
                  <div id={`exp${exp.id}`} className="accordion-collapse collapse" data-bs-parent="#expAccordion">
                    <div className="accordion-body p-2">
                      <input className="form-control mb-2" placeholder="Title" value={exp.title} onChange={e => updateArray('experience', i, 'title', e.target.value)} />
                      <input className="form-control mb-2" placeholder="Company" value={exp.company} onChange={e => updateArray('experience', i, 'company', e.target.value)} />
                      <div className="row g-2 mb-2">
                        <div className="col-6"><input className="form-control" placeholder="Dates" value={exp.years} onChange={e => updateArray('experience', i, 'years', e.target.value)} /></div>
                        <div className="col-6"><input className="form-control" placeholder="Type (Full-time)" value={exp.employmentType} onChange={e => updateArray('experience', i, 'employmentType', e.target.value)} /></div>
                      </div>
                      <textarea className="form-control mb-2" rows={3} placeholder="Description..." value={exp.bullets} onChange={e => updateArray('experience', i, 'bullets', e.target.value)} />
                      <button className="btn btn-link text-danger btn-sm p-0" onClick={() => removeArrayItem('experience', i)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Education */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0"><i className="bi bi-mortarboard me-1"></i> Education</label>
              <button className="btn btn-xs btn-outline-primary rounded-pill py-0" onClick={() => addArrayItem('education', {institution:'School',degree:'Degree',years:''})}>+ Add</button>
            </div>
            <div className="accordion accordion-flush" id="eduAccordion">
              {data.education.map((edu, i) => (
                <div className="accordion-item bg-transparent" key={edu.id}>
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed py-2 bg-light rounded-2 mb-1 border" type="button" data-bs-toggle="collapse" data-bs-target={`#edu${edu.id}`}>
                      <span className="fw-bold text-dark small text-truncate">{edu.institution || 'New School'}</span>
                    </button>
                  </h2>
                  <div id={`edu${edu.id}`} className="accordion-collapse collapse" data-bs-parent="#eduAccordion">
                    <div className="accordion-body p-2">
                      <input className="form-control mb-2" placeholder="School" value={edu.institution} onChange={e => updateArray('education', i, 'institution', e.target.value)} />
                      <input className="form-control mb-2" placeholder="Degree" value={edu.degree} onChange={e => updateArray('education', i, 'degree', e.target.value)} />
                      <div className="row g-2 mb-2">
                        <div className="col-8"><input className="form-control" placeholder="Years" value={edu.years} onChange={e => updateArray('education', i, 'years', e.target.value)} /></div>
                        <div className="col-4"><input className="form-control" placeholder="GPA" value={edu.grade} onChange={e => updateArray('education', i, 'grade', e.target.value)} /></div>
                      </div>
                      <button className="btn btn-link text-danger btn-sm p-0" onClick={() => removeArrayItem('education', i)}>Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0"><i className="bi bi-award me-1"></i> Certifications</label>
              <button className="btn btn-xs btn-outline-primary rounded-pill py-0" onClick={() => addArrayItem('certifications', {name:'Cert Name',issuer:'Issuer',date:''})}>+ Add</button>
            </div>
            {data.certifications.map((cert, i) => (
              <div key={cert.id} className="bg-light p-2 rounded border mb-2 position-relative">
                <input className="form-control mb-1" placeholder="Name" value={cert.name} onChange={e => updateArray('certifications', i, 'name', e.target.value)} />
                <div className="row g-1">
                  <div className="col-7"><input className="form-control" placeholder="Issuer" value={cert.issuer} onChange={e => updateArray('certifications', i, 'issuer', e.target.value)} /></div>
                  <div className="col-5"><input className="form-control" placeholder="Date" value={cert.date} onChange={e => updateArray('certifications', i, 'date', e.target.value)} /></div>
                </div>
                <button className="btn-close position-absolute top-0 end-0 m-1" style={{fontSize: '0.6rem'}} onClick={() => removeArrayItem('certifications', i)}></button>
              </div>
            ))}
          </div>

          {/* Languages */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <label className="form-label mb-0"><i className="bi bi-translate me-1"></i> Languages</label>
              <button className="btn btn-xs btn-outline-primary rounded-pill py-0" onClick={() => addArrayItem('languages', {language:'', proficiency:''})}>+ Add</button>
            </div>
            {data.languages.map((lang, i) => (
              <div key={lang.id} className="d-flex gap-2 mb-2">
                <input className="form-control" placeholder="Language" value={lang.language} onChange={e => updateArray('languages', i, 'language', e.target.value)} />
                <input className="form-control" placeholder="Level" value={lang.proficiency} onChange={e => updateArray('languages', i, 'proficiency', e.target.value)} />
                <button className="btn btn-outline-danger" onClick={() => removeArrayItem('languages', i)}><i className="bi bi-trash"></i></button>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div className="mb-5">
            <label className="form-label"><i className="bi bi-tools me-1"></i> Skills</label>
            <div className="bg-light p-3 rounded border">
              <label className="small text-muted fw-bold mb-1">Technical</label>
              <input name="skills.technical" className="form-control mb-2" value={data.skills.technical} onChange={updateField} />
              <label className="small text-muted fw-bold mb-1">Soft Skills</label>
              <input name="skills.soft" className="form-control" value={data.skills.soft} onChange={updateField} />
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div className="col-lg-8 col-xl-9 h-100 bg-secondary bg-opacity-10 d-flex flex-column align-items-center overflow-hidden position-relative">
          <div className="position-absolute bottom-4 start-50 translate-middle-x bg-dark text-white px-3 py-2 rounded-pill shadow-lg z-3 d-flex align-items-center gap-3">
            <button className="btn btn-link text-white p-0" onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}><i className="bi bi-dash"></i></button>
            <span className="small fw-bold" style={{minWidth: '40px', textAlign: 'center'}}>{Math.round(zoom * 100)}%</span>
            <button className="btn btn-link text-white p-0" onClick={() => setZoom(z => Math.min(1.2, z + 0.1))}><i className="bi bi-plus"></i></button>
          </div>

          <div className="overflow-auto w-100 h-100 d-flex justify-content-center pt-5 pb-5 custom-scrollbar">
            <div className="a4-paper" id="resume-page" style={{ transform: `scale(${zoom})`, marginBottom: `${(1 - zoom) * -100}%` }}>
              {template === 'modern' ? <TemplateModern data={data} /> : template === 'minimal' ? <TemplateMinimal data={data} /> : <TemplateProfessional data={data} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResumeBuilder;