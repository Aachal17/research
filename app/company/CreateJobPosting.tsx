// src/app/company/CreateJobPosting.tsx

"use client";
import { FC, useState, FormEvent, useCallback } from 'react';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore'; 
import dynamic from 'next/dynamic';
import { useAuth } from '@/app/page'; 
import { db } from '@/app/lib/firebase'; 

// ===============================================
// TYPE DEFINITIONS
// ===============================================

interface JobPost {
    jobTitle: string;
    employmentType: string;
    description: string;
    salary: number | string;
    salaryType: string;
    skillRequirements: string; 
    tags: string; 
    country: string;
    city: string;
    address: string;
    latitude: number; 
    longitude: number;
}

interface LocationMapProps {
    initialPosition: [number, number];
    onLocationChange: (lat: number, lng: number) => void;
}

const initialJobPost: JobPost = {
    jobTitle: '',
    employmentType: 'Full-Time',
    description: '',
    salary: '',
    salaryType: 'Yearly',
    skillRequirements: '',
    tags: '',
    country: '',
    city: '',
    address: '',
    latitude: 20.5937, // Default center of India
    longitude: 78.9629,
};

// ===============================================
// DYNAMIC MAP IMPORT
// ===============================================
const DynamicLocationMap = dynamic<LocationMapProps>(
    () => import('./LocationMap'),
    { 
        ssr: false, 
        loading: () => (
            <div className="d-flex align-items-center justify-content-center bg-light rounded-4 border" 
                 style={{ height: '350px', width: '100%' }}>
                <div className="text-center text-muted">
                    <div className="spinner-border spinner-border-sm mb-2" role="status"></div>
                    <p className="small mb-0">Loading map...</p>
                </div>
            </div>
        )
    }
);

// ===============================================
// UTILITY COMPONENTS
// ===============================================

const StepIndicator: FC<{ currentStep: number, steps: string[] }> = ({ currentStep, steps }) => (
    <div className="mb-5 px-2">
        <div className="position-relative d-flex justify-content-between align-items-center">
            {/* Progress Line Background */}
            <div className="position-absolute top-50 start-0 w-100 translate-middle-y bg-light" style={{ height: '4px', zIndex: 0 }}></div>
            
            {/* Active Progress Line */}
            <div 
                className="position-absolute top-50 start-0 translate-middle-y bg-success transition-all" 
                style={{ 
                    height: '4px', 
                    zIndex: 0, 
                    width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                    transition: 'width 0.4s ease'
                }}
            ></div>

            {steps.map((label, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber === currentStep;
                const isComplete = stepNumber < currentStep;

                return (
                    <div key={stepNumber} className="position-relative z-1 text-center" style={{ width: '120px' }}>
                        <div 
                            className={`d-inline-flex align-items-center justify-content-center rounded-circle mb-2 border border-4 border-white transition-all shadow-sm
                                ${isActive ? 'bg-success text-white scale-110' : isComplete ? 'bg-success text-white' : 'bg-light text-muted'}`}
                            style={{ width: '40px', height: '40px', transition: 'all 0.3s ease' }}
                        >
                            {isComplete ? <i className="bi bi-check-lg fw-bold"></i> : <span className="fw-bold small">{stepNumber}</span>}
                        </div>
                        <p className={`small fw-bold mb-0 position-absolute start-50 translate-middle-x w-100 ${isActive ? 'text-dark' : 'text-muted'}`} style={{ top: '45px' }}>
                            {label}
                        </p>
                    </div>
                );
            })}
        </div>
    </div>
);

const RichTextEditor: FC<{ value: string, onChange: (value: string) => void }> = ({ value, onChange }) => {
    return (
        <div className="border rounded-3 overflow-hidden bg-white focus-within-shadow">
            <div className="bg-light border-bottom p-2 d-flex gap-2">
                <div className="btn-group">
                    <button type="button" className="btn btn-sm btn-white border hover-bg-gray"><i className="bi bi-type-bold"></i></button>
                    <button type="button" className="btn btn-sm btn-white border hover-bg-gray"><i className="bi bi-type-italic"></i></button>
                    <button type="button" className="btn btn-sm btn-white border hover-bg-gray"><i className="bi bi-type-underline"></i></button>
                </div>
                <div className="vr mx-1 text-muted opacity-25"></div>
                <div className="btn-group">
                    <button type="button" className="btn btn-sm btn-white border hover-bg-gray"><i className="bi bi-list-ul"></i></button>
                    <button type="button" className="btn btn-sm btn-white border hover-bg-gray"><i className="bi bi-list-ol"></i></button>
                </div>
            </div>
            <textarea
                className="form-control border-0 p-3 shadow-none"
                rows={8}
                value={value} 
                onChange={(e) => onChange(e.target.value)}
                placeholder="Describe the role, responsibilities, and what you're looking for..."
                required
                style={{ resize: 'vertical' }}
            />
        </div>
    );
};

