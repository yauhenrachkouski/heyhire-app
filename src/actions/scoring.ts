
export function prepareCandidateForScoring(candidateData: any) {
  const experiences = typeof candidateData.experiences === 'string' 
    ? JSON.parse(candidateData.experiences) 
    : candidateData.experiences;
  
  const educations = typeof candidateData.educations === 'string' 
    ? JSON.parse(candidateData.educations) 
    : candidateData.educations;
    
  const location = typeof candidateData.location === 'string' 
    ? JSON.parse(candidateData.location) 
    : candidateData.location;

  const filteredExperiences = Array.isArray(experiences) 
    ? experiences.map((exp: any) => ({
        position: exp.position || exp.title,
        skills: exp.skills,
        startDate: exp.startDate,
        endDate: exp.endDate,
        isCurrent: exp.isCurrent,
        // meaningful description if needed, but user didn't explicitly ask for it in experience, 
        // though "description" was in the top level list.
        description: exp.description 
      }))
    : [];

  const filteredEducations = Array.isArray(educations) 
    ? educations.map((edu: any) => ({
        schoolName: edu.school || edu.schoolName,
        degree: edu.degree,
        skills: edu.skills,
        fieldOfStudy: edu.fieldOfStudy,
        startDate: edu.startDate,
        endDate: edu.endDate
      }))
    : [];

  return {
    headline: candidateData.headline,
    about: candidateData.summary,
    summary: candidateData.summary,
    location: location,
    location_text: candidateData.locationText || candidateData.location_text,
    position: candidateData.position,
    experiences: filteredExperiences,
    educations: filteredEducations,
    skills: typeof candidateData.skills === 'string' ? JSON.parse(candidateData.skills) : candidateData.skills
  };
}
