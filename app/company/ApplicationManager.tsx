// src/app/company/ApplicationManager.tsx

"use client";
import { FC, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/app/page';
import { db } from '@/app/lib/firebase';

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

interface ApplicationDetail {
    id: string;
    jobTitle: string;
    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    userSkills: string[];
    userExperience: string;
    userEducation: string;
    userResumeUrl: string;
    appliedAt: Date;
    status: 'Submitted' | 'Reviewed' | 'Interview Scheduled' | 'Rejected' | 'Hired';
    jobId: string;
    companyId: string;
}

interface ApplicantProfile {
    id: string;
    name: string;
    email: string;
    phone: string;
    skills: string[];
    experience: string;
    education: string;
    resumeUrl: string;
    bio: string;
    location: string;
}

interface Task {
    id?: string;
    title: string;
    description: string;
    dueDate: string;
    assignedTo: string;
    assignedToName: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    createdAt: Date;
    companyId?: string;
    companyName?: string;
}

interface Interview {
    id?: string;
    applicantId: string;
    applicantName: string;
    jobTitle: string;
    interviewDate: string;
    interviewTime: string;
    duration: string;
    interviewType: string;
    meetingLink: string;
    notes: string;
    status: 'Scheduled' | 'Completed' | 'Cancelled';
    companyId?: string;
    companyName?: string;
}

interface ModalState {
    isOpen: boolean;
    type: 'PROFILE' | 'TASK' | 'INTERVIEW' | null;
    data: any;
}

// ============================================================================
// 2. UI HELPERS (ICONS & BADGES)
// ============================================================================

const StatusBadge: FC<{ status: string }> = ({ status }) => {
    let colorClass = 'bg-secondary';
    let icon = 'bi-circle';

    switch (status) {
        case 'Submitted': colorClass = 'bg-primary bg-opacity-10 text-primary'; icon = 'bi-inbox'; break;
        case 'Reviewed': colorClass = 'bg-info bg-opacity-10 text-info'; icon = 'bi-eye'; break;
        case 'Interview Scheduled': colorClass = 'bg-warning bg-opacity-10 text-warning'; icon = 'bi-calendar-event'; break;
        case 'Hired': colorClass = 'bg-success bg-opacity-10 text-success'; icon = 'bi-check-circle'; break;
        case 'Rejected': colorClass = 'bg-danger bg-opacity-10 text-danger'; icon = 'bi-x-circle'; break;
    }

    return (
        <span className={`badge rounded-pill fw-medium px-3 py-2 ${colorClass} border border-opacity-10`}>
            <i className={`bi ${icon} me-2`}></i>{status}
        </span>
    );
};

const Avatar: FC<{ name: string; size?: number }> = ({ name, size = 40 }) => {
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return (
        <div 
            className="rounded-circle bg-light d-flex align-items-center justify-content-center fw-bold text-primary border shadow-sm"
            style={{ width: size, height: size, fontSize: size * 0.4, minWidth: size }}
        >
            {initials}
        </div>
    );
};

// ============================================================================
// 3. SUB-COMPONENTS
// ============================================================================

const ApplicationStats: FC<{ applications: ApplicationDetail[] }> = ({ applications }) => {
    const getStatusCount = (status: string) => applications.filter(app => app.status === status).length;
    const activePipeline = getStatusCount('Submitted') + getStatusCount('Reviewed') + getStatusCount('Interview Scheduled');
    const actionRequired = getStatusCount('Submitted');

    const stats = [
        { label: 'Total Applications', value: applications.length, icon: 'bi-people', color: 'primary' },
        { label: 'Active Pipeline', value: activePipeline, icon: 'bi-activity', color: 'success' },
        { label: 'Action Required', value: actionRequired, icon: 'bi-exclamation-circle', color: 'warning' },
        { label: 'Hired This Month', value: getStatusCount('Hired'), icon: 'bi-trophy', color: 'info' },
    ];

    return (
        <div className="row g-3 mb-4">
            {stats.map((stat, idx) => (
                <div key={idx} className="col-xl-3 col-md-6">
                    <div className="card border-0 shadow-sm h-100 rounded-4 overflow-hidden">
                        <div className="card-body d-flex align-items-center">
                            <div className={`rounded-circle p-3 bg-${stat.color} bg-opacity-10 text-${stat.color} me-3`}>
                                <i className={`bi ${stat.icon} fs-4`}></i>
                            </div>
                            <div>
                                <div className="text-muted small text-uppercase fw-bold">{stat.label}</div>
                                <div className="h4 mb-0 fw-bold text-dark">{stat.value}</div>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ApplicationFilters: FC<{
    statusFilter: string;
    setStatusFilter: (filter: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    viewMode: 'list' | 'kanban';
    setViewMode: (mode: 'list' | 'kanban') => void;
    applications: ApplicationDetail[];
}> = ({ statusFilter, setStatusFilter, searchTerm, setSearchTerm, viewMode, setViewMode, applications }) => {
    const getStatusCount = (status: string) => applications.filter(app => app.status === status).length;
    const applicationStatuses = ['Submitted', 'Reviewed', 'Interview Scheduled', 'Rejected', 'Hired'];

    return (
        <div className="card border-0 shadow-sm rounded-4 mb-4 bg-white">
            <div className="card-body p-3">
                <div className="row g-3 align-items-center">
                    <div className="col-md-4">
                        <div className="input-group">
                            <span className="input-group-text bg-light border-0 ps-3">
                                <i className="bi bi-search text-muted"></i>
                            </span>
                            <input
                                type="text"
                                className="form-control border-0 bg-light"
                                placeholder="Search applicants..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="col-md-8">
                        <div className="d-flex gap-2 justify-content-md-end overflow-auto pb-1">
                            <button
                                className={`btn btn-sm rounded-pill px-3 fw-medium ${statusFilter === 'All' ? 'btn-dark' : 'btn-light text-secondary'}`}
                                onClick={() => setStatusFilter('All')}
                            >
                                All ({applications.length})
                            </button>
                            {applicationStatuses.map(status => (
                                <button
                                    key={status}
                                    className={`btn btn-sm rounded-pill px-3 fw-medium whitespace-nowrap ${statusFilter === status ? 'btn-dark' : 'btn-light text-secondary'}`}
                                    onClick={() => setStatusFilter(status)}
                                >
                                    {status} ({getStatusCount(status)})
                                </button>
                            ))}
                            
                            <div className="vr mx-2"></div>

                            <div className="btn-group" role="group">
                                <button
                                    type="button"
                                    className={`btn btn-sm px-3 ${viewMode === 'list' ? 'btn-dark' : 'btn-light text-secondary'}`}
                                    onClick={() => setViewMode('list')}
                                >
                                    <i className="bi bi-list-ul"></i>
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm px-3 ${viewMode === 'kanban' ? 'btn-dark' : 'btn-light text-secondary'}`}
                                    onClick={() => setViewMode('kanban')}
                                >
                                    <i className="bi bi-columns-gap"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ApplicationTable: FC<{
    applications: ApplicationDetail[];
    onViewProfile: (app: ApplicationDetail) => void;
    onAssignTask: (app: ApplicationDetail) => void;
    onScheduleInterview: (app: ApplicationDetail) => void;
    onUpdateStatus: (id: string, status: string) => void;
    onMarkAsHired: (app: ApplicationDetail) => void;
}> = ({ applications, onViewProfile, onAssignTask, onScheduleInterview, onUpdateStatus, onMarkAsHired }) => {
    
    const formatDate = (date: any) => {
        try {
            if (date instanceof Date) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            if (date?.seconds) return new Date(date.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch { return '-'; }
    };

    if (applications.length === 0) {
        return (
            <div className="text-center py-5 bg-white rounded-4 shadow-sm">
                <i className="bi bi-person-x display-4 text-muted opacity-50"></i>
                <h5 className="mt-3 text-dark fw-bold">No applications found</h5>
                <p className="text-muted mb-0">Try adjusting your search or filters</p>
            </div>
        );
    }

    return (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                    <thead className="bg-light">
                        <tr>
                            <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Applicant</th>
                            <th className="py-3 text-secondary small fw-bold text-uppercase">Role</th>
                            <th className="py-3 text-secondary small fw-bold text-uppercase">Status</th>
                            <th className="py-3 text-secondary small fw-bold text-uppercase">Applied</th>
                            <th className="text-end px-4 py-3 text-secondary small fw-bold text-uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {applications.map((application) => (
                            <tr key={application.id} className="cursor-pointer" onClick={() => onViewProfile(application)}>
                                <td className="px-4 py-3">
                                    <div className="d-flex align-items-center gap-3">
                                        <Avatar name={application.userName} />
                                        <div>
                                            <h6 className="mb-0 fw-bold text-dark">{application.userName}</h6>
                                            <small className="text-muted">{application.userEmail}</small>
                                        </div>
                                    </div>
                                </td>
                                <td><span className="fw-medium text-dark">{application.jobTitle}</span></td>
                                <td><StatusBadge status={application.status} /></td>
                                <td className="text-muted small">{formatDate(application.appliedAt)}</td>
                                <td className="text-end px-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="dropdown">
                                        <button className="btn btn-light btn-sm rounded-circle shadow-sm" data-bs-toggle="dropdown">
                                            <i className="bi bi-three-dots-vertical"></i>
                                        </button>
                                        <ul className="dropdown-menu dropdown-menu-end border-0 shadow-lg rounded-3">
                                            <li><button className="dropdown-item py-2" onClick={() => onViewProfile(application)}><i className="bi bi-person me-2"></i>View Profile</button></li>
                                            <li><button className="dropdown-item py-2" onClick={() => onScheduleInterview(application)}><i className="bi bi-calendar-plus me-2"></i>Schedule Interview</button></li>
                                            <li><button className="dropdown-item py-2" onClick={() => onAssignTask(application)}><i className="bi bi-check2-square me-2"></i>Assign Task</button></li>
                                            <li><hr className="dropdown-divider" /></li>
                                            <li><button className="dropdown-item py-2 text-success" onClick={() => onMarkAsHired(application)}><i className="bi bi-check-circle me-2"></i>Hire Candidate</button></li>
                                            <li><button className="dropdown-item py-2 text-danger" onClick={() => onUpdateStatus(application.id, 'Rejected')}><i className="bi bi-x-circle me-2"></i>Reject</button></li>
                                        </ul>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ApplicationKanban: FC<{
    applications: ApplicationDetail[];
    onViewProfile: (app: ApplicationDetail) => void;
    onAssignTask: (app: ApplicationDetail) => void;
    onScheduleInterview: (app: ApplicationDetail) => void;
    onUpdateStatus: (id: string, status: string) => void;
    onMarkAsHired: (app: ApplicationDetail) => void;
}> = ({ applications, onViewProfile, onAssignTask, onScheduleInterview, onUpdateStatus, onMarkAsHired }) => {
    const statusColumns = [
        { key: 'Submitted', title: 'New', color: 'primary', icon: 'bi-inbox' },
        { key: 'Reviewed', title: 'Reviewed', color: 'info', icon: 'bi-eye' },
        { key: 'Interview Scheduled', title: 'Interview', color: 'warning', icon: 'bi-calendar-event' },
        { key: 'Hired', title: 'Hired', color: 'success', icon: 'bi-trophy' },
        { key: 'Rejected', title: 'Rejected', color: 'danger', icon: 'bi-x-circle' }
    ];

    const handleDragStart = (e: React.DragEvent, applicationId: string) => {
        e.dataTransfer.setData('applicationId', applicationId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, newStatus: string) => {
        e.preventDefault();
        const applicationId = e.dataTransfer.getData('applicationId');
        onUpdateStatus(applicationId, newStatus);
    };

    const formatDate = (date: any) => {
        try {
            if (date instanceof Date) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return new Date(date.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch { return '-'; }
    };

    return (
        <div className="overflow-x-auto pb-4">
            <div className="d-flex gap-3" style={{ minWidth: '1200px' }}>
                {statusColumns.map(column => {
                    const columnApps = applications.filter(app => app.status === column.key);
                    return (
                        <div key={column.key} className="flex-shrink-0" style={{ width: '280px' }}>
                            <div className={`d-flex justify-content-between align-items-center mb-3 px-2 py-2 rounded-3 bg-${column.color} bg-opacity-10`}>
                                <div className={`text-${column.color} fw-bold small text-uppercase d-flex align-items-center`}>
                                    <i className={`${column.icon} me-2 fs-6`}></i> {column.title}
                                </div>
                                <span className={`badge bg-white text-${column.color} shadow-sm rounded-pill`}>{columnApps.length}</span>
                            </div>
                            
                            <div 
                                className="d-flex flex-column gap-2"
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, column.key)}
                                style={{ minHeight: '500px' }}
                            >
                                {columnApps.map(app => (
                                    <div 
                                        key={app.id} 
                                        className="card border-0 shadow-sm rounded-3 cursor-pointer hover-shadow transition"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, app.id)}
                                        onClick={() => onViewProfile(app)}
                                    >
                                        <div className="card-body p-3">
                                            <div className="d-flex justify-content-between mb-2">
                                                <Avatar name={app.userName} size={32} />
                                                <small className="text-muted" style={{fontSize: '0.75rem'}}>{formatDate(app.appliedAt)}</small>
                                            </div>
                                            <h6 className="fw-bold text-dark mb-1 text-truncate">{app.userName}</h6>
                                            <p className="text-secondary small mb-2 text-truncate">{app.jobTitle}</p>
                                            
                                            <div className="d-flex gap-1 flex-wrap mb-2">
                                                {app.userSkills.slice(0, 2).map((s, i) => (
                                                    <span key={i} className="badge bg-light text-secondary border fw-normal" style={{fontSize: '0.65rem'}}>{s}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {columnApps.length === 0 && (
                                    <div className="text-center py-5 border border-dashed rounded-3 bg-light opacity-50">
                                        <small className="text-muted">Empty</small>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ProfileModal: FC<{
    applicant: ApplicantProfile;
    application: ApplicationDetail;
    onClose: () => void;
    onScheduleInterview: () => void;
}> = ({ applicant, application, onClose, onScheduleInterview }) => {
    return (
        <div className="modal fade show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'}}>
            <div className="modal-dialog modal-lg modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div className="modal-header border-bottom bg-white p-4">
                        <div className="d-flex align-items-center gap-3">
                            <Avatar name={applicant.name} size={56} />
                            <div>
                                <h5 className="modal-title fw-bold text-dark mb-0">{applicant.name}</h5>
                                <p className="text-muted small mb-0">{application.jobTitle}</p>
                            </div>
                        </div>
                        <div className="ms-auto me-3">
                            <StatusBadge status={application.status} />
                        </div>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-0 bg-light">
                        <div className="row g-0">
                            {/* Left Content */}
                            <div className="col-md-8 p-4 bg-white">
                                <h6 className="fw-bold text-uppercase text-secondary small mb-3 letter-spacing-1">Contact Information</h6>
                                <div className="row g-3 mb-4">
                                    <div className="col-6">
                                        <label className="small text-muted d-block">Email</label>
                                        <span className="text-dark fw-medium">{applicant.email}</span>
                                    </div>
                                    <div className="col-6">
                                        <label className="small text-muted d-block">Phone</label>
                                        <span className="text-dark fw-medium">{applicant.phone}</span>
                                    </div>
                                </div>

                                <h6 className="fw-bold text-uppercase text-secondary small mb-3 letter-spacing-1">Experience & Skills</h6>
                                <div className="mb-3">
                                    <label className="small text-muted d-block mb-1">Experience</label>
                                    <p className="text-dark small mb-0">{applicant.experience}</p>
                                </div>
                                <div className="mb-3">
                                    <label className="small text-muted d-block mb-1">Education</label>
                                    <p className="text-dark small mb-0">{applicant.education}</p>
                                </div>
                                <div>
                                    <label className="small text-muted d-block mb-2">Skills</label>
                                    <div className="d-flex flex-wrap gap-2">
                                        {applicant.skills.map((s, i) => (
                                            <span key={i} className="badge bg-light text-dark border fw-normal px-3 py-2">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Sidebar */}
                            <div className="col-md-4 p-4 border-start">
                                <h6 className="fw-bold text-dark mb-3">Actions</h6>
                                <div className="d-grid gap-2">
                                    <button className="btn btn-primary rounded-pill shadow-sm" onClick={onScheduleInterview}>
                                        <i className="bi bi-calendar-plus me-2"></i>Schedule Interview
                                    </button>
                                    {applicant.resumeUrl && (
                                        <a href={applicant.resumeUrl} target="_blank" className="btn btn-outline-dark rounded-pill">
                                            <i className="bi bi-file-earmark-pdf me-2"></i>View Resume
                                        </a>
                                    )}
                                </div>

                                <hr className="my-4 opacity-10" />

                                <h6 className="fw-bold text-dark mb-2">Notes</h6>
                                <textarea className="form-control bg-white border-0 shadow-sm small" rows={4} placeholder="Add internal notes..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TaskModal: FC<{
    taskData: Task;
    onUpdate: (data: Task) => void;
    onSubmit: () => void;
    onClose: () => void;
}> = ({ taskData, onUpdate, onSubmit, onClose }) => {
    return (
        <div className="modal fade show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg rounded-4">
                    <div className="modal-header border-0 px-4 py-3">
                        <h5 className="modal-title fw-bold">Assign Task</h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body px-4 pb-4 pt-0">
                        <p className="text-muted small mb-4">Assign a task to <strong className="text-dark">{taskData.assignedToName}</strong>.</p>
                        
                        <div className="mb-3">
                            <label className="form-label small fw-bold text-secondary">Task Title</label>
                            <input type="text" className="form-control bg-light border-0" value={taskData.title} onChange={(e) => onUpdate({...taskData, title: e.target.value})} />
                        </div>
                        <div className="mb-3">
                            <label className="form-label small fw-bold text-secondary">Description</label>
                            <textarea className="form-control bg-light border-0" rows={3} value={taskData.description} onChange={(e) => onUpdate({...taskData, description: e.target.value})} />
                        </div>
                        <div className="mb-3">
                            <label className="form-label small fw-bold text-secondary">Due Date</label>
                            <input type="date" className="form-control bg-light border-0" value={taskData.dueDate} onChange={(e) => onUpdate({...taskData, dueDate: e.target.value})} />
                        </div>
                        
                        <div className="d-flex gap-2 justify-content-end mt-4">
                            <button className="btn btn-light rounded-pill px-4" onClick={onClose}>Cancel</button>
                            <button className="btn btn-dark rounded-pill px-4" onClick={onSubmit}>Assign Task</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const InterviewModal: FC<{
    interviewData: Interview;
    onUpdate: (data: Interview) => void;
    onSubmit: () => void;
    onClose: () => void;
}> = ({ interviewData, onUpdate, onSubmit, onClose }) => {
    return (
        <div className="modal fade show d-block" tabIndex={-1} style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg rounded-4">
                    <div className="modal-header border-0 px-4 py-3 bg-primary text-white rounded-top-4">
                        <h5 className="modal-title fw-bold">Schedule Interview</h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
                    </div>
                    <div className="modal-body p-4">
                        <div className="row g-3">
                            <div className="col-6">
                                <label className="form-label small fw-bold text-secondary">Date</label>
                                <input type="date" className="form-control bg-light border-0" value={interviewData.interviewDate} onChange={(e) => onUpdate({...interviewData, interviewDate: e.target.value})} />
                            </div>
                            <div className="col-6">
                                <label className="form-label small fw-bold text-secondary">Time</label>
                                <input type="time" className="form-control bg-light border-0" value={interviewData.interviewTime} onChange={(e) => onUpdate({...interviewData, interviewTime: e.target.value})} />
                            </div>
                            <div className="col-12">
                                <label className="form-label small fw-bold text-secondary">Type</label>
                                <select className="form-select bg-light border-0" value={interviewData.interviewType} onChange={(e) => onUpdate({...interviewData, interviewType: e.target.value})}>
                                    <option>Video Call</option>
                                    <option>Phone Call</option>
                                    <option>In-Person</option>
                                </select>
                            </div>
                            <div className="col-12">
                                <label className="form-label small fw-bold text-secondary">Meeting Link / Location</label>
                                <input type="text" className="form-control bg-light border-0" placeholder="e.g. Zoom link" value={interviewData.meetingLink} onChange={(e) => onUpdate({...interviewData, meetingLink: e.target.value})} />
                            </div>
                        </div>
                        
                        <div className="d-grid mt-4">
                            <button className="btn btn-primary rounded-pill shadow-sm py-2" onClick={onSubmit}>Confirm Schedule</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ModalManager: FC<{
    modal: ModalState;
    onClose: () => void;
    onScheduleInterview: () => void;
    taskData: Task;
    onTaskUpdate: (data: Task) => void;
    onTaskSubmit: () => void;
    interviewData: Interview;
    onInterviewUpdate: (data: Interview) => void;
    onInterviewSubmit: () => void;
}> = ({ modal, onClose, onScheduleInterview, taskData, onTaskUpdate, onTaskSubmit, interviewData, onInterviewUpdate, onInterviewSubmit }) => {
    if (!modal.isOpen) return null;

    switch (modal.type) {
        case 'PROFILE':
            return (
                <ProfileModal
                    applicant={modal.data.applicant}
                    application={modal.data.application}
                    onClose={onClose}
                    onScheduleInterview={onScheduleInterview}
                />
            );
        case 'TASK':
            return (
                <TaskModal
                    taskData={taskData}
                    onUpdate={onTaskUpdate}
                    onSubmit={onTaskSubmit}
                    onClose={onClose}
                />
            );
        case 'INTERVIEW':
            return (
                <InterviewModal
                    interviewData={interviewData}
                    onUpdate={onInterviewUpdate}
                    onSubmit={onInterviewSubmit}
                    onClose={onClose}
                />
            );
        default:
            return null;
    }
};

const SkeletonLoader: FC = () => {
    return (
        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
            <div className="card-body p-0">
                <div className="p-4 border-bottom">
                    <div className="d-flex gap-3">
                        <div className="bg-light rounded col-2" style={{height: '40px'}}></div>
                        <div className="bg-light rounded col-3" style={{height: '40px'}}></div>
                    </div>
                </div>
                <div className="p-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="d-flex gap-3 mb-4 align-items-center">
                            <div className="rounded-circle bg-light" style={{width: '40px', height: '40px'}}></div>
                            <div className="flex-grow-1">
                                <div className="bg-light rounded mb-2" style={{width: '200px', height: '16px'}}></div>
                                <div className="bg-light rounded" style={{width: '150px', height: '12px'}}></div>
                            </div>
                            <div className="bg-light rounded" style={{width: '100px', height: '24px'}}></div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Toast Notification Component
const Toast: FC<{ message: string; type: 'success' | 'error'; onClose: () => void }> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`toast show position-fixed bottom-0 end-0 m-4 border-0 shadow-lg rounded-3`} role="alert" style={{zIndex: 1060}}>
            <div className={`toast-body d-flex align-items-center gap-2 ${type === 'success' ? 'text-success' : 'text-danger'} fw-medium`}>
                <i className={`bi ${type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'} fs-5`}></i>
                {message}
                <button type="button" className="btn-close ms-auto" onClick={onClose}></button>
            </div>
        </div>
    );
};

// Main Component
export const ApplicationManager: FC = () => {
    const { user, setError, clearError } = useAuth();
    const [applications, setApplications] = useState<ApplicationDetail[]>([]);
    const [filteredApplications, setFilteredApplications] = useState<ApplicationDetail[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    
    // Modal state
    const [modal, setModal] = useState<ModalState>({ isOpen: false, type: null, data: null });
    
    // Toast state
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ 
        show: false, 
        message: '', 
        type: 'success' 
    });
    
    // Form states
    const [taskData, setTaskData] = useState<Task>({
        title: '',
        description: '',
        dueDate: '',
        assignedTo: '',
        assignedToName: '',
        status: 'Pending',
        createdAt: new Date()
    });
    
    const [interviewData, setInterviewData] = useState<Interview>({
        applicantId: '',
        applicantName: '',
        jobTitle: '',
        interviewDate: '',
        interviewTime: '',
        duration: '60',
        interviewType: 'Video Call',
        meetingLink: '',
        notes: '',
        status: 'Scheduled'
    });

    // Show toast notification
    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ show: true, message, type });
    };

    // Close modal
    const closeModal = () => {
        setModal({ isOpen: false, type: null, data: null });
    };

    // Fetch applications (same as original)
    const fetchApplications = useCallback(() => {
        if (!user) {
            setLoading(false);
            setError("Please log in to view applications", true);
            return () => {};
        }

        setLoading(true);
        clearError();

        try {
            const applicationsRef = collection(db, 'jobApplications');
            const q = query(
                applicationsRef,
                where('companyId', '==', user.uid),
                orderBy('appliedAt', 'desc')
            );

            const unsubscribe = onSnapshot(q, 
                async (snapshot) => {
                    try {
                        const fetchedApps: ApplicationDetail[] = [];
                        
                        for (const docSnapshot of snapshot.docs) {
                            try {
                                const data = docSnapshot.data();
                                const userId = data.userId;
                                
                                const application: ApplicationDetail = {
                                    id: docSnapshot.id,
                                    jobTitle: data.jobTitle || 'No Title',
                                    userId: userId,
                                    userName: data.userName || `Applicant ${userId?.substring(0, 8) || 'Unknown'}`,
                                    userEmail: data.userEmail || 'No email provided',
                                    userPhone: data.userPhone || 'No phone provided',
                                    userSkills: Array.isArray(data.userSkills) ? data.userSkills : 
                                               typeof data.userSkills === 'string' ? data.userSkills.split(',') : [],
                                    userExperience: data.userExperience || 'Not specified',
                                    userEducation: data.userEducation || 'Not specified',
                                    userResumeUrl: data.userResumeUrl || '',
                                    status: data.status || 'Submitted',
                                    appliedAt: data.appliedAt?.toDate() || new Date(),
                                    jobId: data.jobId || '',
                                    companyId: data.companyId || user.uid
                                };

                                // Try to enhance with artifact data
                                try {
                                    const userDoc = await getDoc(doc(db, 'artifacts', userId));
                                    if (userDoc.exists()) {
                                        const userData = userDoc.data();
                                        application.userName = userData.displayName || userData.name || application.userName;
                                        application.userEmail = userData.email || application.userEmail;
                                        application.userPhone = userData.phone || userData.phoneNumber || application.userPhone;
                                        
                                        if (userData.skills && Array.isArray(userData.skills)) {
                                            application.userSkills = userData.skills;
                                        } else if (userData.tags) {
                                            application.userSkills = typeof userData.tags === 'string' ? 
                                                userData.tags.split(',') : 
                                                Array.isArray(userData.tags) ? userData.tags : [];
                                        }
                                        
                                        application.userExperience = userData.experience || userData.workExperience || application.userExperience;
                                        application.userEducation = userData.education || application.userEducation;
                                        application.userResumeUrl = userData.resumeUrl || userData.cvUrl || application.userResumeUrl;
                                    }
                                } catch (profileError) {
                                    console.log('Profile fetch optional - using application data');
                                }

                                fetchedApps.push(application);
                            } catch (docError) {
                                console.error(`Error processing document ${docSnapshot.id}:`, docError);
                            }
                        }
                        
                        setApplications(fetchedApps);
                        setLoading(false);
                    } catch (processingError: any) {
                        console.error("Error processing applications:", processingError);
                        setError("Error processing application data", true);
                        setLoading(false);
                    }
                },
                (error: any) => {
                    console.error("Firestore snapshot error:", error);
                    if (error.code === 'permission-denied') {
                        setError("Permission denied. Please check your Firestore rules.", true);
                    } else {
                        setError("Failed to load applications: " + error.message, true);
                    }
                    setLoading(false);
                }
            );

            return unsubscribe;
        } catch (setupError: any) {
            console.error("Error setting up application listener:", setupError);
            setError("Error setting up application listener: " + setupError.message, true);
            setLoading(false);
            return () => {};
        }
    }, [user, setError, clearError]);

    useEffect(() => {
        const unsubscribe = fetchApplications();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [fetchApplications]);

    // Filter applications by status and search term
    useEffect(() => {
        let filtered = applications;

        // Status filter
        if (statusFilter !== 'All') {
            filtered = filtered.filter(app => app.status === statusFilter);
        }

        // Search filter
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(app => 
                app.userName.toLowerCase().includes(searchLower) ||
                app.userEmail.toLowerCase().includes(searchLower) ||
                app.jobTitle.toLowerCase().includes(searchLower) ||
                app.userSkills.some(skill => skill.toLowerCase().includes(searchLower))
            );
        }

        setFilteredApplications(filtered);
    }, [applications, statusFilter, searchTerm]);

    // Update application status
    const handleUpdateStatus = async (applicationId: string, newStatus: string) => {
        if (!user) {
            showToast("Please log in to update status", 'error');
            return;
        }

        try {
            await updateDoc(doc(db, 'jobApplications', applicationId), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            showToast(`Status updated to ${newStatus}`, 'success');
        } catch (error: any) {
            console.error("Error updating status:", error);
            if (error.code === 'permission-denied') {
                showToast("Permission denied. Cannot update application status.", 'error');
            } else {
                showToast(`Failed to update status: ${error.message}`, 'error');
            }
        }
    };

    // View applicant profile
    const handleViewProfile = (application: ApplicationDetail) => {
        const applicant: ApplicantProfile = {
            id: application.userId,
            name: application.userName,
            email: application.userEmail,
            phone: application.userPhone,
            skills: application.userSkills,
            experience: application.userExperience,
            education: application.userEducation,
            resumeUrl: application.userResumeUrl,
            bio: `Applicant for ${application.jobTitle}`,
            location: 'Location not specified'
        };
        setModal({ 
            isOpen: true, 
            type: 'PROFILE', 
            data: { applicant, application } 
        });
    };

    // Open task assignment modal
    const handleAssignTask = (application: ApplicationDetail) => {
        setTaskData({
            title: '',
            description: '',
            dueDate: '',
            assignedTo: application.userId,
            assignedToName: application.userName,
            status: 'Pending',
            createdAt: new Date(),
            companyId: user?.uid,
            companyName: user?.displayName || 'Company'
        });
        setModal({ 
            isOpen: true, 
            type: 'TASK', 
            data: { application } 
        });
    };

    // Open interview scheduling modal
    const handleScheduleInterview = (application: ApplicationDetail) => {
        setInterviewData({
            applicantId: application.userId,
            applicantName: application.userName,
            jobTitle: application.jobTitle,
            interviewDate: '',
            interviewTime: '',
            duration: '60',
            interviewType: 'Video Call',
            meetingLink: '',
            notes: '',
            status: 'Scheduled',
            companyId: user?.uid,
            companyName: user?.displayName || 'Company'
        });
        setModal({ 
            isOpen: true, 
            type: 'INTERVIEW', 
            data: { application } 
        });
    };

    // Submit task assignment
    const handleSubmitTask = async () => {
        if (!user) {
            showToast("Please log in to assign tasks", 'error');
            return;
        }

        if (!taskData.title || !taskData.dueDate) {
            showToast("Please fill all required fields", 'error');
            return;
        }

        try {
            const taskToSubmit = {
                ...taskData,
                companyId: user.uid,
                companyName: user.displayName || 'Company',
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'tasks'), taskToSubmit);
            
            closeModal();
            setTaskData({
                title: '',
                description: '',
                dueDate: '',
                assignedTo: '',
                assignedToName: '',
                status: 'Pending',
                createdAt: new Date()
            });
            showToast("Task assigned successfully!", 'success');
            
            // Update application status to Reviewed
            if (modal.data?.application) {
                await handleUpdateStatus(modal.data.application.id, 'Reviewed');
            }
        } catch (error: any) {
            console.error("Error assigning task:", error);
            if (error.code === 'permission-denied') {
                showToast("Permission denied. Cannot assign tasks.", 'error');
            } else {
                showToast(`Failed to assign task: ${error.message}`, 'error');
            }
        }
    };

    // Submit interview schedule
    const handleSubmitInterview = async () => {
        if (!user) {
            showToast("Please log in to schedule interviews", 'error');
            return;
        }

        if (!interviewData.interviewDate || !interviewData.interviewTime) {
            showToast("Please fill all required fields", 'error');
            return;
        }

        try {
            const interviewToSubmit = {
                ...interviewData,
                companyId: user.uid,
                companyName: user.displayName || 'Company',
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'interviews'), interviewToSubmit);
            
            closeModal();
            setInterviewData({
                applicantId: '',
                applicantName: '',
                jobTitle: '',
                interviewDate: '',
                interviewTime: '',
                duration: '60',
                interviewType: 'Video Call',
                meetingLink: '',
                notes: '',
                status: 'Scheduled'
            });
            showToast("Interview scheduled successfully!", 'success');
            
            // Update application status to Interview Scheduled
            if (modal.data?.application) {
                await handleUpdateStatus(modal.data.application.id, 'Interview Scheduled');
            }
        } catch (error: any) {
            console.error("Error scheduling interview:", error);
            if (error.code === 'permission-denied') {
                showToast("Permission denied. Cannot schedule interviews.", 'error');
            } else {
                showToast(`Failed to schedule interview: ${error.message}`, 'error');
            }
        }
    };

    // Mark as hired
    const handleMarkAsHired = async (application: ApplicationDetail) => {
        if (window.confirm(`Are you sure you want to mark ${application.userName} as hired for ${application.jobTitle}?`)) {
            await handleUpdateStatus(application.id, 'Hired');
        }
    };

    if (loading) {
        return <SkeletonLoader />;
    }

    return (
        <div className="container-fluid px-4 py-4">
            
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="fw-bold text-dark mb-1">Application Manager</h3>
                    <p className="text-secondary mb-0">Overview of your hiring pipeline</p>
                </div>
            </div>

            {/* Statistics Cards */}
            <ApplicationStats applications={applications} />

            {/* Filters */}
            <ApplicationFilters
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                viewMode={viewMode}
                setViewMode={setViewMode}
                applications={applications}
            />

            {/* Applications View */}
            {viewMode === 'list' ? (
                <ApplicationTable
                    applications={filteredApplications}
                    onViewProfile={handleViewProfile}
                    onAssignTask={handleAssignTask}
                    onScheduleInterview={handleScheduleInterview}
                    onUpdateStatus={handleUpdateStatus}
                    onMarkAsHired={handleMarkAsHired}
                />
            ) : (
                <ApplicationKanban
                    applications={filteredApplications}
                    onViewProfile={handleViewProfile}
                    onAssignTask={handleAssignTask}
                    onScheduleInterview={handleScheduleInterview}
                    onUpdateStatus={handleUpdateStatus}
                    onMarkAsHired={handleMarkAsHired}
                />
            )}

            {/* Modal Manager */}
            <ModalManager
                modal={modal}
                onClose={closeModal}
                onScheduleInterview={() => {
                    closeModal();
                    if (modal.data?.application) {
                        handleScheduleInterview(modal.data.application);
                    }
                }}
                taskData={taskData}
                onTaskUpdate={setTaskData}
                onTaskSubmit={handleSubmitTask}
                interviewData={interviewData}
                onInterviewUpdate={setInterviewData}
                onInterviewSubmit={handleSubmitInterview}
            />

            {/* Toast Notification */}
            {toast.show && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast({ ...toast, show: false })}
                />
            )}
        </div>
    );
};