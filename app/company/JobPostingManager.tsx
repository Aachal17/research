"use client";
import { FC, useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore'; 
import { useAuth } from '@/app/page';
import { db } from '@/app/lib/firebase';

interface JobData {
    id: string;
    jobTitle: string;
    employmentType: string;
    salary: number | string;
    salaryType: string;
    city: string;
    createdAt: { seconds: number; nanoseconds: number } | Date;
}

export const JobPostingManager: FC = () => {
    const { user, setError, clearError } = useAuth();
    const [jobs, setJobs] = useState<JobData[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Edit State
    const [isEditingId, setIsEditingId] = useState<string | null>(null);
    const [editFormData, setEditFormData] = useState<Partial<JobData>>({});

    const companyId = user?.uid;

    // Constants for dropdowns
    const employmentTypes = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Freelance'];
    const salaryTypes = ['Yearly', 'Monthly', 'Hourly'];

    const fetchJobs = useCallback(() => {
        if (!companyId) return;

        setLoading(true);
        clearError();

        try {
            const jobsCollection = collection(db, 'jobPostings');
            const q = query(jobsCollection, where('companyId', '==', companyId));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedJobs: JobData[] = snapshot.docs.map(d => ({
                    id: d.id,
                    ...d.data() as Omit<JobData, 'id'>
                }));
                
                fetchedJobs.sort((a, b) => {
                    const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt.seconds;
                    const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt.seconds;
                    return dateB - dateA;
                });
                
                setJobs(fetchedJobs);
                setLoading(false);
            }, (error) => {
                console.error("Firestore fetch error:", error);
                setError("Failed to load job postings: " + (error as any).message);
                setLoading(false);
            });

            return unsubscribe;
        } catch (e) {
            console.error("Setup error:", e);
            setError("Error setting up job listener.");
            setLoading(false);
        }
    }, [companyId, setError, clearError]);

    useEffect(() => {
        const unsubscribe = fetchJobs();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [fetchJobs]);
    
    const handleDelete = async (jobId: string) => {
        if (!confirm("Are you sure you want to delete this job posting?")) return;
        clearError();
        try {
            const jobRef = doc(db, 'jobPostings', jobId);
            await deleteDoc(jobRef);
            setError("Job posting deleted successfully.", false);
        } catch (e) {
            console.error("Delete error:", e);
            setError("Failed to delete job posting.");
        }
    };
    
    const handleStartEdit = (job: JobData) => {
        setIsEditingId(job.id);
        setEditFormData({
            jobTitle: job.jobTitle,
            employmentType: job.employmentType,
            city: job.city,
            salary: job.salary,
            salaryType: job.salaryType
        });
    };

    const handleCancelEdit = () => {
        setIsEditingId(null);
        setEditFormData({});
    };

    const handleInputChange = (field: keyof JobData, value: any) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleUpdate = async () => {
        if (!isEditingId) return;

        // Basic Validation
        if (!editFormData.jobTitle?.trim() || !editFormData.city?.trim() || !editFormData.salary) {
            setError("Please fill in all required fields.");
            return;
        }

        clearError();
        try {
            const jobRef = doc(db, 'jobPostings', isEditingId);
            
            // Create update object with only the fields we allow editing
            const updateData = {
                jobTitle: editFormData.jobTitle,
                employmentType: editFormData.employmentType,
                city: editFormData.city,
                salary: Number(editFormData.salary), // Ensure number
                salaryType: editFormData.salaryType
            };

            await updateDoc(jobRef, updateData);
            setError("Job listing updated successfully.", false);
            setIsEditingId(null);
            setEditFormData({});
        } catch (e) {
            console.error("Update error:", e);
            setError("Failed to update job listing.");
        }
    };

    const formatDate = (dateValue: JobData['createdAt']) => {
        if (dateValue instanceof Date) return dateValue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        if (typeof dateValue === 'object' && dateValue.seconds) return new Date(dateValue.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return 'N/A';
    };

    if (!user) return <div className="text-center py-5 text-danger fw-bold">Authentication required.</div>;

    if (loading) {
        return (
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="card-body p-0">
                    <div className="p-4 border-bottom"><div className="bg-light rounded col-3" style={{height: '24px'}}></div></div>
                    <div className="p-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="d-flex gap-4 mb-4 align-items-center">
                                <div className="bg-light rounded col-4" style={{height: '16px'}}></div>
                                <div className="bg-light rounded col-2" style={{height: '16px'}}></div>
                                <div className="bg-light rounded col-2" style={{height: '16px'}}></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (jobs.length === 0) {
        return (
            <div className="card border-0 shadow-sm rounded-4 p-5 text-center bg-white">
                <div className="mb-3 text-primary opacity-25"><i className="bi bi-briefcase fs-1"></i></div>
                <h4 className="fw-bold text-dark">No Active Job Postings</h4>
                <p className="text-muted mb-4">You haven't posted any jobs yet. Create your first listing to start hiring.</p>
                <button className="btn btn-primary rounded-pill px-4 fw-medium">
                    <i className="bi bi-plus-lg me-2"></i>Post a Job
                </button>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
            <div className="card-header bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold text-dark">Active Listings <span className="badge bg-light text-primary ms-2 rounded-pill">{jobs.length}</span></h5>
            </div>
            <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th className="px-4 py-3 text-secondary small fw-bold text-uppercase" style={{width: '25%'}}>Job Title</th>
                            <th className="py-3 text-secondary small fw-bold text-uppercase" style={{width: '15%'}}>Type</th>
                            <th className="py-3 text-secondary small fw-bold text-uppercase" style={{width: '15%'}}>Location</th>
                            <th className="py-3 text-secondary small fw-bold text-uppercase" style={{width: '20%'}}>Salary</th>
                            <th className="py-3 text-secondary small fw-bold text-uppercase" style={{width: '10%'}}>Posted</th>
                            <th className="text-end px-4 py-3 text-secondary small fw-bold text-uppercase" style={{width: '15%'}}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobs.map(job => {
                            const isEditing = isEditingId === job.id;
                            return (
                                <tr key={job.id}>
                                    {/* Job Title */}
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={editFormData.jobTitle}
                                                onChange={(e) => handleInputChange('jobTitle', e.target.value)}
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="fw-bold text-dark">{job.jobTitle}</span>
                                        )}
                                    </td>

                                    {/* Employment Type */}
                                    <td>
                                        {isEditing ? (
                                            <select 
                                                className="form-select form-select-sm"
                                                value={editFormData.employmentType}
                                                onChange={(e) => handleInputChange('employmentType', e.target.value)}
                                            >
                                                {employmentTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                            </select>
                                        ) : (
                                            <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 fw-normal px-2 py-1">
                                                {job.employmentType}
                                            </span>
                                        )}
                                    </td>

                                    {/* Location */}
                                    <td>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={editFormData.city}
                                                onChange={(e) => handleInputChange('city', e.target.value)}
                                            />
                                        ) : (
                                            <span className="text-secondary small"><i className="bi bi-geo-alt me-1"></i>{job.city}</span>
                                        )}
                                    </td>

                                    {/* Salary */}
                                    <td>
                                        {isEditing ? (
                                            <div className="input-group input-group-sm">
                                                <span className="input-group-text">₹</span>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={editFormData.salary}
                                                    onChange={(e) => handleInputChange('salary', e.target.value)}
                                                    style={{maxWidth: '80px'}}
                                                />
                                                <select 
                                                    className="form-select"
                                                    value={editFormData.salaryType}
                                                    onChange={(e) => handleInputChange('salaryType', e.target.value)}
                                                >
                                                    {salaryTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                            </div>
                                        ) : (
                                            <span className="text-dark fw-medium small">
                                                ₹{job.salary.toLocaleString()} <span className="text-muted fw-normal">/{job.salaryType}</span>
                                            </span>
                                        )}
                                    </td>

                                    {/* Posted Date (Read Only) */}
                                    <td className="text-muted small">{formatDate(job.createdAt)}</td>

                                    {/* Actions */}
                                    <td className="text-end px-4">
                                        {isEditing ? (
                                            <div className="btn-group">
                                                <button 
                                                    className="btn btn-sm btn-success" 
                                                    onClick={handleUpdate} 
                                                    title="Save Changes"
                                                >
                                                    <i className="bi bi-check-lg"></i>
                                                </button>
                                                <button 
                                                    className="btn btn-sm btn-outline-secondary" 
                                                    onClick={handleCancelEdit}
                                                    title="Cancel"
                                                >
                                                    <i className="bi bi-x-lg"></i>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="btn-group">
                                                <button 
                                                    className="btn btn-light btn-sm text-secondary hover-primary rounded-start" 
                                                    onClick={() => handleStartEdit(job)}
                                                    title="Edit Job"
                                                >
                                                    <i className="bi bi-pencil-square"></i>
                                                </button>
                                                <button 
                                                    className="btn btn-light btn-sm text-danger hover-danger rounded-end" 
                                                    onClick={() => handleDelete(job.id)}
                                                    title="Delete Job"
                                                >
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};