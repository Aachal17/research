// src/app/company/page.tsx

"use client";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore'; 
import React, { FC, useState, useEffect, useCallback, ReactNode } from 'react';

// NOTE: These are your required imports from the root page and firebase utils
import { useAuth } from '@/app/page'; 
import { auth, db, googleProvider } from '@/app/lib/firebase'; 

// IMPORTANT: Import the new job posting components
import { CreateJobPosting } from './CreateJobPosting'; 
import { JobPostingManager } from './JobPostingManager'; 
import { ApplicationManager } from './ApplicationManager';
import { PostHackathon } from './PostHackathon'; 

// ===============================================
// UI ATOMS (Matching the main app design system)
// ===============================================

const GlassCard: FC<{ children: ReactNode; className?: string; onClick?: () => void }> = ({ children, className = "", onClick }) => (
    <div 
        onClick={onClick}
        className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
        {children}
    </div>
);

const SectionHeader: FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
    <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        {subtitle && <p className="text-gray-600 text-lg">{subtitle}</p>}
    </div>
);

const PrimaryButton: FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
    <button 
        className={`bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md border-0 ${className}`}
        {...props}
    >
        {children}
    </button>
);

// --- Utility Functions for Company Data ---
/**
 * Creates initial company data in Firestore upon registration.
 */
const createInitialCompanyData = async (uid: string, companyName: string, email: string | null) => {
    const companyRef = doc(db, 'companies', uid);
    const defaultData = {
        companyName: companyName,
        email: email || 'N/A',
        uid: uid,
        contactName: 'N/A',
        website: 'N/A',
        jobPostings: 0,
        applicationsReceived: 0,
        candidatesHired: 0,
        activeSprints: 0,
        hackathonsPosted: 0,
        accountType: 'Company',
    };
    await setDoc(companyRef, defaultData, { merge: true });
};

// Fetches real company data from Firestore 'companies' collection
const getCompanyData = async (uid: string) => {
    const companyRef = doc(db, 'companies', uid);
    try {
        const docSnap = await getDoc(companyRef as any);
        if (docSnap.exists()) { 
            return docSnap.data() as any; 
        }
        // Fallback for new accounts
        return { 
            companyName: auth.currentUser?.displayName || 'Company', 
            jobPostings: 0, 
            applicationsReceived: 0, 
            candidatesHired: 0, 
            activeSprints: 0,
            hackathonsPosted: 0,
        };
    } catch(e) {
        console.error("Error fetching company data:", e);
        return { 
            companyName: 'Error Company', 
            jobPostings: 0, 
            applicationsReceived: 0, 
            candidatesHired: 0, 
            activeSprints: 0,
            hackathonsPosted: 0,
        };
    }
};

// ===============================================
// 1. COMPANY LOGIN CARD
// ===============================================

interface CompanyLoginCardProps {
    switchToRegister: () => void;
}

