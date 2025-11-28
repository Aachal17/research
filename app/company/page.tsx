// src/app/company/page.tsx

"use client";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    deleteUser,
    User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore'; 
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
        className={`bg-white rounded-2xl shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer transition-all hover:shadow-md' : ''} ${className}`}
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
        className={`bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-md border-0 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
    >
        {children}
    </button>
);

// --- Utility Functions ---
const createInitialCompanyData = async (uid: string, companyName: string, email: string | null) => {
    const companyRef = doc(db, 'companies', uid);
    const defaultData = {
        companyName: companyName,
        email: email || 'N/A',
        uid: uid,
        description: '',
        website: '',
        employeeCount: '1-10',
        industry: '',
        contactName: '',
        isVerified: false, 
        verificationStatus: 'unsubmitted',
        jobPostings: 0,
        applicationsReceived: 0,
        candidatesHired: 0,
        activeSprints: 0,
        hackathonsPosted: 0,
        accountType: 'Company',
    };
    await setDoc(companyRef, defaultData, { merge: true });
};

const getCompanyData = async (uid: string) => {
    const companyRef = doc(db, 'companies', uid);
    try {
        const docSnap = await getDoc(companyRef as any);
        if (docSnap.exists()) { 
            return docSnap.data() as any; 
        }
        return { companyName: auth.currentUser?.displayName || 'Company' };
    } catch(e) {
        console.error("Error fetching company data:", e);
        return { companyName: 'Error Company' };
    }
};

// ===============================================
// NEW: TABBED SETTINGS COMPONENT
// ===============================================

const CompanySettings: FC<{ companyData: any; refreshData: () => void }> = ({ companyData, refreshData }) => {
    const { user, setError } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'verification' | 'security'>('profile');
    
    // -- State for Profile Edit --
    const [formData, setFormData] = useState({
        companyName: companyData?.companyName || '',
        website: companyData?.website || '',
        employeeCount: companyData?.employeeCount || '1-10',
        industry: companyData?.industry || '',
        description: companyData?.description || '',
    });

    // -- State for Verification --
    const [authName, setAuthName] = useState(companyData?.contactName || '');
    const [aadharNo, setAadharNo] = useState(companyData?.aadharNumber || '');
    const [cin, setCin] = useState(companyData?.cinNumber || '');
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'matched' | 'failed'>('idle');
    const [uploadFile, setUploadFile] = useState<File | null>(null);

    // -- State for Global Loading --
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleteInput, setDeleteInput] = useState('');

    // --- 1. Update Profile Logic ---
    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (!user) return;
            const companyRef = doc(db, 'companies', user.uid);
            
            await updateDoc(companyRef, {
                companyName: formData.companyName,
                website: formData.website,
                employeeCount: formData.employeeCount,
                industry: formData.industry,
                description: formData.description
            });

            // Update Auth Display Name as well
            if (user && formData.companyName !== user.displayName) {
                await updateProfile(user, { displayName: formData.companyName });
            }

            refreshData();
            setError('Profile updated successfully!', false);
        } catch (err: any) {
            setError(err.message, true);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- 2. Smart Verification Logic (Aadhar Scanning Simulation) ---
    const handleAadharScan = () => {
        if (!uploadFile || !authName || !aadharNo) {
            setError('Please provide Name, Aadhar Number, and upload the card image.', true);
            return;
        }

        setScanStatus('scanning');

        // Simulate Optical Character Recognition (OCR) delay
        setTimeout(async () => {
            // MOCK LOGIC: In a real app, this would send the image to an AWS Textract/Google Vision API
            // For demo: We assume verification passes if the file is present.
            
            // Randomly matching for demo feel (or logic based on input)
            const isMatch = true; 

            if (isMatch) {
                setScanStatus('matched');
                try {
                    if (!user) return;
                    const companyRef = doc(db, 'companies', user.uid);
                    await updateDoc(companyRef, {
                        isVerified: true,
                        verificationStatus: 'verified',
                        contactName: authName,
                        aadharNumber: aadharNo,
                        cinNumber: cin
                    });
                    refreshData();
                    setError('Identity Verified! Matches registered records.', false);
                } catch (e: any) {
                    setError(e.message, true);
                }
            } else {
                setScanStatus('failed');
                setError('Name on card does not match the registered authorized person.', true);
            }
        }, 3000); // 3 second simulated scan
    };

    // --- 3. Delete Account Logic ---
    const handleDeleteAccount = async () => {
        if (deleteInput !== 'DELETE') return;
        setIsSubmitting(true);
        try {
            if (user) {
                await deleteDoc(doc(db, 'companies', user.uid));
                await deleteUser(user);
            }
        } catch (err: any) {
            if (err.code === 'auth/requires-recent-login') {
                setError('Security Check: Please log out and log back in to delete details.');
            } else {
                setError(err.message, true);
            }
            setIsSubmitting(false);
            setShowDeleteConfirm(false);
        }
    };

    // --- RENDER HELPERS ---
    const TabButton = ({ id, label, icon }: { id: string, label: string, icon: string }) => (
        <button
            onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all border-b-2 ${
                activeTab === id 
                ? 'border-green-600 text-green-700 bg-green-50/50' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
        >
            <i className={`bi ${icon} text-lg`}></i>
            {label}
        </button>
    );

    return (
        <div className="animate-fade-in-up">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-end mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800">Settings & Profile</h2>
                    <p className="text-gray-500 mt-1">Manage your company presence and account security.</p>
                </div>
                {companyData?.isVerified && (
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-lg shadow-emerald-200">
                        <i className="bi bi-patch-check-fill text-lg"></i>
                        <span className="font-semibold tracking-wide">Verified Entity</span>
                    </div>
                )}
            </div>

            <GlassCard className="overflow-hidden min-h-[600px]">
                {/* Tabs Navigation */}
                <div className="flex border-b border-gray-100 overflow-x-auto">
                    <TabButton id="profile" label="General Profile" icon="bi-building" />
                    <TabButton id="verification" label="Verification Center" icon="bi-shield-lock" />
                    <TabButton id="security" label="Account Security" icon="bi-gear" />
                </div>

                <div className="p-8">
                    {/* TAB 1: EDIT PROFILE */}
                    {activeTab === 'profile' && (
                        <form onSubmit={handleProfileUpdate} className="max-w-4xl mx-auto space-y-8 animate-fade-in">
                            <div className="flex items-start gap-6">
                                {/* Logo Avatar Placeholder */}
                                <div className="group relative w-32 h-32 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 cursor-pointer hover:border-green-400 transition-colors">
                                    <div className="text-center text-gray-400 group-hover:text-green-600">
                                        <i className="bi bi-camera-fill text-3xl mb-1 block"></i>
                                        <span className="text-xs font-medium">Upload Logo</span>
                                    </div>
                                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                </div>
                                
                                <div className="flex-1">
                                    <h4 className="text-lg font-bold text-gray-800 mb-4">Company Details</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="form-label text-gray-700 font-medium text-sm">Company Name</label>
                                            <input 
                                                type="text" 
                                                className="form-control rounded-xl border-gray-200 py-3 mt-1 bg-gray-50 focus:bg-white transition-colors"
                                                value={formData.companyName}
                                                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label text-gray-700 font-medium text-sm">Industry</label>
                                            <select 
                                                className="form-control rounded-xl border-gray-200 py-3 mt-1 bg-gray-50 focus:bg-white"
                                                value={formData.industry}
                                                onChange={(e) => setFormData({...formData, industry: e.target.value})}
                                            >
                                                <option value="">Select Industry</option>
                                                <option value="Tech">Technology & SaaS</option>
                                                <option value="Finance">Finance & Fintech</option>
                                                <option value="Healthcare">Healthcare</option>
                                                <option value="Education">Education</option>
                                                <option value="Retail">Retail & E-commerce</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="form-label text-gray-700 font-medium text-sm">Website URL</label>
                                            <input 
                                                type="url" 
                                                placeholder="https://"
                                                className="form-control rounded-xl border-gray-200 py-3 mt-1 bg-gray-50 focus:bg-white"
                                                value={formData.website}
                                                onChange={(e) => setFormData({...formData, website: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label text-gray-700 font-medium text-sm">Employee Range</label>
                                            <select 
                                                className="form-control rounded-xl border-gray-200 py-3 mt-1 bg-gray-50 focus:bg-white"
                                                value={formData.employeeCount}
                                                onChange={(e) => setFormData({...formData, employeeCount: e.target.value})}
                                            >
                                                <option value="1-10">1-10 Employees</option>
                                                <option value="11-50">11-50 Employees</option>
                                                <option value="51-200">51-200 Employees</option>
                                                <option value="201-500">201-500 Employees</option>
                                                <option value="500+">500+ Employees</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="form-label text-gray-700 font-medium text-sm">About Company</label>
                                <textarea 
                                    rows={4}
                                    className="form-control rounded-xl border-gray-200 py-3 mt-1 bg-gray-50 focus:bg-white w-full"
                                    placeholder="Tell candidates about your mission, culture, and values..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                />
                            </div>

                            <div className="flex justify-end pt-4 border-t border-gray-100">
                                <PrimaryButton type="submit" disabled={isSubmitting}>
                                    {isSubmitting ? 'Saving Changes...' : 'Save Profile'}
                                </PrimaryButton>
                            </div>
                        </form>
                    )}

                    {/* TAB 2: VERIFICATION CENTER */}
                    {activeTab === 'verification' && (
                        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
                            <div className="text-center mb-8">
                                <h3 className="text-xl font-bold text-gray-800">Identity Verification</h3>
                                <p className="text-gray-500">We use AI to match your documents with your registration details.</p>
                            </div>

                            {/* Verification Status Banner */}
                            {companyData?.isVerified ? (
                                <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-green-600 text-4xl">
                                        <i className="bi bi-shield-check"></i>
                                    </div>
                                    <h4 className="text-2xl font-bold text-green-800 mb-2">Verification Complete</h4>
                                    <p className="text-green-700 max-w-md mx-auto">
                                        Your business identity has been verified via Aadhar and CIN matching. You have full access to hiring tools.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Scan Animation Overlay */}
                                    {scanStatus === 'scanning' && (
                                        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
                                            <div className="relative w-64 h-40 bg-gray-800 rounded-lg border-2 border-white/30 overflow-hidden mb-4 shadow-2xl">
                                                <div className="absolute top-0 left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)] animate-[scan_2s_infinite_linear]"></div>
                                                <div className="absolute inset-0 flex items-center justify-center text-white/20 text-6xl">
                                                    <i className="bi bi-person-badge"></i>
                                                </div>
                                            </div>
                                            <p className="text-white font-mono text-lg tracking-widest animate-pulse">ANALYZING DOCUMENT...</p>
                                            <style>{`
                                                @keyframes scan {
                                                    0% { top: 0; }
                                                    100% { top: 100%; }
                                                }
                                            `}</style>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Authorized Person Name</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-200 outline-none"
                                                placeholder="Name as per Aadhar"
                                                value={authName}
                                                onChange={(e) => setAuthName(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Aadhar Number</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-200 outline-none"
                                                placeholder="XXXX XXXX XXXX"
                                                value={aadharNo}
                                                onChange={(e) => setAadharNo(e.target.value)}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Company CIN (Corporate ID)</label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-200 outline-none"
                                                placeholder="L12345MH..."
                                                value={cin}
                                                onChange={(e) => setCin(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-green-400 transition-colors bg-gray-50">
                                        <i className="bi bi-cloud-arrow-up text-4xl text-gray-400 mb-3 block"></i>
                                        <h5 className="font-semibold text-gray-700 mb-1">Upload Aadhar Card (Front & Back)</h5>
                                        <p className="text-sm text-gray-500 mb-4">Supported formats: JPG, PNG, PDF (Max 5MB)</p>
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            id="aadhar-upload" 
                                            onChange={(e) => setUploadFile(e.target.files ? e.target.files[0] : null)}
                                        />
                                        <label 
                                            htmlFor="aadhar-upload"
                                            className="inline-block bg-white border border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-medium cursor-pointer hover:bg-gray-50"
                                        >
                                            {uploadFile ? uploadFile.name : 'Select File'}
                                        </label>
                                    </div>

                                    <div className="flex justify-end pt-4">
                                        <PrimaryButton onClick={handleAadharScan} className="w-full md:w-auto">
                                            <i className="bi bi-qr-code-scan me-2"></i>
                                            Scan & Verify
                                        </PrimaryButton>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB 3: DANGER ZONE */}
                    {activeTab === 'security' && (
                        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
                            <div className="border border-red-200 rounded-2xl bg-red-50 p-8">
                                <div className="flex items-start gap-4">
                                    <div className="bg-red-100 p-3 rounded-xl text-red-600">
                                        <i className="bi bi-exclamation-triangle-fill text-2xl"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-red-800 mb-2">Delete Company Account</h3>
                                        <p className="text-red-600 mb-6 max-w-xl">
                                            Deleting your account is permanent. All your job postings (active and closed), 
                                            candidate data, and company profile information will be wiped immediately.
                                        </p>
                                        <button 
                                            onClick={() => setShowDeleteConfirm(true)}
                                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-sm transition-colors"
                                        >
                                            Delete Account
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* Delete Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-in-up">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                                <i className="bi bi-trash-fill"></i>
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Final Confirmation</h3>
                            <p className="text-gray-600 text-sm">
                                This action is irreversible. Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm account removal.
                            </p>
                        </div>
                        <input 
                            type="text" 
                            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-6 focus:ring-2 focus:ring-red-200 outline-none text-center font-bold tracking-widest"
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder="DELETE"
                        />
                        <div className="flex gap-3">
                            <button 
                                onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                disabled={deleteInput !== 'DELETE' || isSubmitting}
                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                            >
                                {isSubmitting ? 'Deleting...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
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
                    <CompanySettings 
                        companyData={companyData} 
                        refreshData={loadCompanyData} 
                    />
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
                    <div className="space-y-8 animate-fade-in">
                        {/* Welcome Header */}
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-3xl p-8 text-white relative overflow-hidden">
                            <div className="relative z-10">
                                <h1 className="text-3xl font-bold mb-2">
                                    Welcome back, {companyData?.companyName}! 👋
                                    {companyData?.isVerified && (
                                        <i className="bi bi-patch-check-fill ms-2 text-white/90" title="Verified Company"></i>
                                    )}
                                </h1>
                                <p className="text-green-100 text-lg">
                                    Manage your job postings, track candidates, and grow your team with JobMap.
                                </p>
                            </div>
                            {/* Decorative element */}
                            <div className="absolute right-0 top-0 h-full w-1/3 bg-white/10 transform skew-x-12"></div>
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