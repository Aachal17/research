// src/app/components/JobSearch.tsx

"use client";
import { FC, useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, orderBy, where, getDocs, deleteDoc, doc, setDoc, addDoc } from 'firebase/firestore'; 
import { useAuth } from '@/app/page';
import { db } from '@/app/lib/firebase';

interface JobPost {
    id: string;
    jobTitle: string;
    companyName: string;
    employmentType: string;
    salary: number | string;
    salaryType: string;
    city: string;
    description: string;
    tags: string | string[];
    companyId: string;
    isSaved: boolean; 
    isApplied: boolean;
}

// --- Job Card Component (Reusable) ---
interface JobCardProps {
    job: JobPost;
    onSave: (job: JobPost, isSaved: boolean) => void;
    onApply: (job: JobPost) => void;
}

const JobCard: FC<JobCardProps> = ({ job, onSave, onApply }) => {
    // Safely handle tags
    const tagsArray = typeof job.tags === 'string' 
        ? job.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : Array.isArray(job.tags) ? job.tags : [];

    return (
        <div className="card border-0 shadow-sm mb-3 rounded-4 hover-shadow transition overflow-hidden bg-white">
            <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex gap-3">
                        <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-primary" 
                             style={{width: '48px', height: '48px', fontSize: '1.2rem'}}>
                            {job.companyName.charAt(0)}
                        </div>
                        <div>
                            <h5 className="fw-bold text-dark mb-1">{job.jobTitle}</h5>
                            <p className="text-secondary mb-0 small fw-medium">
                                {job.companyName} <span className="text-muted fw-normal">• {job.city}</span>
                            </p>
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <button 
                            className={`btn btn-sm rounded-circle ${job.isSaved ? 'btn-light text-warning' : 'btn-light text-secondary'}`} 
                            onClick={() => onSave(job, !job.isSaved)}
                            title={job.isSaved ? "Unsave" : "Save Job"}
                            style={{width: '36px', height: '36px'}}
                        >
                            <i className={`bi ${job.isSaved ? 'bi-bookmark-fill' : 'bi-bookmark'}`}></i> 
                        </button>
                    </div>
                </div>
                
                <div className="mb-3">
                    <div className="d-flex flex-wrap gap-2 mb-3">
                        <span className="badge bg-light text-dark border fw-normal px-3 py-2">
                            <i className="bi bi-briefcase me-1 text-muted"></i> {job.employmentType}
                        </span>
                        <span className="badge bg-light text-success border border-success border-opacity-25 fw-normal px-3 py-2">
                            <i className="bi bi-cash me-1"></i> ₹{job.salary.toLocaleString()} / {job.salaryType}
                        </span>
                    </div>
                    
                    <p className="text-secondary small mb-0 line-clamp-2" style={{lineHeight: '1.6'}}>
                        {job.description}
                    </p>
                </div>

                <div className="d-flex justify-content-between align-items-center pt-3 border-top border-light">
                    <div className="d-flex gap-1 overflow-hidden">
                        {tagsArray.slice(0, 3).map((tag, index) => (
                            <span key={index} className="badge bg-secondary bg-opacity-10 text-secondary border-0 fw-normal">
                                {tag}
                            </span>
                        ))}
                        {tagsArray.length > 3 && (
                            <span className="badge bg-secondary bg-opacity-10 text-secondary border-0 fw-normal">
                                +{tagsArray.length - 3}
                            </span>
                        )}
                    </div>
                    
                    <button 
                        className={`btn btn-sm px-4 rounded-pill fw-medium shadow-sm ${job.isApplied ? 'btn-success' : 'btn-primary'}`} 
                        onClick={() => onApply(job)}
                        disabled={job.isApplied}
                    >
                        {job.isApplied ? (
                            <><i className="bi bi-check-circle me-2"></i>Applied</>
                        ) : (
                            'Apply Now'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main JobSearch Component ---
export const JobSearch: FC = () => {
    const { user, setError, clearError } = useAuth();
    const [jobs, setJobs] = useState<JobPost[]>([]);
    const [filteredJobs, setFilteredJobs] = useState<JobPost[]>([]);
    const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
    const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set()); 
    const [loading, setLoading] = useState(true);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
    const [salaryTypeFilter, setSalaryTypeFilter] = useState('');

    // --- Fetch Job Postings and Status ---
    const fetchJobs = useCallback(() => {
        setLoading(true);
        clearError();
        if (!user) {
            setLoading(false);
            return;
        }

        const jobsCollectionRef = collection(db, 'jobPostings');
        const savedJobsCollectionRef = collection(db, 'userSavedJobs');
        const applicationsCollectionRef = collection(db, 'jobApplications');

        const unsubscribeJobs = onSnapshot(
            query(jobsCollectionRef, orderBy('createdAt', 'desc')), 
            async (jobSnapshot) => {
                try {
                    // 1. Get Saved Status
                    const savedQuery = query(savedJobsCollectionRef, where('userId', '==', user.uid));
                    const savedSnapshot = await getDocs(savedQuery);
                    const currentSavedIds = new Set(savedSnapshot.docs.map(doc => doc.data().jobId));
                    setSavedJobIds(currentSavedIds);

                    // 2. Get Applied Status
                    const appliedQuery = query(applicationsCollectionRef, where('userId', '==', user.uid));
                    const appliedSnapshot = await getDocs(appliedQuery);
                    const currentAppliedIds = new Set(appliedSnapshot.docs.map(doc => doc.data().jobId));
                    setAppliedJobIds(currentAppliedIds);

                    // 3. Map job postings
                    const fetchedJobs: JobPost[] = jobSnapshot.docs.map(d => {
                        const data = d.data();
                        const jobId = d.id;
                        
                        let tags: string | string[] = data.tags || '';
                        if (Array.isArray(tags)) tags = tags.join(', ');

                        return {
                            id: jobId,
                            jobTitle: data.jobTitle || '',
                            companyName: data.companyName || '',
                            employmentType: data.employmentType || '',
                            salary: data.salary || '',
                            salaryType: data.salaryType || '',
                            city: data.city || '',
                            description: data.description || '',
                            tags: tags,
                            companyId: data.companyId || '',
                            isSaved: currentSavedIds.has(jobId), 
                            isApplied: currentAppliedIds.has(jobId),
                        };
                    });
                    
                    setJobs(fetchedJobs);
                    setFilteredJobs(fetchedJobs);
                    setLoading(false);
                } catch (error) {
                    console.error("Error processing jobs:", error);
                    setError("Failed to process job data");
                    setLoading(false);
                }
            }, 
            (error) => {
                console.error("Firestore fetch error:", error);
                setError("Failed to load jobs: " + (error as any).message);
                setLoading(false);
            }
        );

        return () => unsubscribeJobs();
    }, [user, setError, clearError]);

    useEffect(() => {
        const unsubscribe = fetchJobs();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [fetchJobs]);

    // --- Filter Jobs ---
    useEffect(() => {
        let result = jobs;

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(job => 
                job.jobTitle.toLowerCase().includes(query) ||
                job.companyName.toLowerCase().includes(query) ||
                job.description.toLowerCase().includes(query) ||
                (typeof job.tags === 'string' && job.tags.toLowerCase().includes(query))
            );
        }

        if (locationFilter) {
            result = result.filter(job => 
                job.city.toLowerCase().includes(locationFilter.toLowerCase())
            );
        }

        if (employmentTypeFilter) {
            result = result.filter(job => 
                job.employmentType === employmentTypeFilter
            );
        }

        if (salaryTypeFilter) {
            result = result.filter(job => 
                job.salaryType === salaryTypeFilter
            );
        }

        setFilteredJobs(result);
    }, [jobs, searchQuery, locationFilter, employmentTypeFilter, salaryTypeFilter]);

    // --- Action Handlers ---
    const handleSave = async (job: JobPost, isSaved: boolean) => {
        if (!user) {
            setError("Please log in to save jobs.", true);
            return;
        }
        clearError();
        const savedJobId = job.id;

        try {
            if (isSaved) {
                await setDoc(doc(db, 'userSavedJobs', `${user.uid}_${savedJobId}`), {
                    userId: user.uid,
                    jobId: savedJobId,
                    jobTitle: job.jobTitle,
                    companyName: job.companyName,
                    city: job.city,
                    salary: job.salary,
                    savedAt: new Date(),
                });
                setSavedJobIds(prev => new Set(prev).add(savedJobId));
            } else {
                await deleteDoc(doc(db, 'userSavedJobs', `${user.uid}_${savedJobId}`));
                setSavedJobIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(savedJobId);
                    return newSet;
                });
            }
        } catch (e) {
            console.error("Save/Unsave error:", e);
            setError(`Failed to ${isSaved ? 'save' : 'remove'} job.`, true);
        }
    };

    const handleApply = async (job: JobPost) => {
        if (!user) {
            setError("You must be logged in to apply.", true);
            return;
        }

        try {
            clearError();
            await addDoc(collection(db, "jobApplications"), {
                userId: user.uid,
                jobId: job.id,
                jobTitle: job.jobTitle,
                companyName: job.companyName,
                companyId: job.companyId, 
                appliedAt: new Date(),
                status: 'Submitted',
            });
            
            setAppliedJobIds(prev => new Set(prev).add(job.id));
            setError(`Application submitted for ${job.jobTitle}!`, false); 

        } catch (error) {
            console.error("Application error:", error);
            setError("Failed to submit application. Please try again.", true);
        }
    };

    const clearFilters = () => {
        setSearchQuery('');
        setLocationFilter('');
        setEmploymentTypeFilter('');
        setSalaryTypeFilter('');
    };

    const uniqueCities = [...new Set(jobs.map(job => job.city).filter(Boolean))];
    const uniqueEmploymentTypes = [...new Set(jobs.map(job => job.employmentType).filter(Boolean))];
    const uniqueSalaryTypes = [...new Set(jobs.map(job => job.salaryType).filter(Boolean))];

    if (loading) return <div className="text-center py-5 text-muted"><div className="spinner-border text-primary me-2" role="status"></div> Loading listings...</div>;

    return (
        <div className="row g-4">
            {/* --- Sidebar Filters --- */}
            <div className="col-lg-3">
                <div className="sticky-top" style={{ top: '20px', zIndex: 1 }}>
                    <div className="card border-0 shadow-sm rounded-4 bg-white">
                        <div className="card-body p-4">
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h6 className="fw-bold mb-0 text-dark">Filters</h6>
                                <button 
                                    onClick={clearFilters}
                                    className="btn btn-sm btn-link text-decoration-none p-0 text-muted"
                                    style={{fontSize: '0.85rem'}}
                                >
                                    Reset
                                </button>
                            </div>
                            
                            <div className="mb-4">
                                <label className="form-label small text-muted fw-bold text-uppercase">Search</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-0"><i className="bi bi-search text-muted"></i></span>
                                    <input 
                                        type="text" 
                                        className="form-control bg-light border-0" 
                                        placeholder="Keywords..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label small text-muted fw-bold text-uppercase">Location</label>
                                <select 
                                    className="form-select bg-light border-0 text-secondary" 
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                >
                                    <option value="">Any Location</option>
                                    {uniqueCities.map(city => <option key={city} value={city}>{city}</option>)}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="form-label small text-muted fw-bold text-uppercase">Job Type</label>
                                <select 
                                    className="form-select bg-light border-0 text-secondary" 
                                    value={employmentTypeFilter}
                                    onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                                >
                                    <option value="">Any Type</option>
                                    {uniqueEmploymentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                            </div>

                            <div className="mb-2">
                                <label className="form-label small text-muted fw-bold text-uppercase">Salary Period</label>
                                <select 
                                    className="form-select bg-light border-0 text-secondary" 
                                    value={salaryTypeFilter}
                                    onChange={(e) => setSalaryTypeFilter(e.target.value)}
                                >
                                    <option value="">Any Period</option>
                                    {uniqueSalaryTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Job Listings --- */}
            <div className="col-lg-9">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h5 className="fw-bold text-dark mb-0">
                        {filteredJobs.length} <span className="text-muted fw-normal">Jobs Found</span>
                    </h5>
                    <div className="small text-muted">
                        Sorted by <span className="fw-bold text-dark">Newest</span>
                    </div>
                </div>
                
                {filteredJobs.length === 0 ? (
                    <div className="text-center py-5 bg-white rounded-4 shadow-sm border border-light">
                        <div className="mb-3 text-muted opacity-25">
                            <i className="bi bi-search display-1"></i>
                        </div>
                        <h5 className="fw-bold text-dark">No jobs found</h5>
                        <p className="text-muted mb-4">We couldn't find any jobs matching your filters.</p>
                        <button onClick={clearFilters} className="btn btn-outline-primary rounded-pill px-4">
                            Clear All Filters
                        </button>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {filteredJobs.map(job => (
                            <JobCard 
                                key={job.id} 
                                job={{ 
                                    ...job, 
                                    isApplied: appliedJobIds.has(job.id), 
                                    isSaved: savedJobIds.has(job.id) 
                                }} 
                                onSave={handleSave} 
                                onApply={handleApply}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default JobSearch;