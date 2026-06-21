export const SUBJECT_OPTIONS = [
  "Science",
  "Math",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Science",
  "Information Technology",
  "English",
  "Nepali",
  "Social Studies",
  "Environmental Science",
  "Health",
  "Economics",
  "Accountancy",
  "Business Studies",
  "Finance",
  "Management",
  "History",
  "Geography",
  "Political Science",
  "Sociology",
  "Psychology",
  "Philosophy",
  "Law",
  "Statistics",
  "Computer Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Data Science",
  "Artificial Intelligence",
  "Machine Learning",
  "Web Development",
  "Mobile Development",
  "UI/UX Design",
  "Digital Marketing",
  "Other",
] as const;

export const STREAM_OPTIONS = [
  "Science",
  "Math",
  "Management",
  "Humanities",
  "Education",
  "Law",
  "Computer Science",
  "Engineering",
  "Medical",
  "Agriculture",
  "Commerce",
  "Arts",
  "Vocational",
  "Other",
] as const;

export const LEVEL_OPTIONS = [
  "Below 10",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "SEE",
  "Grade 11",
  "Grade 12",
  "11/12",
  "Plus Two",
  "Diploma",
  "Bachelor",
  "Master",
  "Entrance Preparation",
  "Professional",
  "Other",
] as const;

export const NOTE_GRADE_OPTIONS = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "SEE",
  "Grade 11",
  "Grade 12",
  "11/12",
  "Plus Two",
  "Bachelor",
  "Bachelor's",
  "Master",
  "Diploma",
  "Entrance Preparation",
  "Other",
] as const;

export function mergeAcademicOptions(...groups: (readonly string[] | undefined)[]) {
  const seen = new Set<string>();
  const options: string[] = [];

  for (const group of groups) {
    for (const option of group ?? []) {
      const normalized = option.trim();
      const key = normalized.toLowerCase();
      if (!normalized || seen.has(key)) continue;
      seen.add(key);
      options.push(normalized);
    }
  }

  return options;
}
