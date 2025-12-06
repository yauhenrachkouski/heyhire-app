"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin, Briefcase, GraduationCap, Building2, Code, TrendingUp, ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ParsedQuery } from "@/types/search";
import type { LucideIcon } from "lucide-react";

interface SearchAiSuggestionsProps {
  parsedQuery: ParsedQuery;
  onSuggestionClick: (suggestion: string) => void;
}

interface SuggestionOption {
  label: string;
  value: string;
}

interface SuggestionQuestion {
  question: string;
  icon: LucideIcon;
  options: SuggestionOption[];
  priority: number;
}

/**
 * Generates intelligent AI question-based suggestions based on the current search query
 */
function generateQuestions(query: ParsedQuery): SuggestionQuestion[] {
  const questions: SuggestionQuestion[] = [];

  // Helper to check if a field has meaningful content
  const isEmpty = (field: string | undefined): boolean => {
    return !field || field.trim().length === 0;
  };

  // Detect job type and industry context
  const jobTitle = query.job_title?.toLowerCase() || "";
  const isTechRole = jobTitle.includes("engineer") || jobTitle.includes("developer") || 
                     jobTitle.includes("software") || jobTitle.includes("programmer") ||
                     jobTitle.includes("devops") || jobTitle.includes("data scientist");
  const isDesigner = jobTitle.includes("designer") || jobTitle.includes("ux") || jobTitle.includes("ui");
  const isProductManager = jobTitle.includes("product") && jobTitle.includes("manager");
  const isMarketing = jobTitle.includes("marketing") || jobTitle.includes("growth");
  const isSales = jobTitle.includes("sales") || jobTitle.includes("business development");
  const isFinance = jobTitle.includes("finance") || jobTitle.includes("accounting") || jobTitle.includes("analyst");
  const isHealthcare = jobTitle.includes("healthcare") || jobTitle.includes("medical") || 
                       jobTitle.includes("nurse") || jobTitle.includes("doctor");
  const isHR = jobTitle.includes("hr") || jobTitle.includes("human resource") || jobTitle.includes("recruiter");

  // Location Question - Always relevant
  if (isEmpty(query.location)) {
    questions.push({
      question: "Is this position remote-friendly or location-specific?",
      icon: MapPin,
      options: [
        { label: "Remote (Anywhere)", value: " working remotely" },
        { label: "United States", value: " located in United States" },
        { label: "Europe", value: " located in Europe" },
        { label: "San Francisco Bay Area", value: " in San Francisco Bay Area" },
        { label: "New York City", value: " in New York City" },
        { label: "London", value: " in London" },
        { label: "Hybrid", value: " with hybrid work arrangement" },
      ],
      priority: 10,
    });
  }

  // Experience Level Question - Always relevant
  if (isEmpty(query.years_of_experience)) {
    const experienceQuestion: SuggestionQuestion = {
      question: "What experience level are you looking for?",
      icon: TrendingUp,
      options: [],
      priority: 9,
    };

    if (jobTitle.includes("senior") || jobTitle.includes("lead") || jobTitle.includes("principal") || jobTitle.includes("staff")) {
      experienceQuestion.options = [
        { label: "5+ years", value: " with 5+ years of experience" },
        { label: "7+ years", value: " with 7+ years of experience" },
        { label: "10+ years", value: " with 10+ years of experience" },
      ];
    } else if (jobTitle.includes("junior") || jobTitle.includes("entry")) {
      experienceQuestion.options = [
        { label: "Entry level (0-1 year)", value: " with entry level experience" },
        { label: "1-2 years", value: " with 1-2 years of experience" },
      ];
    } else {
      experienceQuestion.options = [
        { label: "2-3 years", value: " with 2-3 years of experience" },
        { label: "3-5 years", value: " with 3-5 years of experience" },
        { label: "5+ years", value: " with 5+ years of experience" },
        { label: "7+ years", value: " with 7+ years of experience" },
      ];
    }

    questions.push(experienceQuestion);
  }

  // Tech Stack / Skills Question - Role-specific
  if (isEmpty(query.skills)) {
    if (isTechRole) {
      const techStackQuestion: SuggestionQuestion = {
        question: "Could you improve the tech stack requirements?",
        icon: Code,
        options: [],
        priority: 10,
      };

      if (jobTitle.includes("frontend") || jobTitle.includes("front-end") || jobTitle.includes("react")) {
        techStackQuestion.options = [
          { label: "React + TypeScript", value: " skilled in React and TypeScript" },
          { label: "Vue.js", value: " skilled in Vue.js" },
          { label: "Next.js", value: " with Next.js experience" },
          { label: "Modern JavaScript (ES6+)", value: " skilled in modern JavaScript" },
          { label: "HTML/CSS/Tailwind", value: " skilled in HTML, CSS, and Tailwind" },
        ];
      } else if (jobTitle.includes("backend") || jobTitle.includes("back-end")) {
        techStackQuestion.options = [
          { label: "Node.js + Express", value: " skilled in Node.js and Express" },
          { label: "Python + Django/Flask", value: " skilled in Python with Django or Flask" },
          { label: "Java + Spring Boot", value: " skilled in Java and Spring Boot" },
          { label: "Go", value: " with Go programming experience" },
          { label: "PostgreSQL/MySQL", value: " with PostgreSQL or MySQL expertise" },
        ];
      } else if (jobTitle.includes("fullstack") || jobTitle.includes("full stack") || jobTitle.includes("full-stack")) {
        techStackQuestion.options = [
          { label: "React + Node.js", value: " skilled in React and Node.js" },
          { label: "TypeScript (Full Stack)", value: " skilled in TypeScript full stack" },
          { label: "Next.js + PostgreSQL", value: " with Next.js and PostgreSQL experience" },
          { label: "MERN Stack", value: " with MERN stack experience" },
        ];
      } else if (jobTitle.includes("data") || jobTitle.includes("ml") || jobTitle.includes("machine learning") || jobTitle.includes("ai")) {
        techStackQuestion.options = [
          { label: "Python + Pandas", value: " skilled in Python and Pandas" },
          { label: "SQL + Data Warehousing", value: " with SQL and data warehousing expertise" },
          { label: "TensorFlow/PyTorch", value: " with TensorFlow or PyTorch experience" },
          { label: "Spark + Big Data", value: " skilled in Spark and big data technologies" },
          { label: "R + Statistics", value: " with R and statistical analysis skills" },
        ];
      } else if (jobTitle.includes("devops") || jobTitle.includes("sre") || jobTitle.includes("platform")) {
        techStackQuestion.options = [
          { label: "AWS", value: " with AWS experience" },
          { label: "Kubernetes + Docker", value: " skilled in Kubernetes and Docker" },
          { label: "Terraform", value: " with Terraform infrastructure-as-code experience" },
          { label: "CI/CD (Jenkins/GitHub Actions)", value: " with CI/CD pipeline experience" },
          { label: "Azure or GCP", value: " with Azure or GCP cloud experience" },
        ];
      } else if (jobTitle.includes("mobile")) {
        techStackQuestion.options = [
          { label: "React Native", value: " skilled in React Native" },
          { label: "Swift (iOS)", value: " with Swift and iOS development experience" },
          { label: "Kotlin (Android)", value: " with Kotlin and Android development experience" },
          { label: "Flutter", value: " skilled in Flutter" },
        ];
      } else {
        techStackQuestion.options = [
          { label: "JavaScript/TypeScript", value: " skilled in JavaScript and TypeScript" },
          { label: "Python", value: " with Python programming skills" },
          { label: "Git Version Control", value: " with Git version control experience" },
          { label: "REST APIs", value: " with REST API development experience" },
        ];
      }

      questions.push(techStackQuestion);
    } else if (isDesigner) {
      questions.push({
        question: "What design tools and skills should they have?",
        icon: Code,
        options: [
          { label: "Figma", value: " skilled in Figma" },
          { label: "Adobe Creative Suite", value: " with Adobe Creative Suite expertise" },
          { label: "UI/UX Design", value: " with UI/UX design experience" },
          { label: "Prototyping", value: " with prototyping and user testing skills" },
          { label: "Design Systems", value: " experienced in building design systems" },
        ],
        priority: 10,
      });
    } else if (isProductManager) {
      questions.push({
        question: "What product management skills are essential?",
        icon: Code,
        options: [
          { label: "Agile/Scrum", value: " with Agile and Scrum methodology experience" },
          { label: "Product Roadmapping", value: " with product roadmapping skills" },
          { label: "Data Analytics", value: " with data analytics and metrics expertise" },
          { label: "User Research", value: " with user research experience" },
          { label: "Stakeholder Management", value: " with stakeholder management skills" },
        ],
        priority: 10,
      });
    } else if (isMarketing) {
      questions.push({
        question: "What marketing skills are you looking for?",
        icon: Code,
        options: [
          { label: "SEO/SEM", value: " skilled in SEO and SEM" },
          { label: "Content Marketing", value: " with content marketing experience" },
          { label: "Google Analytics", value: " with Google Analytics expertise" },
          { label: "Social Media Marketing", value: " with social media marketing skills" },
          { label: "Email Marketing", value: " with email marketing experience" },
        ],
        priority: 10,
      });
    } else if (isSales) {
      questions.push({
        question: "What sales expertise do you need?",
        icon: Code,
        options: [
          { label: "B2B Sales", value: " with B2B sales experience" },
          { label: "CRM (Salesforce)", value: " with Salesforce CRM expertise" },
          { label: "Lead Generation", value: " with lead generation skills" },
          { label: "Negotiation", value: " with negotiation and closing skills" },
          { label: "Account Management", value: " with account management experience" },
        ],
        priority: 10,
      });
    } else if (isFinance) {
      questions.push({
        question: "What financial skills are required?",
        icon: Code,
        options: [
          { label: "Financial Modeling", value: " with financial modeling expertise" },
          { label: "Excel Advanced", value: " with advanced Excel skills" },
          { label: "SQL/Data Analysis", value: " with SQL and data analysis skills" },
          { label: "FP&A", value: " with FP&A experience" },
          { label: "QuickBooks/SAP", value: " with QuickBooks or SAP experience" },
        ],
        priority: 10,
      });
    } else if (isHealthcare) {
      questions.push({
        question: "What healthcare skills and certifications are needed?",
        icon: Code,
        options: [
          { label: "Patient Care", value: " with patient care experience" },
          { label: "EMR Systems", value: " with electronic medical records experience" },
          { label: "Medical Certifications", value: " with relevant medical certifications" },
          { label: "Clinical Experience", value: " with clinical experience" },
        ],
        priority: 10,
      });
    } else if (isHR) {
      questions.push({
        question: "What HR skills are you looking for?",
        icon: Code,
        options: [
          { label: "Talent Acquisition", value: " with talent acquisition experience" },
          { label: "HRIS Systems", value: " with HRIS systems expertise" },
          { label: "Employee Relations", value: " with employee relations skills" },
          { label: "Compensation & Benefits", value: " with compensation and benefits experience" },
        ],
        priority: 10,
      });
    }
  }

  // Company/Organization Type Question
  if (isEmpty(query.company)) {
    const companyQuestion: SuggestionQuestion = {
      question: "What type of company background do you prefer?",
      icon: Building2,
      options: [
        { label: "Startups (Early Stage)", value: " with startup experience" },
        { label: "Scale-ups (100-1000 employees)", value: " from scale-up companies" },
        { label: "Tech Giants (FAANG)", value: " from tech giants like FAANG" },
        { label: "Fortune 500", value: " from Fortune 500 companies" },
        { label: "Y Combinator Companies", value: " from Y Combinator companies" },
      ],
      priority: 7,
    };

    if (isTechRole || isDesigner || isProductManager) {
      companyQuestion.options.unshift({ label: "Top Tech Companies", value: " from top tech companies" });
    }

    questions.push(companyQuestion);
  }

  // Education Question - Context-aware
  if (isEmpty(query.education)) {
    const educationQuestion: SuggestionQuestion = {
      question: "What educational background is required?",
      icon: GraduationCap,
      options: [],
      priority: 6,
    };

    if (isTechRole) {
      educationQuestion.options = [
        { label: "Bachelor's in CS/Engineering", value: " with a Bachelor's degree in Computer Science or Engineering" },
        { label: "Master's in CS/Engineering", value: " with a Master's degree in Computer Science or Engineering" },
        { label: "Any Bachelor's degree", value: " with a Bachelor's degree" },
        { label: "Self-taught/Bootcamp", value: " with coding bootcamp or self-taught background" },
      ];
    } else if (isHealthcare) {
      educationQuestion.options = [
        { label: "Medical Degree (MD)", value: " with a Medical degree (MD)" },
        { label: "Nursing Degree (RN/BSN)", value: " with a Nursing degree" },
        { label: "Healthcare Administration", value: " with a Healthcare Administration degree" },
      ];
    } else if (isFinance) {
      educationQuestion.options = [
        { label: "Bachelor's in Finance/Economics", value: " with a Bachelor's degree in Finance or Economics" },
        { label: "MBA", value: " with an MBA" },
        { label: "CPA Certification", value: " with CPA certification" },
      ];
    } else {
      educationQuestion.options = [
        { label: "Bachelor's degree", value: " with a Bachelor's degree" },
        { label: "Master's degree", value: " with a Master's degree" },
        { label: "PhD", value: " with a PhD" },
        { label: "Relevant certifications", value: " with relevant professional certifications" },
      ];
    }

    questions.push(educationQuestion);
  }

  // Industry Question - Only if not specified
  if (isEmpty(query.industry)) {
    const industryOptions: SuggestionOption[] = [
      { label: "Technology", value: " in the technology industry" },
      { label: "Finance/Banking", value: " in the finance industry" },
      { label: "Healthcare", value: " in the healthcare industry" },
      { label: "E-commerce/Retail", value: " in the e-commerce or retail industry" },
      { label: "SaaS/Enterprise Software", value: " in the SaaS industry" },
    ];

    // Adjust based on role
    if (isTechRole || isDesigner) {
      industryOptions.unshift({ label: "Tech/Software", value: " in the tech and software industry" });
    }

    questions.push({
      question: "Which industry experience would be valuable?",
      icon: Briefcase,
      options: industryOptions,
      priority: 5,
    });
  }

  // Advanced refinement questions (only if basic params are filled)
  const hasBasicInfo = !isEmpty(query.job_title) && (!isEmpty(query.skills) || !isEmpty(query.years_of_experience));
  
  if (hasBasicInfo && isEmpty(query.company)) {
    questions.push({
      question: "Should they have leadership or management experience?",
      icon: TrendingUp,
      options: [
        { label: "Team Leadership", value: " with team leadership experience" },
        { label: "People Management", value: " with people management experience" },
        { label: "Individual Contributor", value: " as an individual contributor" },
      ],
      priority: 4,
    });
  }

  // Sort by priority (highest first) and limit to top 3-4 questions
  return questions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);
}

function CollapsibleQuestion({ 
  question, 
  onSuggestionClick,
  defaultOpen = true 
}: { 
  question: SuggestionQuestion; 
  onSuggestionClick: (value: string) => void;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const Icon = question.icon;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="flex w-full items-center justify-between p-3 hover:bg-accent"
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-primary" />
            <span>{question.question}</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        <div className="flex flex-wrap gap-2 pt-2">
          {question.options.map((option, optionIndex) => (
            <Button
              key={optionIndex}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick(option.value)}
              className="text-xs"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SearchAiSuggestions({ parsedQuery, onSuggestionClick }: SearchAiSuggestionsProps) {
  const questions = generateQuestions(parsedQuery);

  if (questions.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI Suggestions to Refine Your Search:
        </h3>
        <p className="text-sm text-muted-foreground">
          Your search is well-defined! Try adjusting existing filters or starting a new search.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        AI Suggestions to Refine Your Search:
      </h3>
      <div className="space-y-3">
        {questions.map((question, questionIndex) => (
          <CollapsibleQuestion
            key={questionIndex}
            question={question}
            onSuggestionClick={onSuggestionClick}
            defaultOpen={questionIndex === 0}
          />
        ))}
      </div>
    </div>
  );
}
