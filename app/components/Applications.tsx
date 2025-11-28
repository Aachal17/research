// src/app/components/Applications.tsx

"use client";
import { FC, useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'; 
import { useAuth } from '@/app/page'; // To get the user and db instances
import { db } from '@/app/lib/firebase';

interface ApplicationData {
    id: string;
    jobTitle: string;
    companyName: string;
    status: string;
    appliedAt: Date | { seconds: number; nanoseconds: number };
    jobId: string;
}

export const Applications: FC = () => {
    const { user, setError, clearError } = useAuth();
    const [applications, setApplications] = useState<ApplicationData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState<ApplicationData | null>(null);
    
    // Store verified status mapping: CompanyName -> isVerified
    const [verifiedCompanies, setVerifiedCompanies] = useState<Record<string, boolean>>({});

    // 1. Fetch Verified Companies Real-time
    useEffect(() => {
        const q = query(collection(db, 'companies'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const verifiedMap: Record<string, boolean> = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.companyName) {
                    verifiedMap[data.companyName] = data.isVerified || false;
                }
            });
            setVerifiedCompanies(verifiedMap);
        });
        return () => unsubscribe();
    }, []);

    const getStatusClass = (status: string) => {
        if (status.includes('Interview')) return 'bg-warning text-dark';
        if (status.includes('Reviewed')) return 'bg-info text-white';
        if (status.includes('Submitted')) return 'bg-primary text-white';
        if (status.includes('Hired')) return 'bg-success text-white';
        if (status.includes('Rejected')) return 'bg-danger text-white';
        return 'bg-secondary text-white';
    };

    const formatDate = (dateValue: ApplicationData['appliedAt']) => {
        if (dateValue instanceof Date) {
            return dateValue.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        if (typeof dateValue === 'object' && dateValue.seconds) {
            return new Date(dateValue.seconds * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return 'N/A';
    };
    
    // --- Data Fetching Logic ---
    const fetchApplications = useCallback(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        setLoading(true);
        clearError();

        try {
            const applicationsRef = collection(db, 'jobApplications');
            const q = query(
                applicationsRef, 
                where('userId', '==', user.uid),
                orderBy('appliedAt', 'desc') 
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedApps: ApplicationData[] = snapshot.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        jobTitle: data.jobTitle || 'Untitled',
                        companyName: data.companyName || 'Unknown Company',
                        status: data.status || 'Submitted',
                        appliedAt: data.appliedAt ? data.appliedAt.toDate() : new Date(),
                        jobId: data.jobId || '',
                    } as ApplicationData;
                });
                setApplications(fetchedApps);
                setLoading(false);
            }, (error) => {
                console.error("Firestore fetch error:", error);
                setError("Failed to load applications: " + (error as any).message, true);
                setLoading(false);
            });

            return unsubscribe;
        } catch (e) {
            setError("Error setting up application listener.", true);
            setLoading(false);
        }
    }, [user, setError, clearError]);

    useEffect(() => {
        const unsubscribe = fetchApplications();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [fetchApplications]);


    if (!user) {
        return <div className="text-center py-5 text-danger fw-bold">Please log in to view your job applications.</div>;
    }
    
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

    return (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
            <div className="card-header bg-white border-bottom px-4 py-3 d-flex justify-content-between align-items-center">
                <h5 className="mb-0 fw-bold text-dark">Application History <span className="badge bg-light text-primary ms-2 rounded-pill">{applications.length}</span></h5>
            </div>
            
            <div className="card-body p-0">
                {applications.length === 0 ? (
                    <div className="text-center py-5">
                        <div className="mb-3 text-primary opacity-25"><i className="bi bi-inbox fs-1"></i></div>
                        <h5 className="fw-bold text-dark">No applications yet</h5>
                        <p className="text-muted mb-4">Start exploring jobs and applying to see them here.</p>
                        <button className="btn btn-primary rounded-pill px-4 fw-medium">Find Jobs</button>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="bg-light">
                                <tr>
                                    <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Role</th>
                                    <th className="py-3 text-secondary small fw-bold text-uppercase">Company</th>
                                    <th className="py-3 text-secondary small fw-bold text-uppercase">Date Applied</th>
                                    <th className="py-3 text-secondary small fw-bold text-uppercase">Status</th>
                                    <th className="text-end px-4 py-3 text-secondary small fw-bold text-uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {applications.map(app => (
                                    <tr key={app.id} className="cursor-pointer" onClick={() => setSelectedApp(app)}>
                                        <td className="px-4 py-3">
                                            <span className="fw-bold text-dark">{app.jobTitle}</span>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-secondary" style={{width: '32px', height: '32px', fontSize: '0.8rem'}}>
                                                    {app.companyName.charAt(0)}
                                                </div>
                                                <div className="d-flex align-items-center">
                                                    <span className="text-secondary">{app.companyName}</span>
                                                    {verifiedCompanies[app.companyName] && (
                                                        <i className="bi bi-patch-check-fill text-primary ms-1" title="Verified Company"></i>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-muted small">{formatDate(app.appliedAt)}</td>
                                        <td>
                                            <span className={`badge rounded-pill fw-normal px-3 py-2 border border-opacity-10 ${getStatusClass(app.status).replace('text-white', '').replace('bg-', 'bg-opacity-10 text-bg-')} ${getStatusClass(app.status).includes('bg-') ? getStatusClass(app.status).split(' ')[0].replace('bg-', 'text-') : ''}`}>
                                                {app.status}
                                            </span>
                                        </td>
                                        <td className="text-end px-4">
                                            <button 
                                                className="btn btn-light btn-sm rounded-circle text-secondary hover-primary"
                                                onClick={(e) => { e.stopPropagation(); setSelectedApp(app); }}
                                            >
                                                <i className="bi bi-eye"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Application Detail Modal */}
            {selectedApp && (
                <div className="modal fade show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow-lg rounded-4">
                            <div className="modal-header border-bottom px-4 py-3">
                                <h5 className="modal-title fw-bold text-dark">Application Details</h5>
                                <button type="button" className="btn-close" onClick={() => setSelectedApp(null)}></button>
                            </div>
                            <div className="modal-body p-4">
                                <div className="d-flex align-items-center mb-4">
                                    <div className="rounded-circle bg-light border d-flex align-items-center justify-content-center fw-bold text-primary me-3" style={{width: '56px', height: '56px', fontSize: '1.5rem'}}>
                                        {selectedApp.companyName.charAt(0)}
                                    </div>
                                    <div>
                                        <h5 className="fw-bold text-dark mb-0">{selectedApp.jobTitle}</h5>
                                        <p className="text-muted mb-0 d-flex align-items-center">
                                            {selectedApp.companyName}
                                            {verifiedCompanies[selectedApp.companyName] && (
                                                <i className="bi bi-patch-check-fill text-primary ms-1" title="Verified Company"></i>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                
                                <div className="card bg-light border-0 rounded-3 p-3 mb-3">
                                    <div className="row g-3">
                                        <div className="col-6">
                                            <small className="text-uppercase text-muted fw-bold" style={{fontSize: '0.7rem'}}>Status</small>
                                            <div className="mt-1">
                                                <span className={`badge rounded-pill fw-normal px-3 py-2 ${getStatusClass(selectedApp.status)}`}>
                                                    {selectedApp.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="col-6">
                                            <small className="text-uppercase text-muted fw-bold" style={{fontSize: '0.7rem'}}>Applied On</small>
                                            <div className="mt-1 fw-medium text-dark">{formatDate(selectedApp.appliedAt)}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="d-grid">
                                    <button className="btn btn-outline-primary rounded-pill" onClick={() => setSelectedApp(null)}>Close</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Applications;