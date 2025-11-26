// src/app/components/Profile.tsx
"use client";

import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useEffect, useState, useCallback, memo } from 'react';
import { Button, Card, Col, Container, Form, Modal, Row, Alert, Badge, ProgressBar, Spinner } from 'react-bootstrap';
import { 
  PencilSquare, PlusLg, Trash, Upload, Check2, 
  Briefcase, Mortarboard, Tools, Folder, GeoAlt, 
  Linkedin, Facebook, Instagram, Globe, Calendar3, 
  Building, PatchCheckFill, Link45deg, Person, 
  Telephone, Award, Translate, Laptop
} from 'react-bootstrap-icons';

import { auth, db, storage } from '@/app/lib/firebase';

// ===============================================
// 0. GLOBAL STYLES
// ===============================================
const globalStyles = `
  .hover-lift { transition: transform 0.2s ease, box-shadow 0.2s ease; }
  .hover-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0,0,0,0.03) !important; }
  .soft-shadow { box-shadow: 0 2px 8px rgba(0,0,0,0.02); }
  .form-control:focus, .form-select:focus { border-color: #e2e8f0; box-shadow: 0 0 0 3px rgba(226, 232, 240, 0.5); }
  .timeline-line { width: 2px; background-color: #f1f5f9; position: absolute; top: 32px; bottom: -10px; left: 15px; }
  .cover-area { background-color: #ffffff; border-bottom: 1px solid #f1f5f9; }
`;

// ===============================================
// 1. TYPES
// ===============================================
export interface SocialLinks { linkedin: string; facebook: string; instagram: string; }
export interface Experience { 
  id: number; title: string; company: string; dates: string; 
  description?: string; locationType?: string; employmentType?: string; 
}
export interface Education { 
  id: number; school: string; degree: string; dates: string; 
  fieldOfStudy?: string; grade?: string; 
}
export interface Skill { id: number; name: string; level?: string; }
export interface Project { id: number; title: string; description?: string; technologies?: string; projectUrl?: string; }
export interface Certification { id: number; name: string; issuer: string; date: string; url?: string; }
export interface Language { id: number; language: string; proficiency: string; }

export interface ProfileData {
  name: string; headline: string; location: string; about: string;
  email: string; phone: string; website: string; openToWork: boolean;
  profileImageUrl: string; coverImageUrl: string; socialLinks: SocialLinks;
  experience: Experience[]; education: Education[]; skills: Skill[]; 
  projects: Project[]; certifications: Certification[]; languages: Language[];
}

const initialProfileData: ProfileData = {
  name: "", headline: "", location: "", about: "", 
  email: "", phone: "", website: "", openToWork: false,
  profileImageUrl: "", coverImageUrl: "",
  socialLinks: { linkedin: "", facebook: "", instagram: "" },
  experience: [], education: [], skills: [], projects: [], certifications: [], languages: []
};

// Generators
const generateProfilePic = (name: string | null | undefined) => 
  `https://placehold.co/150x150/f8fafc/334155?text=${name ? name.charAt(0).toUpperCase() : 'U'}`;

// ===============================================
// 2. MAIN COMPONENT
// ===============================================

