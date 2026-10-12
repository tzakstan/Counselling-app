from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class QuestionnaireData(BaseModel):
    pre_session_query: Optional[str] = Field(default="", description="Anything on your mind you want to ask")
    strengths_rely_on: Optional[str] = Field(default="", description="What people can rely on you for")
    weaknesses_not_rely_on: Optional[str] = Field(default="", description="What people can never rely on you for")
    worry_overthink: Optional[str] = Field(default="", description="What do you worry or overthink most about")
    enjoy_3_things: Optional[str] = Field(default="", description="3 things you enjoy doing most")
    insecure_uncomfortable: Optional[str] = Field(default="", description="What makes you feel insecure or uncomfortable")
    proud_of_yourself: Optional[str] = Field(default="", description="One thing you are proud of about yourself")
    confidence_source: Optional[str] = Field(default="", description="What makes you feel confident")
    feel_understood: Optional[str] = Field(default="", description="Do you feel people around you understand you")
    go_to_person: Optional[str] = Field(default="", description="Whom do you talk to when something bothers you")
    parents_different: Optional[str] = Field(default="", description="Anything you wish parents did differently")
    study_motivation: Optional[str] = Field(default="", description="Study because you want to or pressure")
    future_career: Optional[str] = Field(default="", description="Future career options thought about")
    adult_life_imagined: Optional[str] = Field(default="", description="As an adult what life have you imagined")
    fears_barriers_future: Optional[str] = Field(default="", description="Fears or barriers related to future/marks")
    alter_improve_self: Optional[str] = Field(default="", description="One thing you want to alter/improve about yourself")
    magic_button_wish: Optional[str] = Field(default="", description="Magic button one thing to change")
    session_feeling: Optional[str] = Field(default="", description="How this conversation felt for you")
    unshared_thoughts: Optional[str] = Field(default="", description="Anything you wanted to share but couldn't")
    takeaway: Optional[str] = Field(default="", description="Your takeaway from the session")
    moula_guidance_practice: Optional[str] = Field(default="", description="One thing Moula says that you are practicing")

class ClinicalObservations(BaseModel):
    emotional_expression: Optional[str] = Field(default="Fully Expressive", description="Fully expressive / Moderate / Constricted")
    confidence_level: Optional[str] = Field(default="Confident", description="Confident / Fluctuating / Low")
    anxiety_restlessness: Optional[str] = Field(default="A little bit", description="None / A little bit / High")
    clarity_vs_confusion: Optional[str] = Field(default="Clear", description="Clear / Somewhat Confused / Confused")
    family_pressure_themes: Optional[str] = Field(default="No", description="Yes / No / Implicit")
    fear_of_failure_judgement: Optional[str] = Field(default="Mild", description="None / Mild / Severe")
    motivational_level: Optional[str] = Field(default="High", description="High / Moderate / Low")
    identity_struggles: Optional[str] = Field(default="None Observed", description="None Observed / Moderate / Prominent")
    peer_influence: Optional[str] = Field(default="Positive", description="Positive / Susceptible / Isolated")
    emotional_maturity: Optional[str] = Field(default="Good", description="Good / Developing / Immature")

class Comment(BaseModel):
    id: str
    author: str
    role: str  # "Counsellor" or "Management"
    text: str
    timestamp: str

class GeneratedReport(BaseModel):
    executive_summary: str
    emotional_profile: str
    social_family_dynamics: str
    academic_future_outlook: str
    institutional_value_alignment: str
    clinical_synthesis: str
    counsellor_remarks: str
    prescribed_exercises: str
    triage_status: str  # "🟢 Well-Adapted" | "🟡 Mild Observation" | "🔴 Requires Follow-up"
    follow_up_recommended: bool
    follow_up_notes: Optional[str] = ""

class Student(BaseModel):
    id: str
    name: str
    age: int
    fathers_occupation: str
    mothers_occupation: str
    place: str
    batch: str = "Batch 2026-A"
    is_confidential: bool = False  # Mask PII when viewed/exported if true
    status: str = "Evaluated"  # "Draft" | "Evaluated" | "Follow-up Scheduled"
    questionnaire: QuestionnaireData
    observations: ClinicalObservations
    counsellor_raw_remarks: Optional[str] = ""
    prescribed_exercise_raw: Optional[str] = ""
    report: Optional[GeneratedReport] = None
    comments: List[Comment] = []
    created_at: str
    updated_at: str

class CumulativeReport(BaseModel):
    title: str = "Saire Ilmi Counselling Program - Cumulative Conclusive Cohort Dossier"
    generated_at: str
    total_evaluated: int
    triage_counts: Dict[str, int]
    executive_overview: str
    key_cohort_themes: List[Dict[str, str]]
    spiritual_value_integration_summary: str
    action_roster_high_risk: List[Dict[str, Any]]
    management_recommendations: List[str]