export const CompanyLoginCard: FC<CompanyLoginCardProps> = ({ switchToRegister }) => {
    const { auth, setError, clearError } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setIsSubmitting(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setError('Company Login successful! Redirecting to Dashboard.', false);
        } catch (error) {
            setError(`Company login failed: ${(error as any).message || 'Invalid credentials'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        clearError();
        setIsSubmitting(true);
        try {
            await signInWithPopup(auth, googleProvider);
            setError('Successfully logged in with Google!', false);
        } catch (error) {
            setError('Google sign-in failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <GlassCard className="max-w-md w-full mx-auto">
            <div className="p-8">
                <div className="text-center mb-6">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
                        <i className="bi bi-building-fill text-2xl"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h3>
                    <p className="text-gray-600">Sign in to your company account</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="form-label text-gray-700 font-medium">Email</label>
                        <input 
                            type="email" 
                            className="form-control rounded-xl border-gray-200 focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50 py-3" 
                            placeholder="hr@company.com" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required 
                        />
                    </div>
                    <div>
                        <label className="form-label text-gray-700 font-medium">Password</label>
                        <input 
                            type="password" 
                            className="form-control rounded-xl border-gray-200 focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50 py-3" 
                            placeholder="Your password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    <PrimaryButton type="submit" disabled={isSubmitting} className="w-full py-3">
                        {isSubmitting ? (
                            <><i className="bi bi-arrow-clockwise animate-spin me-2"></i> Signing In...</>
                        ) : (
                            'Company Sign In'
                        )}
                    </PrimaryButton>
                </form>
                
                <div className="text-center mt-6">
                    <div className="relative mb-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleGoogleLogin} 
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                    >
                        <i className="bi bi-google text-red-500"></i>
                        Continue with Google
                    </button>
                    
                    <p className="mt-6 text-gray-600">
                        Don't have a company account?{' '}
                        <button 
                            onClick={switchToRegister} 
                            className="text-green-600 font-semibold hover:text-green-700"
                        >
                            Register Company
                        </button>
                    </p>
                </div>
            </div>
        </GlassCard>
    );
};

// ===============================================
// 2. COMPANY REGISTER CARD
// ===============================================

interface CompanyRegisterCardProps {
    switchToLogin: () => void;
}

export const CompanyRegisterCard: FC<CompanyRegisterCardProps> = ({ switchToLogin }) => {
    const { auth, setError, clearError } = useAuth();
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setIsSubmitting(true);

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            setIsSubmitting(false);
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            setIsSubmitting(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            await updateProfile(user, { displayName: companyName }); 
            await createInitialCompanyData(user.uid, companyName, user.email);
            
            setError('Company Account created successfully! You are now logged in.', false);

        } catch (error) {
            setError(`Registration failed: ${(error as any).message || 'An unknown error occurred'}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleGoogleRegister = async () => {
        clearError();
        setIsSubmitting(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            if (result.user) {
                const name = result.user.displayName || 'New Company';
                await createInitialCompanyData(result.user.uid, name, result.user.email);
                setError('Successfully registered and logged in with Google!', false);
            }
        } catch (error) {
            setError('Google sign-up failed. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <GlassCard className="max-w-md w-full mx-auto">
            <div className="p-8">
                <div className="text-center mb-6">
                    <div className="bg-gradient-to-r from-green-500 to-emerald-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
                        <i className="bi bi-building-fill text-2xl"></i>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-2">Create Company Account</h3>
                    <p className="text-gray-600">Post jobs and find candidates instantly</p>
                </div>
                
                <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                        <label className="form-label text-gray-700 font-medium">Company Name</label>
                        <input 
                            type="text" 
                            className="form-control rounded-xl border-gray-200 focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50 py-3" 
                            placeholder="Your Company Name" 
                            value={companyName} 
                            onChange={e => setCompanyName(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div>
                        <label className="form-label text-gray-700 font-medium">Company Email</label>
                        <input 
                            type="email" 
                            className="form-control rounded-xl border-gray-200 focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50 py-3" 
                            placeholder="hr@company.com" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            required 
                        />
                    </div>
       
                    <div>
                        <label className="form-label text-gray-700 font-medium">Password</label>
                        <input 
                            type="password" 
                            className="form-control rounded-xl border-gray-200 focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50 py-3" 
                            placeholder="At least 8 characters" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <div>
                        <label className="form-label text-gray-700 font-medium">Confirm Password</label>
                        <input 
                            type="password" 
                            className="form-control rounded-xl border-gray-200 focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50 py-3" 
                            placeholder="Confirm your password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            required 
                        />
                    </div>
                    
                    <PrimaryButton type="submit" disabled={isSubmitting} className="w-full py-3">
                        {isSubmitting ? (
                            <><i className="bi bi-arrow-clockwise animate-spin me-2"></i> Creating Account...</>
                        ) : (
                            'Register Company'
                        )}
                    </PrimaryButton>
                </form>
                
                <div className="text-center mt-6">
                    <div className="relative mb-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Or continue with</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleGoogleRegister} 
                        disabled={isSubmitting}
                        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                    >
                        <i className="bi bi-google text-red-500"></i>
                        Continue with Google
                    </button>
                    
                    <p className="mt-6 text-gray-600">
                        Already have an account?{' '}
                        <button 
                            onClick={switchToLogin} 
                            className="text-green-600 font-semibold hover:text-green-700"
                        >
                            Sign In
                        </button>
                    </p>
                </div>
            </div>
        </GlassCard>
    );
};

// ===============================================
// 3. COMPANY DASHBOARD
// ===============================================

const CompanyStatCard: FC<{ title: string; value: number; icon: string; color: string; subtitle: string }> = ({ title, value, icon, color, subtitle }) => (
    <GlassCard className="p-6 h-full">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-800 mb-2">{value}</h3>
                <p className="text-gray-400 text-sm">{subtitle}</p>
            </div>
            <div className={`p-3 rounded-2xl bg-${color}-100 text-${color}-600`}>
                <i className={`${icon} text-xl`}></i>
            </div>
        </div>
    </GlassCard>
);

// Sidebar Component
const CompanySidebar: FC<{ 
    currentMenu: string; 
    setCurrentMenu: (menu: string) => void; 
    handleLogout: () => void;
    mobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
}> = ({ currentMenu, setCurrentMenu, handleLogout, mobileOpen, setMobileOpen }) => {
    const { user } = useAuth();
    
    const menuItems = [
        { key: 'dashboard', label: 'Dashboard', icon: 'bi-grid-3x3-gap-fill' },
        { key: 'jobPostings', label: 'Job Postings', icon: 'bi-briefcase-fill' },
        { key: 'newJob', label: 'Post New Job', icon: 'bi-plus-circle-fill' },
        { key: 'hackathons', label: 'Hackathons', icon: 'bi-trophy-fill' },
        { key: 'postHackathon', label: 'Post Hackathon', icon: 'bi-plus-circle-fill' },
        { key: 'candidates', label: 'Candidates', icon: 'bi-person-lines-fill' },
        { key: 'settings', label: 'Settings', icon: 'bi-gear-fill' },
    ];

    const sidebarContent = (
        <div className="bg-white h-full flex flex-col border-r border-gray-200 lg:border-r-0">
            {/* Logo */}
            <div className="flex items-center gap-3 p-6 border-b border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                    <i className="bi bi-building-fill text-white text-lg"></i>
                </div>
                <span className="text-xl font-bold text-gray-800">Company Portal</span>
                {/* Mobile close button */}
                <button 
                    onClick={() => setMobileOpen(false)}
                    className="lg:hidden ml-auto text-gray-500 hover:text-gray-700"
                >
                    <i className="bi bi-x-lg text-xl"></i>
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {menuItems.map((item) => (
                    <button
                        key={item.key}
                        onClick={() => {
                            setCurrentMenu(item.key);
                            setMobileOpen(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left ${
                            currentMenu === item.key
                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                    >
                        <i className={`bi ${item.icon} text-lg`}></i>
                        <span className="font-medium">{item.label}</span>
                    </button>
                ))}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gradient-to-r from-gray-600 to-gray-800 rounded-xl flex items-center justify-center text-white font-medium">
                        {user?.email?.charAt(0).toUpperCase() || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                            {user?.displayName || 'Company User'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                            {user?.email}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600"
                >
                    <i className="bi bi-box-arrow-right text-lg"></i>
                    <span className="font-medium">Sign Out</span>
                </button>
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile Overlay */}
            {mobileOpen && (
                <div 
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                    onClick={() => setMobileOpen(false)}
                />
            )}
            
            {/* Sidebar */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50 w-80 transform
                ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 transition-transform duration-300 ease-in-out
            `}>
                {sidebarContent}
            </div>
        </>
    );
};

export const CompanyDashboard: FC = () => {
    const { user, clearError, setError } = useAuth();
    const [companyData, setCompanyData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [currentMenu, setCurrentMenu] = useState('dashboard');
    const [mobileOpen, setMobileOpen] = useState(false);

    // Load Company-specific data
    const loadCompanyData = useCallback(async () => {
        if (user) {
            setLoading(true);
            const data = await getCompanyData(user.uid);
            setCompanyData(data);
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) loadCompanyData();
    }, [user, loadCompanyData]);

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            localStorage.removeItem('activePortal');
            clearError();
            setError('You have successfully signed out of the Company Portal.', false);
        } catch (err) {
            console.error("Logout failed:", err);
            setError("Failed to sign out. Please try again.");
        }
    };
    
    // Navigation Callbacks
    const handleJobPostSuccess = () => {
        setCurrentMenu('jobPostings'); 
        loadCompanyData();
    };

    const handleJobPostError = (message: string) => {
        setError(message, true);
    };

    const handleHackathonPostSuccess = () => {
        setCurrentMenu('hackathons');
        loadCompanyData();
    };

    const handleHackathonPostError = (message: string) => {
        setError(message, true);
    };
    
    // Content Switcher
    const renderContent = () => {
        switch (currentMenu) {
            case 'newJob':
                return (
                    <CreateJobPosting 
                        onPostSuccess={handleJobPostSuccess} 
                        onPostError={handleJobPostError}
                    />
                );
            case 'jobPostings':
                return <JobPostingManager />;
                
            case 'candidates':
                return <ApplicationManager />;

            case 'postHackathon':
                return (
                    <PostHackathon 
                        onPostSuccess={handleHackathonPostSuccess}
                        onPostError={handleHackathonPostError}
                    />
                );

            case 'hackathons':
                return (
                    <div className="text-center py-12">
                        <i className="bi bi-trophy text-4xl text-amber-500 mb-4"></i>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hackathon Management</h2>
                        <p className="text-gray-600">Manage your hackathons, view participants, and track submissions.</p>
                        <button 
                            className="bg-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-amber-700 mt-4"
                            onClick={() => setCurrentMenu('postHackathon')}
                        >
                            <i className="bi bi-plus-circle me-2"></i>
                            Post New Hackathon
                        </button>
                    </div>
                );

            case 'settings':
                return (
                    <div className="text-center py-12">
                        <i className="bi bi-gear text-4xl text-gray-400 mb-4"></i>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Company Settings</h2>
                        <p className="text-gray-600">Update company profile, branding, and billing details.</p>
                    </div>
                );
            default: // 'dashboard'
                if (loading) {
                    return (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <i className="bi bi-building-fill text-white text-2xl"></i>
                            </div>
                            <p className="text-gray-600 font-medium">Loading company dashboard...</p>
                        </div>
                    );
                }
                
                return (
                    <div className="space-y-8">
                        {/* Welcome Header */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl p-8 text-white">
                            <h1 className="text-3xl font-bold mb-2">Welcome back, {companyData?.companyName}! 👋</h1>
                            <p className="text-green-100 text-lg">
                                Manage your job postings, track candidates, and grow your team with JobMap.
                            </p>
                        </div>

                        {/* Stats Grid */}
                        <div>
                            <SectionHeader title="Company Overview" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <CompanyStatCard 
                                    title="Active Postings" 
                                    value={companyData?.jobPostings || 0}
                                    icon="bi bi-briefcase"
                                    color="green"
                                    subtitle="Currently visible jobs"
                                />
                                <CompanyStatCard 
                                    title="Applications" 
                                    value={companyData?.applicationsReceived || 0}
                                    icon="bi bi-person-badge"
                                    color="blue"
                                    subtitle="Total this month"
                                />
                                <CompanyStatCard 
                                    title="Candidates Hired" 
                                    value={companyData?.candidatesHired || 0}
                                    icon="bi bi-check2-circle"
                                    color="emerald"
                                    subtitle="Last 90 days"
                                />
                                <CompanyStatCard 
                                    title="Active Hackathons" 
                                    value={companyData?.hackathonsPosted || 0}
                                    icon="bi bi-trophy"
                                    color="amber"
                                    subtitle="Currently running"
                                />
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Job Management Card */}
                            <GlassCard className="p-6">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center text-xl">
                                        <i className="bi bi-briefcase-fill"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">Job Management</h3>
                                        <p className="text-gray-600">Manage your job postings and applications</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => setCurrentMenu('newJob')}
                                        className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-700"
                                    >
                                        <i className="bi bi-plus-circle me-2"></i>
                                        Post New Job
                                    </button>
                                    <button 
                                        onClick={() => setCurrentMenu('jobPostings')}
                                        className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-xl font-medium hover:bg-gray-50"
                                    >
                                        <i className="bi bi-list-ul me-2"></i>
                                        View All Postings
                                    </button>
                                </div>
                            </GlassCard>

                            {/* Hackathon Management Card */}
                            <GlassCard className="p-6 border border-amber-200">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-xl">
                                        <i className="bi bi-trophy-fill"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">Hackathons</h3>
                                        <p className="text-gray-600">Engage with developer community</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => setCurrentMenu('postHackathon')}
                                        className="w-full bg-amber-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-amber-700"
                                    >
                                        <i className="bi bi-plus-circle me-2"></i>
                                        Post New Hackathon
                                    </button>
                                    <button 
                                        onClick={() => setCurrentMenu('hackathons')}
                                        className="w-full border border-amber-300 text-amber-700 py-3 px-4 rounded-xl font-medium hover:bg-amber-50"
                                    >
                                        <i className="bi bi-trophy me-2"></i>
                                        Manage Hackathons
                                    </button>
                                </div>
                            </GlassCard>
                        </div>

                        {/* Recent Activity Placeholder */}
                        <GlassCard className="p-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h3>
                            <div className="text-center py-8">
                                <i className="bi bi-graph-up text-4xl text-gray-300 mb-4"></i>
                                <p className="text-gray-500">Your recent company activity will appear here</p>
                                <button 
                                    onClick={() => setCurrentMenu('candidates')}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-blue-700 mt-4"
                                >
                                    View Candidates
                                </button>
                            </div>
                        </GlassCard>
                    </div>
                );
        }
    };

    if (!user || user.isAnonymous) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <i className="bi bi-building text-4xl text-gray-400 mb-4"></i>
                    <h2 className="text-xl font-bold text-gray-600 mb-2">Access Denied</h2>
                    <p className="text-gray-500">Please log in to access the Company Dashboard.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <CompanySidebar 
                currentMenu={currentMenu} 
                setCurrentMenu={setCurrentMenu} 
                handleLogout={handleLogout}
                mobileOpen={mobileOpen}
                setMobileOpen={setMobileOpen}
            />
            
            {/* Main Content */}
            <main className="flex-1 min-h-screen overflow-auto">
                {/* Mobile Header */}
                <div className="lg:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-30">
                    <div className="flex items-center justify-between">
                        <button 
                            onClick={() => setMobileOpen(true)}
                            className="text-gray-600 hover:text-gray-800"
                        >
                            <i className="bi bi-list text-2xl"></i>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center text-white">
                                <i className="bi bi-building-fill text-sm"></i>
                            </div>
                            <span className="font-bold text-gray-800">Company Portal</span>
                        </div>
                        <div className="w-8"></div>
                    </div>
                </div>

                <div className="p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {currentMenu !== 'dashboard' && (
                            <div className="mb-6">
                                <button 
                                    onClick={() => setCurrentMenu('dashboard')}
                                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium mb-4"
                                >
                                    <i className="bi bi-arrow-left"></i>
                                    Back to Dashboard
                                </button>
                                <h1 className="text-2xl font-bold text-gray-800 capitalize">
                                    {currentMenu === 'newJob' && 'Post New Job'}
                                    {currentMenu === 'jobPostings' && 'Job Postings'}
                                    {currentMenu === 'candidates' && 'Candidate Management'}
                                    {currentMenu === 'postHackathon' && 'Post Hackathon'}
                                    {currentMenu === 'hackathons' && 'Hackathon Management'}
                                    {currentMenu === 'settings' && 'Company Settings'}
                                </h1>
                            </div>
                        )}
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
};