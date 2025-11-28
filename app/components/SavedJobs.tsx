// src/app/components/SavedJobs.tsx

"use client";
import { FC, useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore'; 
import { useAuth } from '@/app/page';
import { db } from '@/app/lib/firebase';

interface SavedJobDisplay {
    id: string; // ID of the savedJobs document
    jobId: string; // ID of the actual job posting
    jobTitle: string;
    companyName: string;
    city: string;
    salary: number | string;
}

export const SavedJobs: FC = () => {
    const { user, setError, clearError } = useAuth();
    const [savedJobs, setSavedJobs] = useState<SavedJobDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Store verified status mapping: CompanyName -> isVerified
    const [verifiedCompanies, setVerifiedCompanies] = useState<Record<string, boolean>>({});

    // 1. Fetch Verified Companies Real-time
    useEffect(() => {
        const q = query(collection(db, 'companies'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const verifiedMap: Record<string, boolean> = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                // Map by company Name since saved jobs might not always store companyId depending on legacy data
                if (data.companyName) {
                    verifiedMap[data.companyName] = data.isVerified || false;
                }
            });
            setVerifiedCompanies(verifiedMap);
        });
        return () => unsubscribe();
    }, []);

    // 2. Fetch User's Saved Jobs
    const fetchSavedJobs = useCallback(() => {
        if (!user) return;
        setLoading(true);
        clearError();

        const savedJobsRef = collection(db, 'userSavedJobs');
        const q = query(savedJobsRef, where('userId', '==', user.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobs: SavedJobDisplay[] = snapshot.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    jobId: data.jobId,
                    jobTitle: data.jobTitle || "Job Title Missing",
                    companyName: data.companyName || "N/A",
                    city: data.city || "N/A",
                    salary: data.salary || "N/A",
                };
            });
            setSavedJobs(jobs);
            setLoading(false);
        }, (error) => {
            setError("Failed to load saved jobs: " + error.message, true);
            setLoading(false);
        });

        return unsubscribe;
    }, [user, setError, clearError]);

    useEffect(() => {
        const unsubscribe = fetchSavedJobs();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [fetchSavedJobs]);

    // Remove Job Handler
    const handleRemoveJob = async (savedJobDocId: string) => {
        if (!user || !confirm("Are you sure you want to remove this job from your saved list?")) return;
        
        clearError();
        try {
            const docRef = doc(db, 'userSavedJobs', savedJobDocId);
            await deleteDoc(docRef);
            setError("Job successfully removed from saved list.", false);
        } catch (e: any) {
            setError("Failed to remove job. Please try again.", true);
        }
    };

    if (!user) return <p className="text-center py-5 text-danger">Please log in to view your saved jobs.</p>;
    if (loading) return <div className="text-center py-5"><i className="bi bi-arrow-clockwise animate-spin me-2"></i> Loading saved jobs...</div>;

    return (
        <div className="card shadow-lg p-4 border-0 rounded-4">
            <h4 className="text-dark fw-bold mb-4">Your Saved Jobs ({savedJobs.length})</h4>
            
            {savedJobs.length === 0 ? (
                <div className="alert alert-light text-center border">
                    <i className="bi bi-bookmark-x text-muted fs-1 d-block mb-2"></i>
                    You haven't saved any jobs yet. Start browsing in the Job Search section!
                </div>
            ) : (
                <div className="list-group list-group-flush">
                    {savedJobs.map(job => (
                        <div key={job.id} className="list-group-item d-flex justify-content-between align-items-center py-3 px-0 border-bottom">
                            <div>
                                <h6 className="mb-1 fw-bold text-dark">{job.jobTitle}</h6>
                                <div className="d-flex align-items-center text-muted small">
                                    <span className="fw-medium text-primary">
                                        {job.companyName}
                                    </span>
                                    {/* Verification Badge */}
                                    {verifiedCompanies[job.companyName] && (
                                        <i className="bi bi-patch-check-fill text-primary ms-1" title="Verified Company"></i>
                                    )}
                                    <span className="mx-2">&middot;</span>
                                    <span>{job.city}</span>
                                    <span className="mx-2">&middot;</span>
                                    <span className="text-success fw-medium">₹{job.salary}</span>
                                </div>
                            </div>
                            <button 
                                className="btn btn-sm btn-outline-danger rounded-pill px-3"
                                onClick={() => handleRemoveJob(job.id)}
                                title="Remove from saved"
                            >
                                <i className="bi bi-trash"></i> Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SavedJobs;