"use client";
import React, { FC, useState } from 'react';
import { useAuth } from '../page';

interface Opportunity {
    id: string;
    title: string;
    company: string;
    type: 'job' | 'internship' | 'hackathon';
    location: string;
    salary?: string;
    description: string;
    skills: string[];
    postedDate: string;
    isRemote: boolean;
    experience?: string;
    duration?: string;
    prizePool?: string;
    deadline?: string;
}

interface ExploreOpportunitiesProps {
    onBack: () => void;
}

export const ExploreOpportunities: FC<ExploreOpportunitiesProps> = ({ onBack }) => {
    const { setError } = useAuth();
    const [activeTab, setActiveTab] = useState<'all' | 'jobs' | 'internships' | 'hackathons'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
    const [locationFilter, setLocationFilter] = useState('');

    // Mock data for opportunities
    const opportunities: Opportunity[] = [
        // Jobs
        {
            id: '1',
            title: 'Senior Frontend Developer',
            company: 'TechCorp Inc.',
            type: 'job',
            location: 'San Francisco, CA',
            salary: '$140,000 - $180,000',
            description: 'We are looking for an experienced Frontend Developer to join our growing team. You will be responsible for building responsive web applications using modern frameworks.',
            skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'],
            postedDate: '2024-01-15',
            isRemote: true,
            experience: '5+ years'
        },
        {
            id: '2',
            title: 'Full Stack Engineer',
            company: 'StartupXYZ',
            type: 'job',
            location: 'New York, NY',
            salary: '$120,000 - $150,000',
            description: 'Join our dynamic startup as a Full Stack Engineer. Work on cutting-edge projects and make a real impact.',
            skills: ['Node.js', 'React', 'MongoDB', 'AWS'],
            postedDate: '2024-01-14',
            isRemote: false,
            experience: '3+ years'
        },
        {
            id: '3',
            title: 'UX/UI Designer',
            company: 'DesignStudio',
            type: 'job',
            location: 'Remote',
            salary: '$90,000 - $120,000',
            description: 'Create beautiful and intuitive user experiences for our digital products.',
            skills: ['Figma', 'Sketch', 'Adobe Creative Suite', 'User Research'],
            postedDate: '2024-01-13',
            isRemote: true,
            experience: '4+ years'
        },

        // Internships
        {
            id: '4',
            title: 'Software Engineering Intern',
            company: 'Google',
            type: 'internship',
            location: 'Mountain View, CA',
            salary: '$7,500/month',
            description: 'Summer internship for students interested in software engineering. Work on real projects with mentorship from experienced engineers.',
            skills: ['Python', 'Java', 'C++', 'Algorithms'],
            postedDate: '2024-01-12',
            isRemote: false,
            duration: '3 months',
            experience: 'Student'
        },
        {
            id: '5',
            title: 'Data Science Intern',
            company: 'Meta',
            type: 'internship',
            location: 'Remote',
            salary: '$6,500/month',
            description: 'Work with our data science team to analyze user behavior and build machine learning models.',
            skills: ['Python', 'SQL', 'Machine Learning', 'Statistics'],
            postedDate: '2024-01-11',
            isRemote: true,
            duration: '4 months',
            experience: 'Student'
        },
        {
            id: '6',
            title: 'Product Management Intern',
            company: 'Microsoft',
            type: 'internship',
            location: 'Redmond, WA',
            salary: '$7,000/month',
            description: 'Learn product management from industry experts and contribute to real product decisions.',
            skills: ['Product Strategy', 'User Research', 'Analytics', 'Communication'],
            postedDate: '2024-01-10',
            isRemote: false,
            duration: '3 months',
            experience: 'Student'
        },

        // Hackathons
        {
            id: '7',
            title: 'AI Innovation Challenge',
            company: 'OpenAI',
            type: 'hackathon',
            location: 'Virtual',
            description: 'Build innovative AI solutions that can change the world. Open to developers of all skill levels.',
            skills: ['Python', 'Machine Learning', 'AI', 'APIs'],
            postedDate: '2024-01-09',
            isRemote: true,
            prizePool: '$50,000',
            deadline: '2024-02-28'
        },
        {
            id: '8',
            title: 'Blockchain Hackathon',
            company: 'Coinbase',
            type: 'hackathon',
            location: 'San Francisco, CA',
            description: 'Create the next generation of blockchain applications and decentralized solutions.',
            skills: ['Solidity', 'Web3', 'Blockchain', 'Smart Contracts'],
            postedDate: '2024-01-08',
            isRemote: false,
            prizePool: '$25,000',
            deadline: '2024-03-15'
        },
        {
            id: '9',
            title: 'Climate Tech Hackathon',
            company: 'Tesla',
            type: 'hackathon',
            location: 'Virtual',
            description: 'Develop technology solutions to address climate change and promote sustainability.',
            skills: ['IoT', 'Data Science', 'Renewable Energy', 'Sustainability'],
            postedDate: '2024-01-07',
            isRemote: true,
            prizePool: '$100,000',
            deadline: '2024-04-10'
        }
    ];

    // All available skills for filtering
    const allSkills = Array.from(new Set(opportunities.flatMap(opp => opp.skills)));

    // Filter opportunities based on active tab, search term, skills, and location
    const filteredOpportunities = opportunities.filter(opportunity => {
        const matchesTab = activeTab === 'all' || 
                          (activeTab === 'jobs' && opportunity.type === 'job') ||
                          (activeTab === 'internships' && opportunity.type === 'internship') ||
                          (activeTab === 'hackathons' && opportunity.type === 'hackathon');
        
        const matchesSearch = opportunity.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            opportunity.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            opportunity.description.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesSkills = selectedSkills.length === 0 || 
                            selectedSkills.some(skill => opportunity.skills.includes(skill));
        
        const matchesLocation = !locationFilter || 
                              opportunity.location.toLowerCase().includes(locationFilter.toLowerCase()) ||
                              (locationFilter.toLowerCase() === 'remote' && opportunity.isRemote);

        return matchesTab && matchesSearch && matchesSkills && matchesLocation;
    });

    const handleSkillToggle = (skill: string) => {
        setSelectedSkills(prev =>
            prev.includes(skill)
                ? prev.filter(s => s !== skill)
                : [...prev, skill]
        );
    };

    const handleApply = (opportunity: Opportunity) => {
        setError(`Application started for ${opportunity.title} at ${opportunity.company}`, false);
        // In a real app, this would navigate to application form or open a modal
    };

    const handleQuickApply = (opportunity: Opportunity) => {
        setError(`Quick application submitted for ${opportunity.title}`, false);
        // In a real app, this would submit a pre-filled application
    };

    const getOpportunityIcon = (type: string) => {
        switch (type) {
            case 'job': return 'bi-briefcase';
            case 'internship': return 'bi-mortarboard';
            case 'hackathon': return 'bi-trophy';
            default: return 'bi-briefcase';
        }
    };

    const getOpportunityColor = (type: string) => {
        switch (type) {
            case 'job': return 'blue';
            case 'internship': return 'green';
            case 'hackathon': return 'amber';
            default: return 'gray';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header with Back Button */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={onBack}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 font-medium"
                        >
                            <i className="bi bi-arrow-left"></i>
                            Back to Home
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                                <i className="bi bi-briefcase-fill text-sm"></i>
                            </div>
                            <span className="text-xl font-bold text-gray-800">JobMap</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-6 py-8">
                <div className="space-y-8">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl p-8 text-white">
                        <h1 className="text-3xl font-bold mb-2">Explore All Opportunities</h1>
                        <p className="text-indigo-100 text-lg">
                            Discover jobs, internships, and hackathons that match your skills and interests
                        </p>
                    </div>

                    {/* Filters and Search */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                            {/* Search */}
                            <div className="lg:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Search Opportunities</label>
                                <input
                                    type="text"
                                    placeholder="Search by title, company, or keywords..."
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Location Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                                <input
                                    type="text"
                                    placeholder="City or Remote"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                    value={locationFilter}
                                    onChange={(e) => setLocationFilter(e.target.value)}
                                />
                            </div>

                            {/* Results Count */}
                            <div className="flex items-end">
                                <p className="text-gray-600">
                                    {filteredOpportunities.length} opportunities found
                                </p>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className="flex space-x-1 mb-6">
                            {[
                                { key: 'all' as const, label: 'All Opportunities', count: opportunities.length },
                                { key: 'jobs' as const, label: 'Jobs', count: opportunities.filter(o => o.type === 'job').length },
                                { key: 'internships' as const, label: 'Internships', count: opportunities.filter(o => o.type === 'internship').length },
                                { key: 'hackathons' as const, label: 'Hackathons', count: opportunities.filter(o => o.type === 'hackathon').length }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`flex-1 px-4 py-3 rounded-xl text-center font-medium transition-colors ${
                                        activeTab === tab.key
                                            ? 'bg-indigo-600 text-white shadow-lg'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {tab.label} ({tab.count})
                                </button>
                            ))}
                        </div>

                        {/* Skills Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">Filter by Skills</label>
                            <div className="flex flex-wrap gap-2">
                                {allSkills.map(skill => (
                                    <button
                                        key={skill}
                                        onClick={() => handleSkillToggle(skill)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            selectedSkills.includes(skill)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {skill}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Opportunities Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredOpportunities.map(opportunity => (
                            <div
                                key={opportunity.id}
                                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 bg-${getOpportunityColor(opportunity.type)}-100 text-${getOpportunityColor(opportunity.type)}-600 rounded-xl flex items-center justify-center`}>
                                            <i className={`bi ${getOpportunityIcon(opportunity.type)} text-lg`}></i>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg">{opportunity.title}</h3>
                                            <p className="text-gray-600 text-sm">{opportunity.company}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${getOpportunityColor(opportunity.type)}-100 text-${getOpportunityColor(opportunity.type)}-700`}>
                                        {opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
                                    </span>
                                </div>

                                {/* Details */}
                                <div className="space-y-3 mb-4">
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <span className="flex items-center gap-1">
                                            <i className="bi bi-geo-alt"></i>
                                            {opportunity.isRemote ? 'Remote' : opportunity.location}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <i className="bi bi-clock"></i>
                                            {new Date(opportunity.postedDate).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {opportunity.salary && (
                                        <div className="flex items-center gap-1 text-green-600 font-semibold">
                                            <i className="bi bi-currency-dollar"></i>
                                            {opportunity.salary}
                                        </div>
                                    )}

                                    {opportunity.prizePool && (
                                        <div className="flex items-center gap-1 text-amber-600 font-semibold">
                                            <i className="bi bi-trophy"></i>
                                            Prize: {opportunity.prizePool}
                                        </div>
                                    )}

                                    {opportunity.deadline && (
                                        <div className="flex items-center gap-1 text-red-600 text-sm">
                                            <i className="bi bi-calendar-x"></i>
                                            Apply by: {new Date(opportunity.deadline).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>

                                {/* Description */}
                                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                                    {opportunity.description}
                                </p>

                                {/* Skills */}
                                <div className="flex flex-wrap gap-1 mb-4">
                                    {opportunity.skills.slice(0, 3).map(skill => (
                                        <span
                                            key={skill}
                                            className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                    {opportunity.skills.length > 3 && (
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                            +{opportunity.skills.length - 3} more
                                        </span>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleApply(opportunity)}
                                        className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-xl font-semibold hover:bg-indigo-700"
                                    >
                                        {opportunity.type === 'hackathon' ? 'Register' : 'Apply Now'}
                                    </button>
                                    {opportunity.type !== 'hackathon' && (
                                        <button
                                            onClick={() => handleQuickApply(opportunity)}
                                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
                                        >
                                            Quick Apply
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Empty State */}
                    {filteredOpportunities.length === 0 && (
                        <div className="text-center py-12">
                            <i className="bi bi-search text-4xl text-gray-300 mb-4"></i>
                            <h3 className="text-xl font-bold text-gray-600 mb-2">No opportunities found</h3>
                            <p className="text-gray-500">
                                Try adjusting your search criteria or filters to see more results.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};