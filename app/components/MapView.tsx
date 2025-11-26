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
// 2. Job Data + Utility Functions
// ====================================================
interface JobPostWithCoords {
  id: string;
  jobTitle: string;
  companyName: string;
  companyId: string;
  city: string;
  description: string;
  coordinates: LatLngTuple; // [lat, lng]
  requirements?: string[];
  salary?: string;
  jobType?: string;
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
                <strong className="text-primary">{job.jobTitle}</strong>
                <br />
                {job.companyName} &middot; {job.city}
                <br />
                <small>{job.description.substring(0, 50)}...</small>
                <br />
                <button
                  className="btn btn-sm btn-info mt-2"
                  onClick={() => onViewDetails(job)}
                >
                  View Details
                </button>
              </Popup>
            </Marker>
          ))}

          {userLocation && (
            <Marker position={userLocation}>
              <Popup>
                <strong>Your Location (Approximate)</strong>
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

  // Fetch job postings
  const fetchJobs = useCallback(() => {
    setLoading(true);
    clearError();

    const cityToCoords: { [key: string]: LatLngTuple } = {
      Mumbai: [19.076, 72.8777],
      Bangalore: [12.9716, 77.5946],
      Delhi: [28.7041, 77.1025],
      Remote: [40.7128, -74.006],
      Chennai: [13.0827, 80.2707],
      Kolkata: [22.5726, 88.3639],
    };

    try {
      const q = query(collection(db, "jobPostings"), orderBy("createdAt", "desc"));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedJobs: JobPostWithCoords[] = snapshot.docs.map((d) => {
            const data = d.data();
            const city = data.city || "Remote";
            const latitude = data.latitude as number;
            const longitude = data.longitude as number;
            const coordinates: LatLngTuple =
              latitude && longitude
                ? [latitude, longitude]
                : cityToCoords[city] || cityToCoords["Remote"];

            return {
              id: d.id,
              jobTitle: data.jobTitle || "Untitled Position",
              companyName: data.companyName || "Unknown Company",
              companyId: data.companyId || "",
              city: city,
              description: data.description || "No description available",
              coordinates,
              requirements: data.requirements || [],
              salary: data.salary || "Not specified",
              jobType: data.jobType || "Full-time",
            } as JobPostWithCoords;
          });
          setAllJobs(fetchedJobs);
          setLoading(false);
        },
        (error) => {
          setError("Failed to load jobs for map: " + error.message);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (e) {
      setError("Error setting up job listener.");
      setLoading(false);
    }
  }, [setError, clearError]);

  useEffect(() => {
    const unsubscribe = fetchJobs();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [fetchJobs]);

  // Get user location
  useEffect(() => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setError("User location detected for 'Nearby' search.", false);
        },
        (error) => {
          console.warn("Geolocation failed:", error);
          setError(
            "Could not get your precise location. 'Nearby' search is disabled.",
            true
          );
        }
      );
    }
  }, [setError]);

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
      setError(`Showing jobs within ${NEARBY_RADIUS_KM}km of your location.`, false);
    }

    return result;
  }, [allJobs, searchTerm, cityFilter, nearbyFilter, userLocation, setError]);

  // Apply for job - FIXED VERSION
  const handleApply = async () => {
    if (!selectedJob || !user) {
      setError("Please log in to apply for jobs.");
      return;
    }

    try {
      setApplying(true);
      clearError();

      // Get user data from artifacts or use basic info
      let userName = user.displayName || "Unknown User";
      let userEmail = user.email || "";
      let userSkills: string[] = [];
      let userExperience = "Not specified";
      let userEducation = "Not specified";
      let userResumeUrl = "";

      // Try to fetch user profile data from artifacts
      try {
        const { getDoc, doc } = await import("firebase/firestore");
        const userDoc = await getDoc(doc(db, "artifacts", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          userName = userData.displayName || userData.name || userName;
          userEmail = userData.email || userEmail;
          userSkills = userData.skills || userData.tags || [];
          userExperience = userData.experience || userData.workExperience || userExperience;
          userEducation = userData.education || userEducation;
          userResumeUrl = userData.resumeUrl || userData.cvUrl || userResumeUrl;
        }
      } catch (profileError) {
        console.log("Using basic user data for application");
      }

      // Create the job application with all required fields
      const applicationData = {
        jobId: selectedJob.id,
        jobTitle: selectedJob.jobTitle,
        companyId: selectedJob.companyId,
        companyName: selectedJob.companyName,
        userId: user.uid,
        userName: userName,
        userEmail: userEmail,
        userPhone: user.phoneNumber || "Not provided",
        userSkills: userSkills,
        userExperience: userExperience,
        userEducation: userEducation,
        userResumeUrl: userResumeUrl,
        status: "Submitted",
        appliedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "jobApplications"), applicationData);
      
      setApplied(true);
      setApplying(false);
      setError("Application submitted successfully!", false);
      
      // Auto-close modal after 2 seconds
      setTimeout(() => {
        setSelectedJob(null);
        setApplied(false);
      }, 2000);
      
    } catch (error: any) {
      console.error("Application error:", error);
      setError("Failed to submit job application: " + (error.message || "Unknown error"));
      setApplying(false);
    }
  };

  if (loading)
    return (
      <div className="text-center py-5">
        <i className="bi bi-arrow-clockwise me-2 animate-spin"></i> Loading map data...
      </div>
    );

  const availableCities = [...new Set(allJobs.map((job) => job.city))].sort();

  return (
    <div className="row">
      <div className="col-lg-12">
        <div className="card shadow-lg p-4 mb-4">
          <h5 className="fw-bold mb-3">Filter Jobs on Map</h5>
          <div className="row g-3 align-items-end">
            {/* Search */}
            <div className="col-md-5">
              <label className="form-label small text-muted">
                Search Title, Company, or Description
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Search 'React Developer' in 'Mumbai'"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {/* City Filter */}
            <div className="col-md-3">
              <label className="form-label small text-muted">Filter by City</label>
              <select
                className="form-select"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
              >
                <option value="All">All Locations</option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            {/* Nearby Filter */}
            <div className="col-md-4">
              <div className="form-check form-switch d-flex align-items-center">
                <input
                  className="form-check-input me-2"
                  type="checkbox"
                  id="nearbySwitch"
                  checked={nearbyFilter}
                  onChange={(e) => setNearbyFilter(e.target.checked)}
                  disabled={!userLocation}
                />
                <label className="form-check-label fw-bold" htmlFor="nearbySwitch">
                  Jobs Near Me ({NEARBY_RADIUS_KM} km)
                </label>
              </div>
            </div>
          </div>
          <p className="text-muted small mt-3 mb-0">
            Showing <strong>{filteredJobs.length}</strong> jobs matching criteria.
          </p>
        </div>

        {/* Map */}
        <div className="card shadow-lg">
          <div className="card-body p-0 rounded-3 overflow-hidden">
            <DynamicJobMap
              jobs={filteredJobs}
              userLocation={userLocation}
              onViewDetails={setSelectedJob}
            />
          </div>
        </div>

        {/* Job Details Modal - IMPROVED VERSION */}
        {selectedJob && (
          <div
            className="modal fade show"
            style={{
              display: "block",
              background: "rgba(0,0,0,0.5)",
            }}
            tabIndex={-1}
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content">
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">
                    <i className="bi bi-briefcase me-2"></i>
                    {selectedJob.jobTitle}
                  </h5>
                  <button
                    className="btn-close btn-close-white"
                    onClick={() => {
                      setSelectedJob(null);
                      setApplied(false);
                    }}
                    disabled={applying}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-8">
                      <h6 className="text-primary">{selectedJob.companyName}</h6>
                      <div className="mb-3">
                        <span className="badge bg-secondary me-2">
                          <i className="bi bi-geo-alt me-1"></i>
                          {selectedJob.city}
                        </span>
                        <span className="badge bg-info me-2">
                          <i className="bi bi-clock me-1"></i>
                          {selectedJob.jobType}
                        </span>
                        {selectedJob.salary && (
                          <span className="badge bg-success">
                            <i className="bi bi-currency-dollar me-1"></i>
                            {selectedJob.salary}
                          </span>
                        )}
                      </div>
                      
                      <h6>Job Description:</h6>
                      <p className="text-muted">{selectedJob.description}</p>
                      
                      {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                        <>
                          <h6>Requirements:</h6>
                          <ul className="list-unstyled">
                            {selectedJob.requirements.map((req, index) => (
                              <li key={index} className="mb-1">
                                <i className="bi bi-check-circle text-success me-2"></i>
                                {req}
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                    
                    <div className="col-md-4 border-start">
                      <div className="sticky-top" style={{ top: '20px' }}>
                        <h6>Quick Apply</h6>
                        <div className="alert alert-info small">
                          <i className="bi bi-info-circle me-2"></i>
                          Your profile information will be used for this application.
                        </div>
                        
                        {!user ? (
                          <div className="alert alert-warning">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Please log in to apply for this position.
                          </div>
                        ) : !applied ? (
                          <button
                            className="btn btn-primary w-100 mb-2"
                            onClick={handleApply}
                            disabled={applying}
                          >
                            {applying ? (
                              <>
                                <i className="bi bi-arrow-clockwise animate-spin me-2"></i>
                                Submitting...
                              </>
                            ) : (
                              <>
                                <i className="bi bi-send me-2"></i>
                                Apply Now
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="alert alert-success">
                            <i className="bi bi-check-circle me-2"></i>
                            Application Submitted!
                          </div>
                        )}
                        
                        <div className="small text-muted mt-3">
                          <p><strong>Application includes:</strong></p>
                          <ul className="small">
                            <li>Your profile information</li>
                            <li>Skills and experience</li>
                            <li>Education background</li>
                            <li>Resume (if available)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setSelectedJob(null);
                      setApplied(false);
                    }}
                    disabled={applying}
                  >
                    Close
                  </button>
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