// ===============================================
// MAIN COMPONENT
// ===============================================

interface CreateJobPostingProps {
    onPostSuccess: () => void; 
    onPostError: (message: string) => void;
}

export const CreateJobPosting: FC<CreateJobPostingProps> = ({ onPostSuccess, onPostError }) => {
    const { user, setError, clearError } = useAuth();
    const [step, setStep] = useState(1);
    const [jobData, setJobData] = useState<JobPost>(initialJobPost);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const steps = ['Basics', 'Details', 'Skills', 'Location', 'Review'];
    
    const updateField = (name: keyof JobPost, value: string | number) => {
        setJobData(prev => ({ ...prev, [name]: value }));
    };

    const nextStep = (e: FormEvent) => {
        e.preventDefault();
        setStep(prev => Math.min(prev + 1, steps.length));
        window.scrollTo(0, 0);
    };

    const prevStep = () => {
        setStep(prev => Math.max(prev - 1, 1));
        window.scrollTo(0, 0);
    };

    const handleLocationChange = useCallback((lat: number, lng: number) => {
        setJobData(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
        }));
    }, []);

    const handlePostJob = async () => {
        if (!user) {
            onPostError('You must be logged in to post a job.');
            return;
        }

        setIsSubmitting(true);
        clearError();

        try {
            const jobPostingData = {
                ...jobData,
                companyId: user.uid,
                companyName: user.displayName || 'Anonymous Company',
                status: 'Active',
                createdAt: serverTimestamp(),
            };
            
            const jobsCollectionRef = collection(db, 'jobPostings');
            await addDoc(jobsCollectionRef, jobPostingData);

            const companyRef = doc(db, 'companies', user.uid);
            // Note: Firestore increment requires importing 'increment' from firebase/firestore
            // For simplicity, we'll skip the counter update or handle it elsewhere
            
            if (onPostSuccess) onPostSuccess();

        } catch (error) {
            console.error('Error posting job:', error);
            if (onPostError) onPostError(`Failed to post job: ${(error as any).message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStepContent = () => {
        switch (step) {
            case 1: // Basics
                return (
                    <form onSubmit={nextStep} className="animate-fade-in">
                        <div className="text-center mb-5">
                            <h4 className="fw-bold">Let's start with the basics</h4>
                            <p className="text-muted">What role are you hiring for?</p>
                        </div>
                        
                        <div className="row justify-content-center">
                            <div className="col-md-8">
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-uppercase text-secondary">Job Title</label>
                                    <input 
                                        type="text" 
                                        className="form-control form-control-lg" 
                                        value={jobData.jobTitle} 
                                        onChange={(e) => updateField('jobTitle', e.target.value)} 
                                        placeholder="e.g. Senior Product Designer"
                                        required 
                                        autoFocus
                                    />
                                </div>
                                
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-uppercase text-secondary">Employment Type</label>
                                    <div className="row g-3">
                                        {['Full-Time', 'Part-Time', 'Contract'].map(type => (
                                            <div className="col-4" key={type}>
                                                <input 
                                                    type="radio" 
                                                    className="btn-check" 
                                                    name="employmentType" 
                                                    id={`type-${type}`} 
                                                    value={type}
                                                    checked={jobData.employmentType === type}
                                                    onChange={(e) => updateField('employmentType', e.target.value)}
                                                />
                                                <label className="btn btn-outline-light text-dark border w-100 py-3 fw-medium" htmlFor={`type-${type}`}>
                                                    {type}
                                                </label>
                                            </div>
                                        ))}
                                        {['Internship', 'Freelance', 'Temporary'].map(type => (
                                            <div className="col-4" key={type}>
                                                <input 
                                                    type="radio" 
                                                    className="btn-check" 
                                                    name="employmentType" 
                                                    id={`type-${type}`} 
                                                    value={type}
                                                    checked={jobData.employmentType === type}
                                                    onChange={(e) => updateField('employmentType', e.target.value)}
                                                />
                                                <label className="btn btn-outline-light text-dark border w-100 py-3 fw-medium" htmlFor={`type-${type}`}>
                                                    {type}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="text-end mt-5">
                                    <button type="submit" className="btn btn-dark px-5 rounded-pill">Continue <i className="bi bi-arrow-right ms-2"></i></button>
                                </div>
                            </div>
                        </div>
                    </form>
                );
            case 2: // Details
                return (
                    <form onSubmit={nextStep} className="animate-fade-in">
                        <div className="text-center mb-5">
                            <h4 className="fw-bold">Describe the role</h4>
                            <p className="text-muted">Provide details about responsibilities and compensation.</p>
                        </div>
                        
                        <div className="row justify-content-center">
                            <div className="col-md-8">
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-uppercase text-secondary">Description</label>
                                    <RichTextEditor value={jobData.description} onChange={(val) => updateField('description', val)} />
                                </div>
                                
                                <div className="row g-3 mb-4">
                                    <div className="col-md-8">
                                        <label className="form-label small fw-bold text-uppercase text-secondary">Salary Amount</label>
                                        <div className="input-group">
                                            <span className="input-group-text bg-light border-end-0">₹</span>
                                            <input 
                                                type="number" 
                                                className="form-control border-start-0 ps-0" 
                                                value={jobData.salary === '' ? '' : String(jobData.salary)} 
                                                onChange={(e) => updateField('salary', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                placeholder="e.g. 1200000" 
                                                required 
                                            />
                                        </div>
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-uppercase text-secondary">Frequency</label>
                                        <select className="form-select" value={jobData.salaryType} onChange={(e) => updateField('salaryType', e.target.value)} required>
                                            {['Yearly', 'Monthly', 'Hourly', 'Fixed'].map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between mt-5">
                                    <button type="button" className="btn btn-link text-secondary text-decoration-none" onClick={prevStep}>Back</button>
                                    <button type="submit" className="btn btn-dark px-5 rounded-pill">Continue <i className="bi bi-arrow-right ms-2"></i></button>
                                </div>
                            </div>
                        </div>
                    </form>
                );
            case 3: // Skills
                return (
                    <form onSubmit={nextStep} className="animate-fade-in">
                        <div className="text-center mb-5">
                            <h4 className="fw-bold">Skills & Requirements</h4>
                            <p className="text-muted">What makes a candidate a good fit?</p>
                        </div>

                        <div className="row justify-content-center">
                            <div className="col-md-8">
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-uppercase text-secondary">Required Skills</label>
                                    <textarea 
                                        className="form-control" 
                                        rows={4} 
                                        value={jobData.skillRequirements} 
                                        onChange={(e) => updateField('skillRequirements', e.target.value)} 
                                        placeholder="e.g. React, Node.js, System Design. Separate with commas." 
                                        required 
                                    />
                                    <div className="form-text">These will be used to match candidates.</div>
                                </div>
                                
                                <div className="mb-4">
                                    <label className="form-label small fw-bold text-uppercase text-secondary">Tags (Optional)</label>
                                    <input 
                                        type="text" 
                                        className="form-control" 
                                        value={jobData.tags} 
                                        onChange={(e) => updateField('tags', e.target.value)} 
                                        placeholder="e.g. #remote #startup #equity" 
                                    />
                                </div>

                                <div className="d-flex justify-content-between mt-5">
                                    <button type="button" className="btn btn-link text-secondary text-decoration-none" onClick={prevStep}>Back</button>
                                    <button type="submit" className="btn btn-dark px-5 rounded-pill">Continue <i className="bi bi-arrow-right ms-2"></i></button>
                                </div>
                            </div>
                        </div>
                    </form>
                );
            case 4: // Location
                return (
                    <form onSubmit={nextStep} className="animate-fade-in">
                        <div className="text-center mb-5">
                            <h4 className="fw-bold">Job Location</h4>
                            <p className="text-muted">Where is this role based?</p>
                        </div>

                        <div className="row justify-content-center">
                            <div className="col-md-10">
                                <div className="row g-4">
                                    <div className="col-md-5">
                                        <div className="mb-3">
                                            <label className="form-label small fw-bold text-uppercase text-secondary">Country</label>
                                            <input type="text" className="form-control" value={jobData.country} onChange={(e) => updateField('country', e.target.value)} required />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label small fw-bold text-uppercase text-secondary">City / State</label>
                                            <input type="text" className="form-control" value={jobData.city} onChange={(e) => updateField('city', e.target.value)} required />
                                        </div>
                                        <div className="mb-3">
                                            <label className="form-label small fw-bold text-uppercase text-secondary">Address</label>
                                            <textarea className="form-control" rows={3} value={jobData.address} onChange={(e) => updateField('address', e.target.value)} required />
                                        </div>
                                    </div>
                                    <div className="col-md-7">
                                        <label className="form-label small fw-bold text-uppercase text-secondary mb-2">Pin Location on Map</label>
                                        <div className="rounded-4 overflow-hidden border shadow-sm">
                                            <DynamicLocationMap
                                                initialPosition={[jobData.latitude, jobData.longitude]}
                                                onLocationChange={handleLocationChange}
                                            />
                                        </div>
                                        <div className="form-text mt-2 text-end">
                                            <i className="bi bi-geo-alt me-1"></i> {jobData.latitude.toFixed(4)}, {jobData.longitude.toFixed(4)}
                                        </div>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between mt-5">
                                    <button type="button" className="btn btn-link text-secondary text-decoration-none" onClick={prevStep}>Back</button>
                                    <button type="submit" className="btn btn-dark px-5 rounded-pill">Review & Post <i className="bi bi-arrow-right ms-2"></i></button>
                                </div>
                            </div>
                        </div>
                    </form>
                );
            case 5: // Review
                return (
                    <div className="animate-fade-in">
                        <div className="text-center mb-5">
                            <h4 className="fw-bold">Ready to post?</h4>
                            <p className="text-muted">Review the details below before publishing.</p>
                        </div>

                        <div className="row justify-content-center">
                            <div className="col-md-8">
                                <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                                    <div className="card-header bg-success text-white p-4 border-0">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div>
                                                <h3 className="fw-bold mb-1">{jobData.jobTitle}</h3>
                                                <p className="mb-0 opacity-75">at {user?.displayName || 'Your Company'}</p>
                                            </div>
                                            <span className="badge bg-white text-success px-3 py-2 rounded-pill">{jobData.employmentType}</span>
                                        </div>
                                    </div>
                                    <div className="card-body p-4">
                                        <div className="row g-4 mb-4">
                                            <div className="col-md-6">
                                                <p className="small text-uppercase text-muted fw-bold mb-1">Location</p>
                                                <p className="fw-medium mb-0"><i className="bi bi-geo-alt me-2 text-success"></i>{jobData.city}, {jobData.country}</p>
                                                <small className="text-muted">{jobData.address}</small>
                                            </div>
                                            <div className="col-md-6">
                                                <p className="small text-uppercase text-muted fw-bold mb-1">Compensation</p>
                                                <p className="fw-medium mb-0"><i className="bi bi-cash-stack me-2 text-success"></i>₹{Number(jobData.salary).toLocaleString()} / {jobData.salaryType}</p>
                                            </div>
                                        </div>
                                        
                                        <hr className="opacity-10 my-4" />
                                        
                                        <p className="small text-uppercase text-muted fw-bold mb-2">About the Role</p>
                                        <p className="text-secondary" style={{ whiteSpace: 'pre-line' }}>{jobData.description}</p>
                                        
                                        <div className="mt-4">
                                            <p className="small text-uppercase text-muted fw-bold mb-2">Skills Required</p>
                                            <div className="d-flex flex-wrap gap-2">
                                                {jobData.skillRequirements.split(',').map((skill, i) => (
                                                    <span key={i} className="badge bg-light text-dark border fw-normal px-3 py-2">{skill.trim()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="d-flex justify-content-between mt-4">
                                    <button type="button" className="btn btn-outline-secondary px-4 rounded-pill" onClick={prevStep}>Make Changes</button>
                                    <button type="button" className="btn btn-success btn-lg px-5 rounded-pill shadow-sm" onClick={handlePostJob} disabled={isSubmitting}>
                                        {isSubmitting ? <><span className="spinner-border spinner-border-sm me-2"></span>Publishing...</> : 'Publish Job Posting'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="container py-5" style={{ maxWidth: '1000px' }}>
            <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="bg-light p-4 border-bottom">
                    <StepIndicator currentStep={step} steps={steps} />
                </div>
                <div className="card-body p-5 bg-white" style={{ minHeight: '500px' }}>
                    {renderStepContent()}
                </div>
            </div>
        </div>
    );
};