const Profile = () => {
  const [profileData, setProfileData] = useState<ProfileData>(initialProfileData);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [tempData, setTempData] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'default-app-id';

  // Data Fetching
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) setUserId(user.uid);
      else { setUserId(null); setLoading(false); }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (userId) {
      const userProfilePath = `artifacts/${appId}/users/${userId}/data/profile`;
      const unsubscribeSnapshot = onSnapshot(doc(db, userProfilePath), (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data() as ProfileData;
          const mergedData = { ...initialProfileData, ...userData };
          if (!mergedData.profileImageUrl) mergedData.profileImageUrl = generateProfilePic(mergedData.name);
          setProfileData(mergedData);
        } else {
          const userName = auth.currentUser?.displayName || "New User";
          const userEmail = auth.currentUser?.email || "";
          const newData = { ...initialProfileData, name: userName, email: userEmail, profileImageUrl: generateProfilePic(userName) };
          setDoc(doc(db, userProfilePath), newData, { merge: true });
        }
        setLoading(false);
      });
      return () => unsubscribeSnapshot();
    }
  }, [userId, appId]);

  // Handlers
  const openModal = (section: string) => {
    setEditingSection(section);
    if (section === 'profileInfo') {
      setTempData({ 
        name: profileData.name, headline: profileData.headline, 
        location: profileData.location, phone: profileData.phone, 
        website: profileData.website, openToWork: profileData.openToWork 
      });
    } else if (['about', 'socialLinks'].includes(section)) {
      // @ts-ignore
      setTempData(profileData[section]);
    } else if (section === 'socialLinks') {
      setTempData({ ...profileData.socialLinks });
    } else {
      // @ts-ignore
      setTempData(JSON.parse(JSON.stringify(profileData[section])));
    }
  };

  const closeModal = () => { setEditingSection(null); setTempData(null); };

  const handleSave = async () => {
    if (!userId || !editingSection) return;
    setSaving(true);
    try {
      let dataToSave: any = {};
      if (editingSection === 'profileInfo') dataToSave = tempData;
      else if (['about', 'socialLinks'].includes(editingSection)) dataToSave = { [editingSection]: tempData };
      else dataToSave = { [editingSection]: tempData };
      
      const userRef = doc(db, 'artifacts', appId, 'users', userId, 'data', 'profile');
      await setDoc(userRef, dataToSave, { merge: true });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      closeModal();
    } catch (error) { console.error("Error saving:", error); } 
    finally { setSaving(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, imageType: string) => {
    if (!userId || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploadingImage(imageType);
    try {
      const storageRef = ref(storage, `users/${userId}/${imageType}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const imageUrl = await getDownloadURL(storageRef);
      const userRef = doc(db, 'artifacts', appId, 'users', userId, 'data', 'profile');
      await setDoc(userRef, { [`${imageType}ImageUrl`]: imageUrl }, { merge: true });
    } catch (error) { console.error("Upload error:", error); } 
    finally { setUploadingImage(null); }
  };

  const calculateCompletion = () => {
    let score = 0;
    if(profileData.name) score += 10;
    if(profileData.headline) score += 10;
    if(profileData.about) score += 15;
    if(profileData.experience.length > 0) score += 15;
    if(profileData.education.length > 0) score += 15;
    if(profileData.skills.length > 0) score += 15;
    if(profileData.projects.length > 0) score += 10;
    if(profileData.certifications.length > 0) score += 10;
    return Math.min(100, score);
  };

  if (loading) return <ProfileSkeleton />;

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '3rem', fontFamily: '"Inter", sans-serif' }}>
      <style>{globalStyles}</style>
      <Container className="py-4" style={{ maxWidth: '1080px' }}>
        
        {showSuccess && (
          <div className="position-fixed top-0 start-50 translate-middle-x mt-4 z-3">
            <Alert variant="light" className="rounded-pill shadow-lg px-4 py-2 border-0 d-flex align-items-center small fw-bold text-success">
              <Check2 className="me-2" size={18} /> Saved successfully
            </Alert>
          </div>
        )}

        {/* --- HERO HEADER (Compact) --- */}
        <Card className="border-0 soft-shadow rounded-3 overflow-hidden mb-3 bg-white">
          {/* Pure White Cover with subtle edit button */}
          <div className="position-relative cover-area" style={{ height: '140px' }}>
            {profileData.coverImageUrl && (
                <img src={profileData.coverImageUrl} className="w-100 h-100 object-fit-cover" alt="Cover" />
            )}
            <div className="position-absolute top-0 end-0 m-2">
              <label className="btn btn-light btn-sm rounded-pill shadow-sm border px-3 py-1 small fw-medium text-secondary hover-lift">
                {uploadingImage === 'cover' ? <Spinner size="sm"/> : <><Upload className="me-2"/> Edit Cover</>}
                <input type="file" hidden onChange={(e) => handleImageUpload(e, 'cover')} accept="image/*" />
              </label>
            </div>
          </div>

          <Card.Body className="px-4 pb-4 pt-0 position-relative">
            <div className="d-flex flex-column flex-md-row align-items-end gap-3" style={{ marginTop: '-50px' }}>
              {/* Profile Picture */}
              <div className="position-relative">
                <div className="rounded-circle bg-white p-1 shadow-sm d-inline-block">
                  <img 
                    src={profileData.profileImageUrl} 
                    className="rounded-circle object-fit-cover bg-light border" 
                    style={{ width: '120px', height: '120px' }} 
                    alt="Profile" 
                  />
                </div>
                <label className="position-absolute bottom-0 end-0 btn btn-light btn-sm rounded-circle shadow-sm border p-0 d-flex align-items-center justify-content-center hover-lift" style={{width: '30px', height: '30px', cursor: 'pointer'}}>
                  {uploadingImage === 'profile' ? <Spinner size="sm" variant="dark" style={{width: 12, height: 12}} /> : <Upload className="text-secondary" size={14} />}
                  <input type="file" hidden onChange={(e) => handleImageUpload(e, 'profile')} accept="image/*" />
                </label>
              </div>

              {/* Name & Headline */}
              <div className="flex-grow-1 pb-1 w-100">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <h2 className="fw-bold text-dark mb-0 d-flex align-items-center tracking-tight" style={{fontSize: '1.5rem'}}>
                      {profileData.name} 
                      <PatchCheckFill className="text-primary ms-2" style={{fontSize: '1rem'}} title="Verified" />
                    </h2>
                    <p className="text-secondary mb-2 fw-medium small">{profileData.headline || "Add a professional headline"}</p>
                    
                    <div className="d-flex flex-wrap gap-3 text-muted tiny align-items-center">
                      {profileData.location && <span className="d-flex align-items-center"><GeoAlt className="me-1" /> {profileData.location}</span>}
                      {profileData.website && <a href={profileData.website} target="_blank" className="text-decoration-none text-dark fw-medium d-flex align-items-center hover-underline"><Globe className="me-1"/> Website</a>}
                      {profileData.phone && <span className="d-flex align-items-center"><Telephone className="me-1"/> {profileData.phone}</span>}
                      {profileData.openToWork && <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20 rounded-pill fw-medium px-2 py-1">Open to Work</span>}
                    </div>
                  </div>
                  <Button variant="outline-secondary" size="sm" className="rounded-pill px-3 fw-medium d-none d-md-block border-opacity-50 hover-lift" onClick={() => openModal('profileInfo')}>
                    Edit
                  </Button>
                </div>
              </div>
            </div>
            <div className="d-md-none mt-3">
              <Button variant="outline-secondary" size="sm" className="w-100 rounded-pill fw-medium" onClick={() => openModal('profileInfo')}>Edit Profile</Button>
            </div>
          </Card.Body>
        </Card>

        <Row className="g-3">
          {/* --- LEFT COLUMN: MAIN CONTENT --- */}
          <Col lg={8}>
            
            {/* About */}
            <SectionCard title="About" icon={<Person className="text-primary" />} onEdit={() => openModal('about')}>
              {profileData.about ? (
                <p className="text-secondary mb-0 small" style={{ lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{profileData.about}</p>
              ) : <EmptyState onClick={() => openModal('about')} text="Add summary" />}
            </SectionCard>

            {/* Experience */}
            <SectionCard title="Experience" icon={<Briefcase className="text-primary" />} onEdit={() => openModal('experience')}>
              {profileData.experience.length > 0 ? (
                <div className="d-flex flex-column gap-2">
                  {profileData.experience.map((exp, index) => (
                    <div key={exp.id} className="d-flex gap-3 position-relative py-1">
                      {/* Timeline Line */}
                      {index !== profileData.experience.length - 1 && (
                        <div className="timeline-line"></div>
                      )}
                      <div className="flex-shrink-0 pt-1">
                        <div className="rounded-circle bg-white border shadow-sm d-flex align-items-center justify-content-center text-secondary" style={{width: 32, height: 32}}>
                          <Building size={14} />
                        </div>
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <h6 className="fw-bold text-dark mb-0 small">{exp.title}</h6>
                            <div className="text-secondary tiny fw-medium">
                              {exp.company} 
                              {exp.employmentType && <span className="text-muted fw-normal"> • {exp.employmentType}</span>}
                            </div>
                          </div>
                          <span className="text-muted tiny bg-light px-2 py-0.5 rounded border border-light text-nowrap">
                            {exp.dates}
                          </span>
                        </div>
                        <div className="text-muted tiny mb-1">
                           {exp.locationType && <span className="d-flex align-items-center"><GeoAlt className="me-1" size={10}/> {exp.locationType}</span>}
                        </div>
                        {exp.description && <p className="text-secondary tiny mb-0 mt-1 text-truncate-3" style={{lineHeight: '1.4'}}>{exp.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState onClick={() => openModal('experience')} text="Add experience" />}
            </SectionCard>

            {/* Education */}
            <SectionCard title="Education" icon={<Mortarboard className="text-primary" />} onEdit={() => openModal('education')}>
              {profileData.education.length > 0 ? (
                <div className="d-flex flex-column gap-2">
                  {profileData.education.map((edu) => (
                    <div key={edu.id} className="d-flex gap-3 align-items-start p-2 rounded-3 hover-bg-light transition">
                      <div className="rounded-circle bg-white p-1.5 border d-flex align-items-center justify-content-center shadow-sm text-secondary" style={{width: 36, height: 36}}>
                        <Mortarboard size={16} />
                      </div>
                      <div className="flex-grow-1">
                        <h6 className="fw-bold text-dark mb-0 small">{edu.school}</h6>
                        <div className="text-dark tiny">{edu.degree} {edu.fieldOfStudy && `• ${edu.fieldOfStudy}`}</div>
                        <div className="text-muted tiny mt-0.5">
                          {edu.dates} {edu.grade && <span className="ms-2 text-success fw-medium">• GPA: {edu.grade}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState onClick={() => openModal('education')} text="Add education" />}
            </SectionCard>

            {/* Certifications */}
            <SectionCard title="Certifications" icon={<Award className="text-primary" />} onEdit={() => openModal('certifications')}>
              {profileData.certifications.length > 0 ? (
                <div className="row g-2">
                  {profileData.certifications.map((cert) => (
                    <div key={cert.id} className="col-md-6">
                      <div className="p-2 border rounded-3 h-100 d-flex align-items-center gap-2 bg-white hover-lift transition">
                        <div className="text-warning bg-warning bg-opacity-10 p-1.5 rounded-circle d-flex"><Award size={14}/></div>
                        <div className="overflow-hidden flex-grow-1">
                          <div className="fw-bold text-dark tiny text-truncate">{cert.name}</div>
                          <div className="text-muted tiny text-truncate">{cert.issuer} • {cert.date}</div>
                          {cert.url && <a href={cert.url} target="_blank" className="tiny text-primary text-decoration-none fw-bold mt-0.5 d-block">View Credential</a>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState onClick={() => openModal('certifications')} text="Add certifications" />}
            </SectionCard>

            {/* Projects */}
            <SectionCard title="Projects" icon={<Folder className="text-primary" />} onEdit={() => openModal('projects')}>
              {profileData.projects.length > 0 ? (
                <div className="row g-2">
                  {profileData.projects.map((proj) => (
                    <div key={proj.id} className="col-md-6">
                      <div className="h-100 p-3 rounded-3 border bg-white hover-lift transition position-relative">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                           <div className="d-flex align-items-center gap-2">
                              <Folder className="text-secondary" size={14}/>
                              <h6 className="fw-bold text-dark mb-0 small">{proj.title}</h6>
                           </div>
                           {proj.projectUrl && <a href={proj.projectUrl} target="_blank" className="text-muted hover-text-primary stretched-link"><Link45deg size={16}/></a>}
                        </div>
                        <p className="text-muted tiny line-clamp-2 mb-2" style={{minHeight: '28px'}}>{proj.description}</p>
                        {proj.technologies && (
                          <div className="d-flex gap-1 flex-wrap mt-auto">
                            {proj.technologies.split(',').slice(0,3).map((t, i) => (
                              <span key={i} className="badge bg-light text-secondary border fw-normal" style={{fontSize: '0.6rem'}}>{t.trim()}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState onClick={() => openModal('projects')} text="Add projects" />}
            </SectionCard>
          </Col>

          {/* Right Column: Sidebar */}
          <Col lg={4}>
            <div className="sticky-top" style={{ top: '20px', zIndex: 1 }}>
              
              {/* Profile Strength */}
              <Card className="border-0 soft-shadow rounded-3 mb-3 bg-white overflow-hidden">
                <Card.Body className="p-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold mb-0 small text-dark">Profile Strength</h6>
                    <span className="fw-bold small text-success">{calculateCompletion()}%</span>
                  </div>
                  <ProgressBar now={calculateCompletion()} variant="success" className="mb-0 bg-light" style={{height: '6px'}} />
                </Card.Body>
              </Card>

              {/* Skills */}
              <SectionCard title="Skills" icon={<Tools className="text-primary"/>} onEdit={() => openModal('skills')} noPadding>
                <div className="p-3">
                  {profileData.skills.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                      {profileData.skills.map((skill) => (
                        <Badge key={skill.id} bg="white" text="dark" className="px-2 py-1 rounded-2 border shadow-sm fw-medium text-secondary" style={{fontSize: '0.75rem'}}>
                          {skill.name}
                        </Badge>
                      ))}
                    </div>
                  ) : <EmptyState onClick={() => openModal('skills')} text="Add skills" />}
                </div>
              </SectionCard>

              {/* Languages */}
              <SectionCard title="Languages" icon={<Translate className="text-primary"/>} onEdit={() => openModal('languages')} noPadding>
                <div className="list-group list-group-flush">
                  {profileData.languages.length > 0 ? profileData.languages.map(lang => (
                    <div key={lang.id} className="list-group-item px-3 py-2 border-0 d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-dark small">{lang.language}</span>
                      <span className="text-secondary tiny">{lang.proficiency}</span>
                    </div>
                  )) : <div className="p-3"><EmptyState onClick={() => openModal('languages')} text="Add languages"/></div>}
                </div>
              </SectionCard>

              {/* Socials */}
              <SectionCard title="Socials" icon={<Globe className="text-primary"/>} onEdit={() => openModal('socialLinks')} noPadding>
                <div className="list-group list-group-flush rounded-bottom-3">
                  {profileData.socialLinks.linkedin && <a href={profileData.socialLinks.linkedin} target="_blank" className="list-group-item px-3 py-2 border-0 d-flex gap-2 align-items-center hover-bg-light text-decoration-none"><Linkedin className="text-primary" size={14}/> <span className="small fw-medium text-dark">LinkedIn</span></a>}
                  {profileData.socialLinks.facebook && <a href={profileData.socialLinks.facebook} target="_blank" className="list-group-item px-3 py-2 border-0 d-flex gap-2 align-items-center hover-bg-light text-decoration-none"><Facebook className="text-primary" size={14}/> <span className="small fw-medium text-dark">Facebook</span></a>}
                  {profileData.socialLinks.instagram && <a href={profileData.socialLinks.instagram} target="_blank" className="list-group-item px-3 py-2 border-0 d-flex gap-2 align-items-center hover-bg-light text-decoration-none"><Instagram className="text-danger" size={14}/> <span className="small fw-medium text-dark">Instagram</span></a>}
                  {!profileData.socialLinks.linkedin && !profileData.socialLinks.facebook && !profileData.socialLinks.instagram && <div className="p-3"><EmptyState onClick={() => openModal('socialLinks')} text="Connect profiles"/></div>}
                </div>
              </SectionCard>
            </div>
          </Col>
        </Row>

        {/* --- EDIT MODAL (Compact & Clean) --- */}
        <Modal show={!!editingSection} onHide={closeModal} size="lg" centered backdrop="static" contentClassName="border-0 shadow-lg rounded-4">
          <Modal.Header closeButton className="border-bottom bg-white px-4 py-3 rounded-top-4">
            <Modal.Title className="fw-bold fs-5 text-dark">
              {editingSection === 'profileInfo' ? 'Edit Profile' : 
               editingSection ? `Edit ${editingSection.charAt(0).toUpperCase() + editingSection.slice(1)}` : ''}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-0" style={{ maxHeight: '70vh', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
            <div className="p-4">
              <EditModalContent section={editingSection} tempData={tempData} setTempData={setTempData} />
            </div>
          </Modal.Body>
          <Modal.Footer className="border-top px-4 py-3 bg-white rounded-bottom-4">
            <Button variant="light" size="sm" onClick={closeModal} className="rounded-pill px-3 fw-medium text-muted me-2">Cancel</Button>
            <Button variant="dark" size="sm" onClick={handleSave} disabled={saving} className="rounded-pill px-4 fw-medium shadow-sm bg-gradient">
              {saving ? <><Spinner size="sm" animation="border" className="me-2"/>Saving...</> : 'Save Changes'}
            </Button>
          </Modal.Footer>
        </Modal>

      </Container>
    </div>
  );
};

// ===============================================
// 3. HELPER COMPONENTS
// ===============================================

const SectionCard: React.FC<any> = ({ title, icon, onEdit, children, noPadding }) => (
  <Card className="border-0 soft-shadow rounded-3 mb-3 overflow-hidden h-auto bg-white hover-lift">
    <div className="d-flex justify-content-between align-items-center px-3 pt-3 pb-2">
      <h6 className="fw-bold m-0 d-flex align-items-center gap-2 text-dark" style={{fontSize: '0.95rem'}}>
        {icon && <div className="bg-light rounded-circle p-1 d-flex text-secondary border border-light">{icon}</div>}
        {title}
      </h6>
      <Button variant="light" size="sm" className="p-1 text-muted rounded-2 border-0 hover-bg-light" onClick={onEdit} style={{lineHeight: 0}}>
        <PencilSquare size={14} />
      </Button>
    </div>
    <div className={noPadding ? '' : 'p-3'}>{children}</div>
  </Card>
);

const EmptyState: React.FC<{ text: string, onClick: () => void }> = ({ text, onClick }) => (
  <div className="text-center py-3 bg-light bg-opacity-50 rounded-2 border border-dashed cursor-pointer hover-bg-gray-100 transition" onClick={onClick}>
    <div className="mb-1 text-muted opacity-50"><PlusLg size={18}/></div>
    <p className="text-muted tiny mb-0 fw-medium">{text}</p>
  </div>
);

const ProfileSkeleton = () => (
  <Container className="py-5" style={{ maxWidth: '1100px' }}>
    <div className="bg-white rounded-3 shadow-sm overflow-hidden mb-4" style={{height: '160px'}}></div>
    <Row>
      <Col lg={8}><div className="bg-white rounded-3 shadow-sm p-3 mb-3" style={{height: '120px'}}></div></Col>
      <Col lg={4}><div className="bg-white rounded-3 shadow-sm p-3 mb-3" style={{height: '180px'}}></div></Col>
    </Row>
  </Container>
);

// --- STYLED INPUT HELPERS ---
const StyledInput = (props: any) => <Form.Control {...props} className={`border-0 bg-white shadow-sm rounded-2 px-3 py-2 ${props.className || ''}`} style={{fontSize: '0.9rem'}} />;
const StyledTextarea = (props: any) => <Form.Control as="textarea" {...props} className={`border-0 bg-white shadow-sm rounded-2 px-3 py-2 ${props.className || ''}`} style={{fontSize: '0.9rem', resize: 'none'}} />;
const Label = ({ children, icon }: any) => <Form.Label className="tiny fw-bold text-uppercase text-secondary mb-1 d-flex align-items-center gap-1 letter-spacing-1" style={{fontSize: '0.7rem'}}>{icon && <span className="text-primary">{icon}</span>} {children}</Form.Label>;

// --- ENHANCED MODAL FORMS ---
const EditModalContent: React.FC<any> = ({ section, tempData, setTempData }) => {
  if (!tempData) return null;

  const updateField = (field: string, value: any) => setTempData((prev: any) => ({ ...prev, [field]: value }));
  const updateItem = (id: number, field: string, val: any) => setTempData((prev: any[]) => prev.map(i => i.id === id ? { ...i, [field]: val } : i));
  const deleteItem = (id: number) => setTempData((prev: any[]) => prev.filter(i => i.id !== id));
  const addItem = (template: any) => setTempData((prev: any[]) => [...prev, { ...template, id: Date.now() }]);

  switch (section) {
    case 'profileInfo':
      return (
        <Form className="bg-white p-4 rounded-4 shadow-sm">
          <Row className="g-3">
            <Col md={12}><Label icon={<Person/>}>Full Name</Label><StyledInput value={tempData.name} onChange={(e:any) => updateField('name', e.target.value)} /></Col>
            <Col md={12}><Label icon={<Briefcase/>}>Headline</Label><StyledInput value={tempData.headline} onChange={(e:any) => updateField('headline', e.target.value)} /></Col>
            <Col md={6}><Label icon={<GeoAlt/>}>Location</Label><StyledInput value={tempData.location} onChange={(e:any) => updateField('location', e.target.value)} /></Col>
            <Col md={6}><Label icon={<Telephone/>}>Phone</Label><StyledInput value={tempData.phone} onChange={(e:any) => updateField('phone', e.target.value)} /></Col>
            <Col md={12}><Label icon={<Globe/>}>Website / Portfolio</Label><StyledInput value={tempData.website} onChange={(e:any) => updateField('website', e.target.value)} /></Col>
            <Col md={12}>
              <div className="p-3 bg-light rounded-3 d-flex align-items-center justify-content-between">
                <Form.Check type="switch" id="open-work" label="Open to work opportunities" checked={tempData.openToWork} onChange={(e) => updateField('openToWork', e.target.checked)} className="fw-bold text-dark mb-0 small" />
                {tempData.openToWork && <Badge bg="success">Active</Badge>}
              </div>
            </Col>
          </Row>
        </Form>
      );
    case 'about':
      return (
        <div className="bg-white p-4 rounded-4 shadow-sm">
          <Label icon={<Person/>}>Biography</Label>
          <StyledTextarea rows={6} value={tempData} onChange={(e:any) => setTempData(e.target.value)} placeholder="Tell your story..." />
        </div>
      );
    case 'experience':
      return (
        <div className="d-flex flex-column gap-3">
          {tempData.map((item: any) => (
            <div key={item.id} className="p-3 bg-white rounded-3 shadow-sm position-relative border-start border-4 border-primary">
              <Button variant="link" className="text-danger position-absolute top-0 end-0 p-2" size="sm" onClick={() => deleteItem(item.id)}><Trash size={14}/></Button>
              <Row className="g-2">
                <Col md={6}><Label>Title</Label><StyledInput className="bg-light" value={item.title} onChange={(e:any) => updateItem(item.id, 'title', e.target.value)}/></Col>
                <Col md={6}><Label>Company</Label><StyledInput className="bg-light" value={item.company} onChange={(e:any) => updateItem(item.id, 'company', e.target.value)}/></Col>
                <Col md={6}><Label>Employment</Label>
                  <Form.Select className="border-0 bg-light shadow-sm rounded-2 py-2 small" value={item.employmentType} onChange={(e) => updateItem(item.id, 'employmentType', e.target.value)}>
                    <option value="">Select...</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option>
                  </Form.Select>
                </Col>
                <Col md={6}><Label>Location</Label>
                  <Form.Select className="border-0 bg-light shadow-sm rounded-2 py-2 small" value={item.locationType} onChange={(e) => updateItem(item.id, 'locationType', e.target.value)}>
                    <option value="">Select...</option><option>On-site</option><option>Hybrid</option><option>Remote</option>
                  </Form.Select>
                </Col>
                <Col md={12}><Label>Dates</Label><StyledInput className="bg-light" value={item.dates} onChange={(e:any) => updateItem(item.id, 'dates', e.target.value)} placeholder="e.g. Jan 2020 - Present"/></Col>
                <Col md={12}><Label>Description</Label><StyledTextarea className="bg-light" rows={2} value={item.description} onChange={(e:any) => updateItem(item.id, 'description', e.target.value)}/></Col>
              </Row>
            </div>
          ))}
          <Button variant="outline-primary" size="sm" className="w-100 py-2 border-dashed rounded-3 fw-bold small" onClick={() => addItem({title:'',company:'',dates:'',description:'', employmentType: 'Full-time'})}><PlusLg className="me-1"/> Add Experience</Button>
        </div>
      );
    case 'education':
        return (
          <div className="d-flex flex-column gap-3">
            {tempData.map((item: any) => (
              <div key={item.id} className="p-3 bg-white rounded-3 shadow-sm position-relative border border-light">
                <Button variant="link" className="text-danger position-absolute top-0 end-0 p-2" size="sm" onClick={() => deleteItem(item.id)}><Trash size={14}/></Button>
                <Row className="g-2">
                  <Col md={12}><Label>School</Label><StyledInput className="bg-light" value={item.school} onChange={(e:any) => updateItem(item.id, 'school', e.target.value)}/></Col>
                  <Col md={6}><Label>Degree</Label><StyledInput className="bg-light" value={item.degree} onChange={(e:any) => updateItem(item.id, 'degree', e.target.value)}/></Col>
                  <Col md={6}><Label>Field of Study</Label><StyledInput className="bg-light" value={item.fieldOfStudy} onChange={(e:any) => updateItem(item.id, 'fieldOfStudy', e.target.value)}/></Col>
                  <Col md={6}><Label>Years</Label><StyledInput className="bg-light" value={item.dates} onChange={(e:any) => updateItem(item.id, 'dates', e.target.value)}/></Col>
                  <Col md={6}><Label>Grade</Label><StyledInput className="bg-light" value={item.grade} onChange={(e:any) => updateItem(item.id, 'grade', e.target.value)}/></Col>
                </Row>
              </div>
            ))}
            <Button variant="outline-primary" size="sm" className="w-100 py-2 border-dashed rounded-3 fw-bold small" onClick={() => addItem({school:'',degree:'',dates:'', fieldOfStudy: '', grade: ''})}><PlusLg size={14}/> Add Education</Button>
          </div>
        );
    case 'certifications':
        return (
          <div className="d-flex flex-column gap-3">
            {tempData.map((item: any) => (
              <div key={item.id} className="p-3 bg-white rounded-3 shadow-sm position-relative border border-light">
                <Button variant="link" className="text-danger position-absolute top-0 end-0 p-2" size="sm" onClick={() => deleteItem(item.id)}><Trash size={14}/></Button>
                <Row className="g-2">
                  <Col md={6}><Label>Name</Label><StyledInput className="bg-light" value={item.name} onChange={(e:any) => updateItem(item.id, 'name', e.target.value)}/></Col>
                  <Col md={6}><Label>Issuer</Label><StyledInput className="bg-light" value={item.issuer} onChange={(e:any) => updateItem(item.id, 'issuer', e.target.value)}/></Col>
                  <Col md={6}><Label>Date</Label><StyledInput className="bg-light" value={item.date} onChange={(e:any) => updateItem(item.id, 'date', e.target.value)}/></Col>
                  <Col md={6}><Label>URL</Label><StyledInput className="bg-light" value={item.url} onChange={(e:any) => updateItem(item.id, 'url', e.target.value)}/></Col>
                </Row>
              </div>
            ))}
            <Button variant="outline-primary" size="sm" className="w-100 border-dashed rounded-3 fw-bold small" onClick={() => addItem({name:'', issuer:'', date:''})}><PlusLg size={14}/> Add Certification</Button>
          </div>
        );
    case 'languages':
        return (
          <div className="d-flex flex-column gap-2">
            {tempData.map((item: any) => (
              <div key={item.id} className="d-flex gap-2 align-items-center">
                <StyledInput className="bg-light" placeholder="Language" value={item.language} onChange={(e:any) => updateItem(item.id, 'language', e.target.value)} />
                <Form.Select className="border-0 bg-light shadow-sm rounded-2 form-control-sm" style={{maxWidth: 160}} value={item.proficiency} onChange={(e:any) => updateItem(item.id, 'proficiency', e.target.value)}>
                  <option>Elementary</option><option>Professional</option><option>Native</option>
                </Form.Select>
                <Button variant="light" size="sm" className="text-danger shadow-sm" onClick={() => deleteItem(item.id)}><Trash size={14}/></Button>
              </div>
            ))}
            <Button variant="outline-primary" size="sm" className="w-100 border-dashed small" onClick={() => addItem({language:'', proficiency:'Professional'})}><PlusLg size={14}/> Add Language</Button>
          </div>
        );
    case 'skills':
        return (
          <div className="bg-white p-3 rounded-3 shadow-sm">
            <div className="d-flex flex-column gap-2">
              {tempData.map((item: any) => (
                <div key={item.id} className="d-flex gap-2 align-items-center">
                  <StyledInput placeholder="Skill" value={item.name} onChange={(e:any) => updateItem(item.id, 'name', e.target.value)} />
                  <Button variant="light" size="sm" className="text-danger shadow-sm" onClick={() => deleteItem(item.id)}><Trash size={14}/></Button>
                </div>
              ))}
              <Button variant="outline-primary" size="sm" className="w-100 py-1 border-dashed rounded-2 small" onClick={() => addItem({name:'', level:'Intermediate'})}><PlusLg size={14}/> Add Skill</Button>
            </div>
          </div>
        );
    case 'projects':
        return (
          <div className="d-flex flex-column gap-3">
            {tempData.map((item: any) => (
              <div key={item.id} className="p-3 bg-white rounded-3 shadow-sm position-relative border border-light">
                <Button variant="link" className="text-danger position-absolute top-0 end-0 p-2" size="sm" onClick={() => deleteItem(item.id)}><Trash size={14}/></Button>
                <Row className="g-2">
                  <Col md={12}><Label>Title</Label><StyledInput className="bg-light" value={item.title} onChange={(e:any) => updateItem(item.id, 'title', e.target.value)}/></Col>
                  <Col md={12}><Label>Tech Stack</Label><StyledInput className="bg-light" value={item.technologies} onChange={(e:any) => updateItem(item.id, 'technologies', e.target.value)}/></Col>
                  <Col md={12}><Label>Link</Label><StyledInput className="bg-light" value={item.projectUrl} onChange={(e:any) => updateItem(item.id, 'projectUrl', e.target.value)}/></Col>
                  <Col md={12}><Label>Description</Label><StyledTextarea className="bg-light" rows={2} value={item.description} onChange={(e:any) => updateItem(item.id, 'description', e.target.value)}/></Col>
                </Row>
              </div>
            ))}
            <Button variant="outline-primary" size="sm" className="w-100 py-2 border-dashed rounded-3 fw-bold small" onClick={() => addItem({title:'',description:'',technologies:'',projectUrl:''})}><PlusLg size={14}/> Add Project</Button>
          </div>
        );
    case 'socialLinks':
        return (
          <div className="bg-white p-3 rounded-3 shadow-sm d-flex flex-column gap-3">
            <Form.Group><Label>LinkedIn</Label><StyledInput className="bg-light" value={tempData.linkedin} onChange={(e:any) => updateField('linkedin', e.target.value)} /></Form.Group>
            <Form.Group><Label>Facebook</Label><StyledInput className="bg-light" value={tempData.facebook} onChange={(e:any) => updateField('facebook', e.target.value)} /></Form.Group>
            <Form.Group><Label>Instagram</Label><StyledInput className="bg-light" value={tempData.instagram} onChange={(e:any) => updateField('instagram', e.target.value)} /></Form.Group>
          </div>
        );
    default: return null;
  }
};

export default Profile;