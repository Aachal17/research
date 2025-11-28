"use client";

import { FC, useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/app/page";
import { db } from "@/app/lib/firebase";
import { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";

// ====================================================
// 1. FIX — Initialize Leaflet Marker Icons (Client Only)
// ====================================================
if (typeof window !== "undefined") {
  const L = require("leaflet");
  const iconRetinaUrl = require("leaflet/dist/images/marker-icon-2x.png");
  const iconUrl = require("leaflet/dist/images/marker-icon.png");
  const shadowUrl = require("leaflet/dist/images/marker-shadow.png");

  const getImageUrl = (asset: any): string => {
    if (!asset) return "";
    if (typeof asset === "string") return asset;
    return asset.src || asset.default || "";
  };

  const DefaultIcon = L.icon({
    iconRetinaUrl: getImageUrl(iconRetinaUrl),
    iconUrl: getImageUrl(iconUrl),
    shadowUrl: getImageUrl(shadowUrl),
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  L.Marker.prototype.options.icon = DefaultIcon;
}

// ====================================================
// 2. Data Interfaces
// ====================================================

interface CompanyData {
  id: string;
  companyName: string;
  isVerified: boolean;
  logoUrl?: string; // Optional: if you have logos
}

interface JobPostWithCoords {
  id: string;
  jobTitle: string;
  companyName: string; // Fallback from job doc
  companyId: string;
  city: string;
  description: string;
  coordinates: LatLngTuple; // [lat, lng]
  requirements?: string[];
  salary?: string;
  jobType?: string;
  // Merged fields
  verified?: boolean;
}

const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ====================================================
// 3. Dynamically Loaded Map Component (Client Only)
// ====================================================
interface JobMapProps {
  jobs: JobPostWithCoords[];
  userLocation: LatLngTuple | null;
  onViewDetails: (job: JobPostWithCoords) => void;
}

const DynamicJobMap = dynamic(
  async () => {
    const leaflet = await import("react-leaflet");
    const { MapContainer, TileLayer, Marker, Popup, useMap } = leaflet;

    const JobMapContent: FC<JobMapProps> = ({ jobs, userLocation, onViewDetails }) => {
      const MapUpdater: FC = () => {
        const map = useMap();
        useEffect(() => {
          if (jobs.length > 0) {
            const bounds = jobs.map((job) => job.coordinates);
            map.fitBounds(bounds, { padding: [50, 50] });
          } else if (userLocation) {
            map.setView(userLocation, 12);
          }
        }, [jobs, map]);
        return null;
      };

      const initialCenter: LatLngTuple = userLocation || [20.5937, 78.9629];

      return (
        <MapContainer
          center={initialCenter}
          zoom={userLocation ? 12 : 5}
          scrollWheelZoom
          style={{ height: "70vh", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {jobs.map((job) => (
            <Marker key={job.id} position={job.coordinates}>
              <Popup>
                <div className="p-1">
                  <strong className="text-primary d-block mb-1">{job.jobTitle}</strong>
                  <div className="d-flex align-items-center mb-1">
                    <span className="fw-bold me-1">{job.companyName}</span>
                    {job.verified && (
                      <i 
                        className="bi bi-patch-check-fill text-primary" 
                        title="Verified Company"
                        style={{ fontSize: '0.9rem' }}
                      ></i>
                    )}
                  </div>
                  <small className="text-muted d-block mb-2">
                    <i className="bi bi-geo-alt me-1"></i>{job.city}
                  </small>
                  <div className="text-truncate mb-2" style={{ maxWidth: "200px" }}>
                    {job.description}
                  </div>
                  <button
                    className="btn btn-sm btn-outline-primary w-100"
                    onClick={() => onViewDetails(job)}
                  >
                    View Details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {userLocation && (
            <Marker position={userLocation}>
              <Popup>
                <strong>Your Location</strong>
              </Popup>
            </Marker>
          )}

          <MapUpdater />
        </MapContainer>
      );
    };

    return JobMapContent;
  },
  { ssr: false, loading: () => <p className="text-center p-5">Loading Map...</p> }
);

// ====================================================
// 4. Main Map View Component
// ====================================================
export const MapView: FC = () => {
  const { user, setError, clearError } = useAuth();
  
  // State for raw data
  const [rawJobs, setRawJobs] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Record<string, CompanyData>>({});
  
  // Derived state
  const [allJobs, setAllJobs] = useState<JobPostWithCoords[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [cityFilter, setCityFilter] = useState("All");
  const [nearbyFilter, setNearbyFilter] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobPostWithCoords | null>(null);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const NEARBY_RADIUS_KM = 50;

  // 1. Fetch Companies Real-time
  useEffect(() => {
    const q = query(collection(db, "companies"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const companyMap: Record<string, CompanyData> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        companyMap[doc.id] = {
          id: doc.id,
          companyName: data.companyName || "Unknown",
          isVerified: data.isVerified || false,
          logoUrl: data.logoUrl
        };
      });
      setCompanies(companyMap);
    }, (error) => {
      console.error("Error fetching companies:", error);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Jobs Real-time
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "jobPostings"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const jobsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRawJobs(jobsData);
      setLoading(false);
    }, (error) => {
      setError("Failed to load jobs: " + error.message);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setError]);

  // 3. Merge Data (Jobs + Companies)
  useEffect(() => {
    const cityToCoords: { [key: string]: LatLngTuple } = {
      Mumbai: [19.076, 72.8777],
      Bangalore: [12.9716, 77.5946],
      Delhi: [28.7041, 77.1025],
      Remote: [40.7128, -74.006],
      Chennai: [13.0827, 80.2707],
      Kolkata: [22.5726, 88.3639],
      Hyderabad: [17.3850, 78.4867],
      Pune: [18.5204, 73.8567],
    };

    const mergedJobs: JobPostWithCoords[] = rawJobs.map((job) => {
      const companyInfo = companies[job.companyId];
      
      // Use real-time company name if available, else fallback to job doc
      const companyName = companyInfo ? companyInfo.companyName : (job.companyName || "Unknown Company");
      const isVerified = companyInfo ? companyInfo.isVerified : false;

      const city = job.city || "Remote";
      const latitude = job.latitude as number;
      const longitude = job.longitude as number;
      
      // Coordinate logic
      let coordinates: LatLngTuple;
      if (latitude && longitude) {
        coordinates = [latitude, longitude];
      } else {
        coordinates = cityToCoords[city] || cityToCoords["Remote"];
      }

      return {
        id: job.id,
        jobTitle: job.jobTitle || "Untitled Position",
        companyName: companyName,
        companyId: job.companyId || "",
        city: city,
        description: job.description || "No description available",
        coordinates: coordinates,
        requirements: job.requirements || [],
        salary: job.salary || "Not specified",
        jobType: job.jobType || "Full-time",
        verified: isVerified
      };
    });

    setAllJobs(mergedJobs);
  }, [rawJobs, companies]);

  // Get user location
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.warn("Geolocation warning:", error);
          // Don't set error state here to avoid intrusive UI alerts for permission denial
        }
      );
    }
  }, []);

  // Apply filters
  const filteredJobs = useMemo(() => {
    let result = allJobs;

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(
        (job) =>
          job.jobTitle.toLowerCase().includes(lowerSearchTerm) ||
          job.companyName.toLowerCase().includes(lowerSearchTerm) ||
          job.description.toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (cityFilter !== "All") {
      result = result.filter((job) => job.city === cityFilter);
    }

    if (nearbyFilter && userLocation) {
      const [userLat, userLng] = userLocation;
      result = result.filter((job) => {
        const [jobLat, jobLng] = job.coordinates;
        const distance = calculateDistance(userLat, userLng, jobLat, jobLng);
        return distance <= NEARBY_RADIUS_KM;
      });
    }

    return result;
  }, [allJobs, searchTerm, cityFilter, nearbyFilter, userLocation]);

  // Apply for job
  const handleApply = async () => {
    if (!selectedJob || !user) {
      setError("Please log in to apply for jobs.");
      return;
    }

    try {
      setApplying(true);
      clearError();

      // Get user profile data merged with auth data
      let userName = user.displayName || "Unknown User";
      let userEmail = user.email || "";
      let userSkills: string[] = [];
      let userExperience = "Not specified";
      let userEducation = "Not specified";
      let userResumeUrl = "";

      // Try fetching extended profile
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        // Checking 'users' collection first as that's likely where profiles are
        const userDoc = await getDoc(doc(db, "users", user.uid)); 
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userName = userData.displayName || userName;
          userSkills = userData.skills || [];
          userExperience = userData.experience || userExperience;
          // Add other fields as per your schema
        }
      } catch (e) {
        console.log("Profile fetch skipped/failed, using auth defaults");
      }

      const applicationData = {
        jobId: selectedJob.id,
        jobTitle: selectedJob.jobTitle,
        companyId: selectedJob.companyId,
        companyName: selectedJob.companyName,
        userId: user.uid,
        userName: userName,
        userEmail: userEmail,
        userSkills: userSkills,
        status: "Submitted",
        appliedAt: serverTimestamp(),
        // Add coordinates for analytics map if needed
        jobLocation: selectedJob.coordinates 
      };

      await addDoc(collection(db, "jobApplications"), applicationData);
      
      setApplied(true);
      setApplying(false);
      setError("Application submitted successfully!", false);
      
      setTimeout(() => {
        setSelectedJob(null);
        setApplied(false);
      }, 2000);
      
    } catch (error: any) {
      console.error("Application error:", error);
      setError("Failed to submit: " + (error.message || "Unknown error"));
      setApplying(false);
    }
  };

  if (loading && allJobs.length === 0)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-2 text-muted">Loading map data...</p>
      </div>
    );

  const availableCities = Array.from(new Set(allJobs.map((job) => job.city))).sort();

  return (
    <div className="row">
      <div className="col-lg-12">
        {/* Filters Card */}
        <div className="card shadow-sm border-0 mb-4 bg-white rounded-3">
          <div className="card-body p-4">
            
            <div className="row g-3 align-items-end">
              <div className="col-md-5">
                <label className="form-label small text-muted fw-bold">Search</label>
                <div className="input-group">
                  <span className="input-group-text bg-light border-end-0">
                    <i className="bi bi-search"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control bg-light border-start-0"
                    placeholder="Title, Company, or Keywords"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="col-md-3">
                <label className="form-label small text-muted fw-bold">Location</label>
                <select
                  className="form-select bg-light"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  <option value="All">All Cities</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>
              
              <div className="col-md-4">
                <div className="form-check form-switch p-2 bg-light rounded border d-flex align-items-center">
                  <input
                    className="form-check-input ms-0 me-2"
                    type="checkbox"
                    id="nearbySwitch"
                    checked={nearbyFilter}
                    onChange={(e) => setNearbyFilter(e.target.checked)}
                    disabled={!userLocation}
                    style={{ cursor: userLocation ? "pointer" : "not-allowed" }}
                  />
                  <label className="form-check-label small mb-0" htmlFor="nearbySwitch">
                    Show only jobs near me ({NEARBY_RADIUS_KM}km)
                    {!userLocation && <span className="d-block text-danger x-small">Location blocked</span>}
                  </label>
                </div>
              </div>
            </div>
            
            <div className="mt-3 d-flex align-items-center justify-content-between">
              <p className="text-muted small mb-0">
                Found <strong>{filteredJobs.length}</strong> jobs
              </p>
              {searchTerm || cityFilter !== "All" || nearbyFilter ? (
                <button 
                  className="btn btn-link btn-sm text-decoration-none p-0"
                  onClick={() => {
                    setSearchTerm("");
                    setCityFilter("All");
                    setNearbyFilter(false);
                  }}
                >
                  Clear Filters
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Map Container */}
        <div className="card shadow-lg border-0 rounded-3 overflow-hidden" style={{ minHeight: "500px" }}>
          <DynamicJobMap
            jobs={filteredJobs}
            userLocation={userLocation}
            onViewDetails={setSelectedJob}
          />
        </div>

        {/* Job Details Modal */}
        {selectedJob && (
          <div className="modal fade show d-block" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content border-0 shadow-lg overflow-hidden">
                <div className="modal-header bg-white border-bottom-0 pb-0">
                  <h5 className="modal-title fw-bold">Job Details</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => {
                      setSelectedJob(null);
                      setApplied(false);
                    }}
                    disabled={applying}
                  ></button>
                </div>
                
                <div className="modal-body p-4">
                  <div className="row g-4">
                    {/* Left Column: Job Info */}
                    <div className="col-md-8">
                      <h2 className="h4 fw-bold text-dark mb-1">{selectedJob.jobTitle}</h2>
                      
                      <div className="d-flex align-items-center mb-3">
                        <span className="fs-5 text-primary me-2 fw-medium">{selectedJob.companyName}</span>
                        {selectedJob.verified && (
                          <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill d-flex align-items-center px-2 py-1">
                            <i className="bi bi-patch-check-fill me-1"></i> Verified
                          </span>
                        )}
                      </div>

                      <div className="d-flex flex-wrap gap-2 mb-4">
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-geo-alt me-1 text-muted"></i> {selectedJob.city}
                        </span>
                        <span className="badge bg-light text-dark border">
                          <i className="bi bi-briefcase me-1 text-muted"></i> {selectedJob.jobType}
                        </span>
                        {selectedJob.salary && (
                          <span className="badge bg-success-subtle text-success border border-success-subtle">
                            <i className="bi bi-cash me-1"></i> {selectedJob.salary}
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <h6 className="fw-bold text-uppercase text-muted small mb-2">Description</h6>
                        <p className="text-secondary" style={{ whiteSpace: 'pre-wrap' }}>
                          {selectedJob.description}
                        </p>
                      </div>

                      {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                        <div>
                          <h6 className="fw-bold text-uppercase text-muted small mb-2">Requirements</h6>
                          <ul className="list-group list-group-flush border-start border-3 border-primary ps-2">
                            {selectedJob.requirements.map((req, i) => (
                              <li key={i} className="list-group-item bg-transparent px-0 py-1 border-0 d-flex">
                                <i className="bi bi-dot text-primary fs-4 lh-1 me-1"></i>
                                <span>{req}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Actions */}
                    <div className="col-md-4">
                      <div className="card bg-light border-0 h-100">
                        <div className="card-body">
                          <h6 className="fw-bold mb-3">Apply Now</h6>
                          
                          {!user ? (
                            <div className="alert alert-warning small mb-0">
                              <i className="bi bi-lock me-1"></i> Login required
                            </div>
                          ) : applied ? (
                            <div className="text-center py-4">
                              <div className="mb-2">
                                <i className="bi bi-check-circle-fill text-success fs-1"></i>
                              </div>
                              <h6 className="fw-bold text-success">Applied!</h6>
                              <p className="small text-muted mb-0">Good luck!</p>
                            </div>
                          ) : (
                            <>
                              <p className="small text-muted mb-3">
                                Your profile details will be shared with <strong>{selectedJob.companyName}</strong>.
                              </p>
                              <button
                                className="btn btn-primary w-100 py-2 fw-medium"
                                onClick={handleApply}
                                disabled={applying}
                              >
                                {applying ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Sending...
                                  </>
                                ) : (
                                  <>Easy Apply <i className="bi bi-arrow-right ms-1"></i></>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;