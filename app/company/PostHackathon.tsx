// src/app/company/PostHackathon.tsx

"use client";
import { FC, useState, FormEvent } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/page';

// ===============================================
// 0. GLOBAL STYLES (Scoped)
// ===============================================
// In a real app, these should be in a global CSS file. 
// Including here to ensure the design works immediately.
const globalStyles = `
  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.05) !important; }
  .form-control:focus, .form-select:focus { border-color: #ffc107; box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.2); }
  .step-circle { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: bold; transition: all 0.3s ease; z-index: 2; position: relative; }
  .step-line { position: absolute; top: 20px; left: 0; width: 100%; height: 3px; background-color: #e9ecef; z-index: 1; }
  .step-progress { position: absolute; top: 20px; left: 0; height: 3px; background-color: #ffc107; z-index: 1; transition: width 0.3s ease; }
`;

interface PostHackathonProps {
    onPostSuccess: () => void;
    onPostError: (message: string) => void;
}

// ===============================================
// 1. SUB-COMPONENTS
// ===============================================

const StepIndicator: FC<{ currentStep: number, steps: string[] }> = ({ currentStep, steps }) => {
    const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

    return (
        <div className="position-relative mb-5 px-3">
            <div className="step-line"></div>
            <div className="step-progress" style={{ width: `${progressPercentage}%` }}></div>
            <div className="d-flex justify-content-between position-relative">
                {steps.map((label, index) => {
                    const stepNum = index + 1;
                    const isActive = stepNum === currentStep;
                    const isCompleted = stepNum < currentStep;

                    let circleClass = 'bg-light text-muted border';
                    if (isActive) circleClass = 'bg-warning text-dark border-warning shadow-sm scale-110';
                    if (isCompleted) circleClass = 'bg-warning text-dark border-warning';

                    return (
                        <div key={label} className="d-flex flex-column align-items-center" style={{ width: '80px' }}>
                            <div className={`step-circle ${circleClass}`}>
                                {isCompleted ? <i className="bi bi-check-lg"></i> : stepNum}
                            </div>
                            <span className={`small mt-2 fw-bold ${isActive ? 'text-dark' : 'text-muted'}`} style={{ fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                                {label.toUpperCase()}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const RichTextEditor: FC<{ value: string, onChange: (value: string) => void, placeholder?: string }> = ({ value, onChange, placeholder }) => {
    return (
        <div className="border-0 shadow-sm rounded-3 overflow-hidden bg-light">
            <div className="d-flex gap-1 p-2 border-bottom border-white bg-light bg-opacity-50">
                <button type="button" className="btn btn-sm btn-white bg-white border-0 text-secondary hover-lift"><i className="bi bi-type-bold"></i></button>
                <button type="button" className="btn btn-sm btn-white bg-white border-0 text-secondary hover-lift"><i className="bi bi-type-italic"></i></button>
                <button type="button" className="btn btn-sm btn-white bg-white border-0 text-secondary hover-lift"><i className="bi bi-list-ul"></i></button>
                <button type="button" className="btn btn-sm btn-white bg-white border-0 text-secondary hover-lift"><i className="bi bi-link-45deg"></i></button>
            </div>
            <textarea
                className="form-control border-0 bg-light p-3 shadow-none"
                rows={6}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{ resize: 'none', fontSize: '0.95rem' }}
            />
        </div>
    );
};

const StyledInput: FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input {...props} className={`form-control border-0 bg-light shadow-sm rounded-3 py-2 px-3 ${props.className || ''}`} style={{ fontSize: '0.95rem' }} />
);

const StyledLabel: FC<{ children: React.ReactNode, required?: boolean }> = ({ children, required }) => (
    <label className="form-label small fw-bold text-uppercase text-secondary mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
        {children} {required && <span className="text-danger">*</span>}
    </label>
);

// ===============================================
// 2. MAIN COMPONENT
// ===============================================

export const PostHackathon: FC<PostHackathonProps> = ({ onPostSuccess, onPostError }) => {
    const { user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    
    // Form state
    const [formData, setFormData] = useState({
        // Step 1: Basic
        title: '',
        description: '',
        prizePool: '',
        // Step 2: Logistics
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        location: '',
        maxParticipants: '',
        // Step 3: Tech
        skills: [] as string[],
        tags: [] as string[],
        // Step 4: Rules
        rules: '',
        judgingCriteria: '',
        contactEmail: '',
        website: '',
    });

    const [currentSkill, setCurrentSkill] = useState('');
    const [currentTag, setCurrentTag] = useState('');

    // --- Handlers ---

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Skills & Tags Logic
    const addToArray = (key: 'skills' | 'tags', value: string, setter: (v: string) => void) => {
        if (value.trim() && !formData[key].includes(value.trim())) {
            setFormData(prev => ({ ...prev, [key]: [...prev[key], value.trim()] }));
            setter('');
        }
    };
    const removeFromArray = (key: 'skills' | 'tags', valueToRemove: string) => {
        setFormData(prev => ({ ...prev, [key]: prev[key].filter(item => item !== valueToRemove) }));
    };

    // Navigation
    const validateStep = (step: number): boolean => {
        switch (step) {
            case 1:
                if (!formData.title.trim() || !formData.description.trim() || !formData.prizePool.trim()) {
                    onPostError('Please fill in Title, Description, and Prize Pool.');
                    return false;
                }
                return true;
            case 2:
                if (!formData.startDate || !formData.endDate || !formData.registrationDeadline || !formData.location.trim()) {
                    onPostError('Please fill in all Dates and Location.');
                    return false;
                }
                if (new Date(formData.startDate) >= new Date(formData.endDate)) {
                    onPostError('End date must be after start date.');
                    return false;
                }
                return true;
            case 4:
                if (!formData.contactEmail.trim() || !/\S+@\S+\.\S+/.test(formData.contactEmail)) {
                    onPostError('Please enter a valid contact email.');
                    return false;
                }
                return true;
            default: return true;
        }
    };

    const nextStep = () => {
        if (validateStep(currentStep)) setCurrentStep(prev => prev + 1);
    };
    const prevStep = () => setCurrentStep(prev => prev - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return onPostError('Authentication required.');
        if (!validateStep(4)) return;

        setIsSubmitting(true);
        try {
            const hackathonData = {
                ...formData,
                companyId: user.uid,
                companyName: user.displayName || 'Unknown Company',
                createdAt: serverTimestamp(),
                status: 'active',
                isVirtual: formData.location.toLowerCase() === 'virtual',
                participants: [],
            };

            await addDoc(collection(db, 'hackathons'), hackathonData);
            onPostSuccess();
        } catch (error: any) {
            console.error('Error:', error);
            onPostError(error.message || 'Failed to post hackathon.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Render Steps ---

    const steps = ['Basics', 'Logistics', 'Tech', 'Finalize'];

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <div className="animate-fade-in">
                        <div className="text-center mb-4">
                            <h4 className="fw-bold text-dark">Hackathon Essentials</h4>
                            <p className="text-muted small">What are you building? Define the core challenge.</p>
                        </div>
                        
                        <div className="mb-3">
                            <StyledLabel required>Hackathon Title</StyledLabel>
                            <StyledInput name="title" value={formData.title} onChange={handleInputChange} placeholder="e.g. Global AI Innovation Challenge 2024" autoFocus />
                        </div>

                        <div className="mb-3">
                            <StyledLabel required>Description</StyledLabel>
                            <RichTextEditor value={formData.description} onChange={(val) => setFormData(prev => ({...prev, description: val}))} placeholder="Describe the theme, goals, and what participants will build..." />
                        </div>

                        <div className="mb-3">
                            <StyledLabel required>Prize Pool</StyledLabel>
                            <div className="input-group">
                                <span className="input-group-text border-0 bg-light text-muted"><i className="bi bi-trophy"></i></span>
                                <StyledInput name="prizePool" value={formData.prizePool} onChange={handleInputChange} placeholder="$50,000 in prizes + swag" className="rounded-start-0" />
                            </div>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="animate-fade-in">
                        <div className="text-center mb-4">
                            <h4 className="fw-bold text-dark">Time & Place</h4>
                            <p className="text-muted small">When and where is the magic happening?</p>
                        </div>

                        <div className="row g-3 mb-3">
                            <div className="col-md-6">
                                <StyledLabel required>Start Date</StyledLabel>
                                <StyledInput type="datetime-local" name="startDate" value={formData.startDate} onChange={handleInputChange} />
                            </div>
                            <div className="col-md-6">
                                <StyledLabel required>End Date</StyledLabel>
                                <StyledInput type="datetime-local" name="endDate" value={formData.endDate} onChange={handleInputChange} />
                            </div>
                        </div>

                        <div className="mb-3">
                            <StyledLabel required>Registration Deadline</StyledLabel>
                            <StyledInput type="datetime-local" name="registrationDeadline" value={formData.registrationDeadline} onChange={handleInputChange} />
                        </div>

                        <div className="row g-3">
                            <div className="col-md-8">
                                <StyledLabel required>Location</StyledLabel>
                                <StyledInput name="location" value={formData.location} onChange={handleInputChange} placeholder="Enter 'Virtual' or physical address" />
                            </div>
                            <div className="col-md-4">
                                <StyledLabel>Max Participants</StyledLabel>
                                <StyledInput type="number" name="maxParticipants" value={formData.maxParticipants} onChange={handleInputChange} placeholder="Unlimited" />
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="animate-fade-in">
                        <div className="text-center mb-4">
                            <h4 className="fw-bold text-dark">Technical Requirements</h4>
                            <p className="text-muted small">Who should apply? Define the stack.</p>
                        </div>

                        <div className="mb-4">
                            <StyledLabel>Required Skills</StyledLabel>
                            <div className="input-group mb-2 shadow-sm rounded-3 overflow-hidden">
                                <input 
                                    type="text" 
                                    className="form-control border-0 bg-light px-3" 
                                    value={currentSkill} 
                                    onChange={(e) => setCurrentSkill(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('skills', currentSkill, setCurrentSkill))}
                                    placeholder="Add skill (e.g. Python)"
                                />
                                <button className="btn btn-warning text-dark fw-bold px-3" onClick={() => addToArray('skills', currentSkill, setCurrentSkill)}>Add</button>
                            </div>
                            <div className="d-flex flex-wrap gap-2">
                                {formData.skills.map(skill => (
                                    <span key={skill} className="badge bg-warning bg-opacity-25 text-dark border border-warning border-opacity-25 px-3 py-2 rounded-pill fw-normal d-flex align-items-center gap-2">
                                        {skill} <i className="bi bi-x-circle-fill opacity-50 hover-opacity-100 cursor-pointer" onClick={() => removeFromArray('skills', skill)}></i>
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="mb-3">
                            <StyledLabel>Tags & Categories</StyledLabel>
                            <div className="input-group mb-2 shadow-sm rounded-3 overflow-hidden">
                                <input 
                                    type="text" 
                                    className="form-control border-0 bg-light px-3" 
                                    value={currentTag} 
                                    onChange={(e) => setCurrentTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('tags', currentTag, setCurrentTag))}
                                    placeholder="Add tag (e.g. AI, Fintech)"
                                />
                                <button className="btn btn-secondary px-3" onClick={() => addToArray('tags', currentTag, setCurrentTag)}>Add</button>
                            </div>
                            <div className="d-flex flex-wrap gap-2">
                                {formData.tags.map(tag => (
                                    <span key={tag} className="badge bg-light text-secondary border px-3 py-2 rounded-pill fw-normal d-flex align-items-center gap-2">
                                        #{tag} <i className="bi bi-x cursor-pointer" onClick={() => removeFromArray('tags', tag)}></i>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="animate-fade-in">
                        <div className="text-center mb-4">
                            <h4 className="fw-bold text-dark">Final Details</h4>
                            <p className="text-muted small">Set the rules and publish your event.</p>
                        </div>

                        <div className="mb-3">
                            <StyledLabel>Rules & Guidelines</StyledLabel>
                            <RichTextEditor value={formData.rules} onChange={(val) => setFormData(prev => ({...prev, rules: val}))} placeholder="Code of conduct, submission rules..." />
                        </div>

                        <div className="mb-3">
                            <StyledLabel>Judging Criteria</StyledLabel>
                            <textarea className="form-control border-0 bg-light shadow-sm rounded-3 p-3" rows={3} name="judgingCriteria" value={formData.judgingCriteria} onChange={handleInputChange} placeholder="Innovation, Technical Difficulty, Design..." style={{resize:'none', fontSize: '0.95rem'}} />
                        </div>

                        <div className="row g-3">
                            <div className="col-md-6">
                                <StyledLabel required>Contact Email</StyledLabel>
                                <StyledInput type="email" name="contactEmail" value={formData.contactEmail} onChange={handleInputChange} placeholder="hackathon@company.com" />
                            </div>
                            <div className="col-md-6">
                                <StyledLabel>Website URL</StyledLabel>
                                <StyledInput type="url" name="website" value={formData.website} onChange={handleInputChange} placeholder="https://" />
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="container py-5" style={{ maxWidth: '800px' }}>
            <style>{globalStyles}</style>
            
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                {/* Header Pattern */}
                <div className="bg-warning bg-gradient bg-opacity-10 p-4 border-bottom border-warning border-opacity-10">
                    <div className="d-flex align-items-center gap-3">
                        <div className="bg-white p-3 rounded-circle shadow-sm text-warning">
                            <i className="bi bi-trophy-fill fs-3"></i>
                        </div>
                        <div>
                            <h4 className="fw-bold text-dark mb-0">Create Hackathon</h4>
                            <p className="text-muted small mb-0">Host a challenge for the world's best developers.</p>
                        </div>
                    </div>
                </div>

                <div className="card-body p-4 p-md-5">
                    <StepIndicator currentStep={currentStep} steps={steps} />
                    
                    <div className="py-3">
                        {renderStepContent()}
                    </div>

                    {/* Navigation Footer */}
                    <div className="d-flex justify-content-between align-items-center mt-5 pt-4 border-top border-light">
                        {currentStep > 1 ? (
                            <button type="button" className="btn btn-light rounded-pill px-4 fw-medium text-muted hover-lift" onClick={prevStep}>
                                <i className="bi bi-arrow-left me-2"></i> Back
                            </button>
                        ) : (
                            <div></div> 
                        )}
                        
                        {currentStep < steps.length ? (
                            <button type="button" className="btn btn-dark rounded-pill px-5 py-2 fw-bold shadow-sm hover-lift" onClick={nextStep}>
                                Next Step <i className="bi bi-arrow-right ms-2"></i>
                            </button>
                        ) : (
                            <button type="button" className="btn btn-warning rounded-pill px-5 py-2 fw-bold shadow-sm hover-lift text-dark" onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <><span className="spinner-border spinner-border-sm me-2"></span>Publishing...</>
                                ) : (
                                    <><i className="bi bi-rocket-takeoff-fill me-2"></i> Publish Event</>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};