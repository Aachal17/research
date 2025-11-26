"use client";
import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithCustomToken,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    User,
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore'; 
import React, { createContext, FC, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

// ===============================================
// 1. FIREBASE & IMPORTS
// ===============================================
import { auth, db, googleProvider, createInitialUserData } from '@/app/lib/firebase';
import Profile from '@/app/components/Profile';
import ResumeBuilder from '@/app/components/Resume';
import { CompanyLoginCard, CompanyRegisterCard, CompanyDashboard } from '@/app/company/page';
import { JobSearch } from '@/app/components/JobSearch'; 
import { MapView } from '@/app/components/MapView';
import { SavedJobs } from '@/app/components/SavedJobs';
import { Applications } from '@/app/components/Applications';
import { ExploreOpportunities } from '@/app/components/ExploreOpportunities';

const Hero = "https://placehold.co/700x500/e0e7ff/4338ca?text=JobMap+AI";

// ===============================================
// 2. UI ATOMS (THE DESIGN SYSTEM)
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
        className={`bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md border-0 ${className}`}
        {...props}
    >
        {children}
    </button>
);

// ===============================================
// 3. AUTH CONTEXT & UTILS
// ===============================================

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    setError: (message: string, isError?: boolean) => void;
    clearError: () => void;
    auth: typeof auth;
    db: typeof db;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setErrorState] = useState<string | null>(null);
    const [isError, setIsErrorState] = useState(false);

    const setError = useCallback((message: string, isError: boolean = true) => {
        setErrorState(message);
        setIsErrorState(isError);
        if (!isError) setTimeout(() => setErrorState(null), 4000);
    }, []);

    const clearError = useCallback(() => {
        setErrorState(null);
        setIsErrorState(false);
    }, []);

    useEffect(() => {
        const initialSignIn = async () => {
            try {
                const initialAuthToken = (window as any).__initial_auth_token;
                if (typeof initialAuthToken !== 'undefined' && initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                }
            } catch (err) {
                console.error("Initial sign-in failed. Relying on manual login.", err);
            }
        };

        initialSignIn().then(() => {
            const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
                setUser(currentUser);
                setLoading(false);
            });
            return () => unsubscribe();
        });
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, error, setError, clearError, auth, db }}>
            {children}
            {error && (
                <div className={`fixed bottom-5 right-5 px-6 py-3 rounded-xl shadow-2xl text-white z-50 ${isError ? 'bg-red-500' : 'bg-green-500'}`}>
                    <div className="flex items-center gap-3">
                        <i className={`bi ${isError ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`}></i>
                        <span className="font-medium">{error}</span>
                        <button onClick={clearError} className="ml-2 opacity-75 hover:opacity-100">×</button>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
};

// ===============================================
// 4. AUTH & ONBOARDING CARDS
// ===============================================

const AuthCardWrapper: FC<{ title: string; subtitle: string; children: ReactNode }> = ({ title, subtitle, children }) => (
    <GlassCard className="max-w-md w-full mx-auto">
        <div className="p-8">
            <div className="text-center mb-6">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
                    <i className="bi bi-briefcase-fill text-2xl"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-600">{subtitle}</p>
            </div>
            {children}
        </div>
    </GlassCard>
);

export const LoginCard: FC<{ switchToRegister: () => void }> = ({ switchToRegister }) => {
    const { auth, setError, clearError } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            setError('Login successful!', false);
        } catch (err: any) {
            setError(err.message, true);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        clearError();
        setLoading(true);
        try {
            await signInWithPopup(auth, googleProvider);
            setError('Google login successful!', false);
        } catch (err: any) {
            setError(err.message, true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthCardWrapper title="Welcome Back" subtitle="Sign in to your account">
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="form-label text-gray-700 font-medium">Email</label>
                    <input 
                        type="email" 
                        className="form-control rounded-xl border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-3" 
                        placeholder="name@example.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                    />
                </div>
                <div>
                    <label className="form-label text-gray-700 font-medium">Password</label>
                    <input 
                        type="password" 
                        className="form-control rounded-xl border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-3" 
                        placeholder="Your password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required 
                    />
                </div>
                <PrimaryButton type="submit" disabled={loading} className="w-full py-3">
                    {loading ? (
                        <><i className="bi bi-arrow-clockwise animate-spin me-2"></i> Signing In...</>
                    ) : (
                        'Sign In'
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
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                >
                    <i className="bi bi-google text-red-500"></i>
                    Continue with Google
                </button>
                
                <p className="mt-6 text-gray-600">
                    Don't have an account?{' '}
                    <button 
                        onClick={switchToRegister} 
                        className="text-indigo-600 font-semibold hover:text-indigo-700"
                    >
                        Sign up
                    </button>
                </p>
            </div>
        </AuthCardWrapper>
    );
};

export const RegisterCard: FC<{ switchToLogin: () => void }> = ({ switchToLogin }) => {
    const { auth, setError, clearError } = useAuth();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        
        if (password !== confirmPassword) {
            setError('Passwords do not match', true);
            return;
        }
        
        if (password.length < 8) {
            setError('Password must be at least 8 characters', true);
            return;
        }

        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const displayName = `${firstName} ${lastName}`;

            await updateProfile(user, { displayName });
            await createInitialUserData(user.uid, displayName, user.email);
            setError('Account created successfully!', false);
        } catch (err: any) {
            setError(err.message, true);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRegister = async () => {
        clearError();
        setLoading(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            if (result.user) {
                await createInitialUserData(result.user.uid, result.user.displayName || '', result.user.email);
                setError('Google registration successful!', false);
            }
        } catch (err: any) {
            setError(err.message, true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthCardWrapper title="Create Account" subtitle="Start your journey today">
            <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="form-label text-gray-700 font-medium">First Name</label>
                        <input 
                            type="text" 
                            className="form-control rounded-xl border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-3" 
                            placeholder="John" 
                            value={firstName} 
                            onChange={e => setFirstName(e.target.value)} 
                            required 
                        />
                    </div>
                    <div>
                        <label className="form-label text-gray-700 font-medium">Last Name</label>
                        <input 
                            type="text" 
                            className="form-control rounded-xl border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-3" 
                            placeholder="Doe" 
                            value={lastName} 
                            onChange={e => setLastName(e.target.value)} 
                            required 
                        />
                    </div>
                </div>
                
                <div>
                    <label className="form-label text-gray-700 font-medium">Email</label>
                    <input 
                        type="email" 
                        className="form-control rounded-xl border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-3" 
                        placeholder="name@example.com" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required 
                    />
                </div>
                
                <div>
                    <label className="form-label text-gray-700 font-medium">Password</label>
                    <input 
                        type="password" 
                        className="form-control rounded-xl border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-3" 
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
                        className="form-control rounded-xl border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-3" 
                        placeholder="Confirm your password" 
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        required 
                    />
                </div>
                
                <PrimaryButton type="submit" disabled={loading} className="w-full py-3">
                    {loading ? (
                        <><i className="bi bi-arrow-clockwise animate-spin me-2"></i> Creating Account...</>
                    ) : (
                        'Create Account'
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
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
                >
                    <i className="bi bi-google text-red-500"></i>
                    Continue with Google
                </button>
                
                <p className="mt-6 text-gray-600">
                    Already have an account?{' '}
                    <button 
                        onClick={switchToLogin} 
                        className="text-indigo-600 font-semibold hover:text-indigo-700"
                    >
                        Sign in
                    </button>
                </p>
            </div>
        </AuthCardWrapper>
    );
};

// ===============================================
// 5. DASHBOARD & FEATURES
// ===============================================

// Mock Data Interfaces
interface DashboardJobData { 
    jobsApplied: number; 
    savedJobs: number; 
    interviews: number; 
    newMatches: number; 
    displayName: string; 
    email: string;
    userId: string;
}

interface Hackathon { 
    id: string; 
    title: string; 
    description: string; 
    companyName: string; 
    prizePool: string; 
    isVirtual: boolean; 
    skills: string[]; 
    startDate: string;
    endDate: string;
    location: string;
}

// Stat Card Component
const StatCard: FC<{ title: string; value: number; icon: string; color: string; subtitle: string }> = ({ title, value, icon, color, subtitle }) => (
    <GlassCard className="p-6 h-full">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-gray-800 mb-2">{value}</h3>
                <p className="text-gray-400 text-sm">{subtitle}</p>
            </div>
            <div className={`p-3 rounded-2xl bg-${color}-100 text-${color}-600`}>
                <i className={`bi ${icon} text-xl`}></i>
            </div>
        </div>
    </GlassCard>
);

// Hackathon Card Component
const HackathonCard: FC<{ hackathon: Hackathon }> = ({ hackathon }) => (
    <GlassCard className="h-full flex flex-col">
        <div className="p-6 flex-grow">
            <div className="flex justify-between items-start mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${hackathon.isVirtual ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {hackathon.isVirtual ? '🌐 Virtual' : '🏢 On-Site'}
                </span>
                <span className="text-amber-600 font-bold text-sm">
                    <i className="bi bi-trophy-fill mr-1"></i> {hackathon.prizePool}
                </span>
            </div>
            <h5 className="font-bold text-lg text-gray-800 mb-2">{hackathon.title}</h5>
            <p className="text-indigo-600 text-sm font-medium mb-3">{hackathon.companyName}</p>
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{hackathon.description}</p>
            <div className="flex gap-2 flex-wrap">
                {hackathon.skills.slice(0, 3).map((skill, index) => (
                    <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {skill}
                    </span>
                ))}
                {hackathon.skills.length > 3 && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        +{hackathon.skills.length - 3} more
                    </span>
                )}
            </div>
        </div>
        <div className="p-4 border-t border-gray-100">
            <button className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded-xl">
                View Details
            </button>
        </div>
    </GlassCard>
);

// Dashboard Content Component
const JobSeekerDashboardContent: FC<{ setCurrentMenu: (m: string) => void }> = ({ setCurrentMenu }) => {
    const { user } = useAuth();
    const [geminiPrompt, setGeminiPrompt] = useState('');
    const [geminiLoading, setGeminiLoading] = useState(false);
    
    // Mock data
    const jobData: DashboardJobData = {
        jobsApplied: 14, 
        savedJobs: 8, 
        interviews: 3, 
        newMatches: 12,
        displayName: user?.displayName || 'Job Seeker',
        email: user?.email || '',
        userId: user?.uid || ''
    };
    
    const hackathons: Hackathon[] = [
        { 
            id: '1', 
            title: 'Global AI Challenge', 
            description: 'Build innovative AI solutions for real-world problems. Open to all skill levels.', 
            companyName: 'Google AI', 
            prizePool: '$50,000', 
            isVirtual: true, 
            skills: ['Python', 'TensorFlow', 'Machine Learning'],
            startDate: '2024-03-15',
            endDate: '2024-03-17',
            location: 'Virtual'
        },
        { 
            id: '2', 
            title: 'FinTech Innovation Hackathon', 
            description: 'Create the next generation of financial technology solutions.', 
            companyName: 'Stripe', 
            prizePool: '$25,000', 
            isVirtual: false, 
            skills: ['React', 'Node.js', 'Blockchain'],
            startDate: '2024-04-10',
            endDate: '2024-04-12',
            location: 'San Francisco, CA'
        },
    ];

    const handleGeminiQuery = async () => {
        if (!geminiPrompt.trim()) return;
        
        setGeminiLoading(true);
        // Simulate API call
        setTimeout(() => {
            setGeminiLoading(false);
            setGeminiPrompt('');
        }, 2000);
    };

    return (
        <div className="space-y-8">
            {/* Welcome Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Welcome back, {jobData.displayName}! 👋</h1>
                    <p className="text-indigo-100 text-lg max-w-2xl">
                        You have <span className="font-semibold text-amber-300">{jobData.interviews} interviews</span> coming up this week. 
                        Ready to ace them?
                    </p>
                    <div className="flex gap-4 mt-6">
                        <button 
                            onClick={() => setCurrentMenu('jobSearch')} 
                            className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-semibold shadow-lg"
                        >
                            <i className="bi bi-search me-2"></i>Find Jobs
                        </button>
                        <button 
                            onClick={() => setCurrentMenu('resume')} 
                            className="bg-indigo-400 text-white border border-indigo-300 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-300"
                        >
                            <i className="bi bi-file-earmark-person me-2"></i>Edit Resume
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div>
                <SectionHeader title="Your Job Search at a Glance" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard 
                        title="Jobs Applied" 
                        value={jobData.jobsApplied} 
                        icon="bi-send-check-fill" 
                        color="blue"
                        subtitle="This month"
                    />
                    <StatCard 
                        title="Saved Jobs" 
                        value={jobData.savedJobs} 
                        icon="bi-bookmark-heart-fill" 
                        color="rose"
                        subtitle="Ready to apply"
                    />
                    <StatCard 
                        title="Interviews" 
                        value={jobData.interviews} 
                        icon="bi-calendar-check-fill" 
                        color="green"
                        subtitle="Scheduled"
                    />
                    <StatCard 
                        title="New Matches" 
                        value={jobData.newMatches} 
                        icon="bi-lightning-fill" 
                        color="amber"
                        subtitle="This week"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* AI Assistant - Left Column */}
                <div className="lg:col-span-2">
                    <GlassCard>
                        <div className="p-6 border-b border-gray-100">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg">
                                    <i className="bi bi-robot"></i>
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-800">AI Career Assistant</h3>
                                    <p className="text-gray-600">Get personalized advice for your job search</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6">
                            <div className="space-y-4 mb-6">
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 rounded-2xl rounded-tl-none px-4 py-3 max-w-[80%]">
                                        <p className="text-gray-700">
                                            Hello! Based on your activity, I recommend focusing on technical interview preparation. 
                                            Would you like me to generate some practice questions?
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    placeholder="Ask me anything about your job search..."
                                    value={geminiPrompt}
                                    onChange={(e) => setGeminiPrompt(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleGeminiQuery()}
                                />
                                <button 
                                    onClick={handleGeminiQuery}
                                    disabled={geminiLoading}
                                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {geminiLoading ? (
                                        <i className="bi bi-arrow-clockwise animate-spin"></i>
                                    ) : (
                                        <i className="bi bi-send-fill"></i>
                                    )}
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                </div>

                {/* Hackathons - Right Column */}
                <div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Featured Hackathons</h3>
                        <button 
                            onClick={() => setCurrentMenu('hackathons')}
                            className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                        >
                            View All
                        </button>
                    </div>
                    <div className="space-y-4">
                        {hackathons.map((hackathon) => (
                            <div key={hackathon.id} className="bg-white rounded-2xl p-4 border border-gray-200 hover:border-indigo-300 cursor-pointer">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                        {hackathon.companyName.substring(0, 2)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-800 mb-1">{hackathon.title}</h4>
                                        <p className="text-gray-600 text-sm mb-2">{hackathon.companyName}</p>
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <i className="bi bi-trophy-fill text-amber-500"></i>
                                                {hackathon.prizePool}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <i className="bi bi-geo-alt-fill text-blue-500"></i>
                                                {hackathon.isVirtual ? 'Virtual' : hackathon.location}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ===============================================
// 6. FLOATING SIDEBAR & LAYOUT
// ===============================================

const Sidebar: FC<{ 
    currentMenu: string; 
    setCurrentMenu: (m: string) => void; 
    handleLogout: () => void;
    mobileOpen: boolean;
    setMobileOpen: (open: boolean) => void;
}> = ({ currentMenu, setCurrentMenu, handleLogout, mobileOpen, setMobileOpen }) => {
    const { user } = useAuth();
    
    const menuItems = [
        { key: 'dashboard', label: 'Dashboard', icon: 'bi-grid-3x3-gap-fill' },
        { key: 'jobSearch', label: 'Job Search', icon: 'bi-search' },
        { key: 'mapView', label: 'Map View', icon: 'bi-geo-alt-fill' },
        { key: 'savedJobs', label: 'Saved Jobs', icon: 'bi-bookmark-fill' },
        { key: 'applications', label: 'Applications', icon: 'bi-file-earmark-text-fill' },
        { key: 'hackathons', label: 'Hackathons', icon: 'bi-trophy-fill' },
        { key: 'resume', label: 'Resume Builder', icon: 'bi-file-earmark-person-fill' },
        { key: 'profile', label: 'Profile', icon: 'bi-person-circle' },
    ];

    const sidebarContent = (
        <div className="bg-white h-full flex flex-col border-r border-gray-200 lg:border-r-0">
            {/* Logo */}
            <div className="flex items-center gap-3 p-6 border-b border-gray-200">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                    <i className="bi bi-briefcase-fill text-white text-lg"></i>
                </div>
                <span className="text-xl font-bold text-gray-800">JobMap</span>
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
                                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
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
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                            {user?.displayName || 'User'}
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

// Dashboard Shell Component
const DashboardShell: FC = () => {
    const { auth, setError, clearError } = useAuth();
    const [currentMenu, setCurrentMenu] = useState('dashboard');
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('activePortal');
            setError('Signed out successfully', false);
        } catch (err: any) {
            setError('Logout failed', true);
        }
    };

    const renderContent = () => {
        switch(currentMenu) {
            case 'dashboard': 
                return <JobSeekerDashboardContent setCurrentMenu={setCurrentMenu} />;
            case 'profile': 
                return <Profile />;
            case 'jobSearch': 
                return <JobSearch />;
            case 'mapView': 
                return <MapView />;
            case 'savedJobs': 
                return <SavedJobs />;
            case 'applications': 
                return <Applications />;
            case 'hackathons': 
                return (
                    <div className="text-center py-12">
                        <i className="bi bi-trophy text-4xl text-amber-500 mb-4"></i>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">Hackathons</h2>
                        <p className="text-gray-600">All hackathons will be displayed here.</p>
                    </div>
                );
            case 'resume': 
                return <ResumeBuilder />;
            default:
                return (
                    <div className="text-center py-12">
                        <i className="bi bi-cone-striped text-4xl text-gray-300 mb-4"></i>
                        <h2 className="text-2xl font-bold text-gray-600 mb-2">Under Construction</h2>
                        <p className="text-gray-400">This section is coming soon.</p>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <Sidebar 
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
                            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                                <i className="bi bi-briefcase-fill text-sm"></i>
                            </div>
                            <span className="font-bold text-gray-800">JobMap</span>
                        </div>
                        <div className="w-8"></div> {/* Spacer for balance */}
                    </div>
                </div>

                <div className="p-4 lg:p-8">
                    <div className="max-w-7xl mx-auto">
                        {renderContent()}
                    </div>
                </div>
            </main>
        </div>
    );
};

// ===============================================
// 7. LANDING PAGE (Updated with View More Button)
// ===============================================

const LandingPage: FC<{ setPortal: (portal: 'seeker' | 'company') => void }> = ({ setPortal }) => {
    const [showExplorePage, setShowExplorePage] = useState(false);

    // If showExplorePage is true, render the ExploreOpportunities component
    if (showExplorePage) {
        return <ExploreOpportunities onBack={() => setShowExplorePage(false)} />;
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-white/95 border-b border-gray-100">
                <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                            <i className="bi bi-briefcase-fill text-sm"></i>
                        </div>
                        <span className="text-xl font-bold text-gray-800">JobMap</span>
                    </div>
                    <button 
                        onClick={() => document.getElementById('portal-selection')?.scrollIntoView({ behavior: 'smooth' })}
                        className="bg-gray-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-gray-800"
                    >
                        Get Started
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 container mx-auto">
                <div className="text-center max-w-4xl mx-auto">
                    <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-sm font-medium mb-8 border border-indigo-100">
                        <i className="bi bi-stars"></i>
                        The future of job searching is here
                    </div>
                    
                    <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                        Find Your Dream Job with{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                            Intelligent Maps
                        </span>
                    </h1>
                    
                    <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Stop scrolling through endless lists. Visualize opportunities, optimize your resume with AI, 
                        and get hired faster with our intelligent job mapping platform.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <PrimaryButton 
                            onClick={() => document.getElementById('portal-selection')?.scrollIntoView({ behavior: 'smooth' })}
                            className="text-lg px-8 py-4"
                        >
                            <i className="bi bi-rocket-takeoff me-2"></i>
                            Start Your Journey
                        </PrimaryButton>
                        <button className="border border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-medium hover:bg-gray-50 text-lg">
                            <i className="bi bi-play-circle me-2"></i>
                            Watch Demo
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 bg-gray-50/50">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">
                            Why JobMap Stands Out
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            We've reimagined job searching from the ground up with cutting-edge technology 
                            and user-centered design.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: 'bi-map-fill',
                                title: 'Interactive Job Maps',
                                description: 'See opportunities visualized geographically. Filter by location, commute time, and company culture.',
                                color: 'blue'
                            },
                            {
                                icon: 'bi-robot',
                                title: 'AI Career Coach',
                                description: 'Get personalized resume suggestions, interview prep, and career path recommendations.',
                                color: 'purple'
                            },
                            {
                                icon: 'bi-trophy-fill',
                                title: 'Hackathon Integration',
                                description: 'Showcase your skills in coding competitions and get noticed by top tech companies.',
                                color: 'amber'
                            }
                        ].map((feature, index) => (
                            <GlassCard key={index} className="p-6 text-center">
                                <div className={`w-16 h-16 bg-${feature.color}-100 text-${feature.color}-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4`}>
                                    <i className={`bi ${feature.icon}`}></i>
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 mb-3">
                                    {feature.title}
                                </h3>
                                <p className="text-gray-600">
                                    {feature.description}
                                </p>
                            </GlassCard>
                        ))}
                    </div>
                </div>
            </section>

            {/* Explore Opportunities Section */}
            <section className="py-20 bg-white">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">
                            Explore Opportunities
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Discover various pathways to advance your career and showcase your skills
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {/* Jobs Card */}
                        <GlassCard className="p-6 text-center border-2 border-transparent hover:border-blue-200 cursor-pointer">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6">
                                <i className="bi bi-briefcase"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">
                                Full-Time Jobs
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Discover permanent positions with competitive salaries and benefits from top companies worldwide.
                            </p>
                            <div className="space-y-3 text-left mb-6">
                                {['Remote & On-site Options', 'Competitive Salaries', 'Career Growth', 'Health Benefits'].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-gray-600">
                                        <i className="bi bi-check-circle-fill text-green-500"></i>
                                        <span className="text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => setPortal('seeker')}
                                className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700"
                            >
                                Browse Jobs
                            </button>
                        </GlassCard>

                        {/* Internships Card */}
                        <GlassCard className="p-6 text-center border-2 border-transparent hover:border-green-200 cursor-pointer">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6">
                                <i className="bi bi-mortarboard"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">
                                Internships
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Gain valuable experience with internship opportunities designed for students and recent graduates.
                            </p>
                            <div className="space-y-3 text-left mb-6">
                                {['Paid Positions', 'Mentorship Programs', 'Skill Development', 'Return Offers'].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-gray-600">
                                        <i className="bi bi-check-circle-fill text-green-500"></i>
                                        <span className="text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => setPortal('seeker')}
                                className="w-full bg-green-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-700"
                            >
                                Find Internships
                            </button>
                        </GlassCard>

                        {/* Hackathons Card */}
                        <GlassCard className="p-6 text-center border-2 border-transparent hover:border-amber-200 cursor-pointer">
                            <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6">
                                <i className="bi bi-trophy"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">
                                Hackathons
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Participate in coding competitions to showcase your skills, win prizes, and get noticed by employers.
                            </p>
                            <div className="space-y-3 text-left mb-6">
                                {['Cash Prizes', 'Networking Opportunities', 'Skill Recognition', 'Job Offers'].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-gray-600">
                                        <i className="bi bi-check-circle-fill text-green-500"></i>
                                        <span className="text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => setPortal('seeker')}
                                className="w-full bg-amber-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-amber-700"
                            >
                                Join Hackathons
                            </button>
                        </GlassCard>
                    </div>

                    {/* View More Button */}
                    <div className="text-center mt-12">
                        <button 
                            onClick={() => setShowExplorePage(true)}
                            className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition-colors"
                        >
                            <i className="bi bi-search me-2"></i>
                            View All Opportunities
                        </button>
                        <p className="text-gray-500 mt-4">
                            Browse through hundreds of jobs, internships, and hackathons
                        </p>
                    </div>
                </div>
            </section>

            {/* Portal Selection */}
            <section id="portal-selection" className="py-20 bg-gray-50">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-800 mb-4">
                            Choose Your Path
                        </h2>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            Whether you're looking for your next opportunity or seeking amazing talent, 
                            we've got you covered.
                        </p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Job Seeker Card */}
                        <GlassCard 
                            onClick={() => setPortal('seeker')} 
                            className="p-8 text-center cursor-pointer border-2 border-transparent hover:border-indigo-200"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto mb-6">
                                <i className="bi bi-person-workspace"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">
                                Job Seeker
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Find your dream job, build an impressive resume, and track your applications 
                                with our AI-powered platform.
                            </p>
                            <div className="space-y-3 text-left">
                                {['AI Resume Builder', 'Interactive Job Maps', 'Application Tracker', 'Interview Prep'].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-gray-600">
                                        <i className="bi bi-check-circle-fill text-green-500"></i>
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <PrimaryButton className="w-full mt-8 py-4">
                                Start Job Seeking
                            </PrimaryButton>
                        </GlassCard>

                        {/* Company Card */}
                        <GlassCard 
                            onClick={() => setPortal('company')} 
                            className="p-8 text-center cursor-pointer border-2 border-transparent hover:border-green-200"
                        >
                            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-teal-600 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto mb-6">
                                <i className="bi bi-building"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-800 mb-3">
                                Employer
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Post jobs, manage candidates, and find the perfect talent with our 
                                intelligent hiring platform.
                            </p>
                            <div className="space-y-3 text-left">
                                {['Smart Candidate Matching', 'Application Management', 'Branded Career Pages', 'Analytics Dashboard'].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-gray-600">
                                        <i className="bi bi-check-circle-fill text-green-500"></i>
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                            <button className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white py-4 px-6 rounded-xl font-semibold shadow-md hover:shadow-lg mt-8">
                                Start Hiring
                            </button>
                        </GlassCard>
                    </div>
                </div>
            </section>
        </div>
    );
};

// ===============================================
// 8. ROOT APP WRAPPER
// ===============================================

const AuthFlowManager: FC = () => {
    const { user, loading } = useAuth();
    const [portal, setPortal] = useState<'seeker' | 'company' | null>(null);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

    useEffect(() => {
        const saved = localStorage.getItem('activePortal');
        if (saved) setPortal(saved as 'seeker' | 'company');
    }, []);

    const handlePortalSet = (p: 'seeker' | 'company') => {
        setPortal(p);
        localStorage.setItem('activePortal', p);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <i className="bi bi-briefcase-fill text-white text-2xl"></i>
                    </div>
                    <p className="text-gray-600 font-medium">Loading JobMap...</p>
                </div>
            </div>
        );
    }

    // User is logged in - show appropriate dashboard
    if (user) {
        if (portal === 'company') {
            return <CompanyDashboard />;
        }
        return <DashboardShell />;
    }

    // Show landing page if no portal selected
    if (!portal) {
        return <LandingPage setPortal={handlePortalSet} />;
    }

    // Show auth screens if portal selected but not logged in
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            {/* Back to portal selection */}
            <button 
                onClick={() => {
                    setPortal(null);
                    localStorage.removeItem('activePortal');
                }}
                className="absolute top-6 left-6 text-gray-600 hover:text-gray-800 font-medium flex items-center gap-2"
            >
                <i className="bi bi-arrow-left"></i>
                Back to Home
            </button>

            {/* Auth Card */}
            {authMode === 'login' ? (
                portal === 'company' ? (
                    <CompanyLoginCard switchToRegister={() => setAuthMode('register')} />
                ) : (
                    <LoginCard switchToRegister={() => setAuthMode('register')} />
                )
            ) : (
                portal === 'company' ? (
                    <CompanyRegisterCard switchToLogin={() => setAuthMode('login')} />
                ) : (
                    <RegisterCard switchToLogin={() => setAuthMode('login')} />
                )
            )}
        </div>
    );
};

// Final App Component
const FinalApp: FC = () => (
    <div style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {/* External Dependencies */}
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet" />
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>

        {/* Custom Styles */}
        <style>{`
            .line-clamp-2 {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
        `}</style>

        <AuthProvider>
            <AuthFlowManager />
        </AuthProvider>
    </div>
);

export default FinalApp;

// Export interfaces for other components
export interface ProfileData { 
    name: string; 
    headline: string; 
    location: string;
    about: string;
    profileImageUrl: string;
    coverImageUrl: string;
}

export interface SocialLinks {
    linkedin: string;
    facebook: string;
    instagram: string;
}

export interface Experience {
    id: number;
    title: string;
    company: string;
    dates: string;
}

export interface Education {
    id: number;
    school: string;
    degree: string;
    dates: string;
}

export interface Skill {
    id: number;
    name: string;
}

export interface Project {
    id: number;
    title: string;
    description: string;
}